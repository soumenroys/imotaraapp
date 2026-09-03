// src/lib/broadcast/entry.ts
// Helpers for typing addresses in one at a time (as opposed to pasting a list).
//
// The point of the row-based entry is that the two halves of an address have
// different rules and different failure modes. The part before the @ is typed
// once and is where typos happen; the part after it repeats across dozens of
// addresses and is where a single slip — "gmial.com" — quietly poisons a whole
// batch. So the domain is chosen, not typed, unless someone deliberately asks
// to type it.

/** Domains worth offering first, weighted to who actually writes to Imotara. */
export const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "icloud.com",
  "protonmail.com",
  "imotara.com",
] as const;

/**
 * Strip anything that cannot appear before the @.
 *
 * Filtering as they type, rather than complaining afterwards, means a pasted
 * "Priya N <priya.n@childcare.org>" cannot half-land in the box and look
 * plausible. The set is the practical one every mail provider accepts; the
 * exotic quoted-string forms RFC 5321 permits are excluded on purpose, since
 * offering them here would be inviting an address no provider will deliver to.
 */
export function cleanLocalPart(input: string): string {
  return input.replace(/[^A-Za-z0-9._%+\-]/g, "");
}

/** Strip anything that cannot appear in a domain, and normalise the case. */
export function cleanDomain(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9.\-]/g, "");
}

export type Row = { local: string; domain: string; custom: string };

export function rowDomain(r: Row): string {
  return (r.domain === "__custom__" ? r.custom : r.domain).trim();
}

/** The rows that are complete enough to be worth sending to the API. */
export function composeRows(rows: Row[]): string {
  return rows
    .map((r) => ({ local: r.local.trim(), domain: rowDomain(r) }))
    .filter((r) => r.local && r.domain)
    .map((r) => `${r.local}@${r.domain}`)
    .join("\n");
}

/** Per-source wording for the consent detail, used as a starting point. */
export const SOURCE_DETAIL: Record<string, string> = {
  event:        "Communication from an event or demonstration",
  meeting:      "Communication from a meeting or visit",
  email:        "Communication by email",
  whatsapp:     "Communication on WhatsApp",
  social:       "Communication from Social Media",
  website_form: "Filled in the form on imotara.com",
  phone:        "Communication by phone",
  app_signup:   "Signed up in the Imotara app",
};
