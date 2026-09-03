// src/lib/broadcast/parseRecipients.ts
// Parsing and validation for pasted recipient addresses (BC-12).
//
// Pure functions, no I/O — the classification logic is the part most worth
// testing, and it should not need a database to exercise.

/**
 * MUST stay identical to the database check constraint in
 * docs/sql/broadcast_v1.sql:
 *
 *   ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$
 *
 * If this were looser, the API would accept an address the database then
 * rejects — the admin would see a generic 500 having done nothing wrong.
 * If it were stricter, the API would reject something the schema allows, and
 * the two rules would drift apart silently.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ParsedAddress = {
  original: string;   // exactly what was pasted, for echoing back in errors
  email: string;      // normalised: trimmed, unwrapped, lowercased
  name?: string;      // "Priya N <priya@x>" — kept, so a message can greet them
};

export type InvalidAddress = {
  original: string;
  reason: string;
  suggestion?: string;
};

/**
 * Split pasted text into candidate addresses.
 *
 * Accepts newlines, commas and semicolons as separators, and unwraps the
 * "Name <addr@example.com>" form that comes out of a mail client. People
 * paste from everywhere; being fussy about the separator just makes them do
 * the cleanup by hand.
 */
export function splitPasted(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pull the address out of `Name <addr>`, otherwise return the input trimmed. */
export function unwrap(input: string): string {
  const m = input.match(/<([^>]+)>\s*$/);
  return (m ? m[1] : input).trim();
}

/**
 * Suggest a fix for a domain missing its ending, using domains already seen.
 *
 * "deepa@childcare" next to "priya.n@childcare.org" is almost always a
 * truncation, and the fix is knowable from context. A hardcoded typo list
 * (gmial → gmail) would not catch this, because childcare.org is specific to
 * this customer. Nothing is auto-corrected — the admin is shown the guess and
 * decides.
 */
export function suggestDomain(bad: string, knownDomains: Iterable<string>): string | undefined {
  const at = bad.lastIndexOf("@");
  if (at < 0) return undefined;
  const local = bad.slice(0, at);
  const partial = bad.slice(at + 1).toLowerCase();
  if (!partial || partial.includes(".")) return undefined;

  for (const d of knownDomains) {
    if (d !== partial && d.startsWith(partial + ".")) return `${local}@${d}`;
  }
  return undefined;
}

/**
 * The name in "Priya N <priya.n@childcare.org>".
 *
 * It used to be thrown away with the angle brackets, which left the database
 * with a name column nothing ever wrote — a schema implying a feature that did
 * not exist. Kept now, so a broadcast can say "Hi Priya" and mean it.
 */
export function displayName(input: string): string {
  const m = /^\s*(.+?)\s*<[^>]+>\s*$/.exec(input);
  if (!m) return "";
  return m[1].replace(/^["']|["']$/g, "").trim().slice(0, 80);
}

export function validate(input: string, knownDomains: Iterable<string> = []):
  | { ok: true; email: string }
  | { ok: false; reason: string; suggestion?: string } {
  const candidate = unwrap(input);

  if (!candidate) return { ok: false, reason: "Empty" };
  if (!candidate.includes("@")) {
    return { ok: false, reason: "No @ — this is not an email address" };
  }
  if ((candidate.match(/@/g) ?? []).length > 1) {
    return { ok: false, reason: "More than one @" };
  }
  if (/\s/.test(candidate)) {
    return { ok: false, reason: "Contains a space" };
  }

  const email = candidate.toLowerCase();
  if (!EMAIL_RE.test(email)) {
    const domain = email.slice(email.lastIndexOf("@") + 1);
    if (domain && !domain.includes(".")) {
      return {
        ok: false,
        reason: `"${domain}" has no domain ending`,
        suggestion: suggestDomain(email, knownDomains),
      };
    }
    return { ok: false, reason: "Not a valid email address" };
  }

  return { ok: true, email };
}

export type Buckets = {
  /** Valid, not already present, not suppressed — these get written. */
  toAdd: ParsedAddress[];
  /** Already on this list. Carries when, so the admin can see it was intentional. */
  alreadyOnList: { email: string; addedAt: string | null }[];
  /** Appeared more than once in what was pasted. Counted once, reported once. */
  repeatedInPaste: string[];
  /** Failed validation. */
  invalid: InvalidAddress[];
  /** Globally suppressed — unsubscribed, hard bounced or complained. */
  suppressed: { email: string; reason: string }[];
};

/**
 * Classify a pasted blob into the five buckets the review screen shows.
 *
 * Order matters. An address that is BOTH already on the list and suppressed is
 * reported as suppressed, because that is the fact the admin needs to act on —
 * "it's already there" would imply it will be mailed.
 */
export function classify(
  raw: string,
  existing: Map<string, string | null>,     // email → added date
  suppressed: Map<string, string>,          // email → reason
): Buckets {
  const buckets: Buckets = {
    toAdd: [], alreadyOnList: [], repeatedInPaste: [], invalid: [], suppressed: [],
  };

  // Domains already known — from the list, plus valid ones in this paste —
  // are what make a suggestion possible.
  const knownDomains = new Set<string>();
  for (const e of existing.keys()) {
    const d = e.slice(e.lastIndexOf("@") + 1);
    if (d) knownDomains.add(d);
  }
  const parts = splitPasted(raw);
  for (const p of parts) {
    const v = validate(p);
    if (v.ok) knownDomains.add(v.email.slice(v.email.lastIndexOf("@") + 1));
  }

  const seen = new Set<string>();

  for (const part of parts) {
    const v = validate(part, knownDomains);

    if (!v.ok) {
      buckets.invalid.push({ original: part, reason: v.reason, suggestion: v.suggestion });
      continue;
    }

    const { email } = v;

    if (seen.has(email)) {
      if (!buckets.repeatedInPaste.includes(email)) buckets.repeatedInPaste.push(email);
      continue;
    }
    seen.add(email);

    const supReason = suppressed.get(email);
    if (supReason) {
      buckets.suppressed.push({ email, reason: supReason });
      continue;
    }

    if (existing.has(email)) {
      buckets.alreadyOnList.push({ email, addedAt: existing.get(email) ?? null });
      continue;
    }

    buckets.toAdd.push({ original: part, email, name: displayName(part) });
  }

  return buckets;
}
