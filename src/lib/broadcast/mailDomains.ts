// src/lib/broadcast/mailDomains.ts
// Does the address's domain receive mail at all?
//
// 🔴 MEASURED 30 Oct 2026: of 11 bounces on the organisation broadcasts since
// 24 Oct, 5 were to domains with NO mail server (no MX record) — guessed or
// dead addresses that could never be delivered. Resend reports them as SOFT
// bounces, so they were never suppressed and would be mailed again. Every one
// costs sender reputation; the bounce rate was ~12% where mail services start
// distrusting a sender at 4–5%.
//
// ⚠️ A domain with no MX but an A record can still receive mail (RFC 5321
// implicit MX) ⇒ only "neither" counts as dead.
// ⚠️ A DNS failure on OUR side (timeout, SERVFAIL) is NOT a dead domain: a bad
// minute at the resolver must never silently drop a real recipient.

import { promises as dns } from "node:dns";

export type Resolver = {
  mx: (domain: string) => Promise<unknown[]>;
  a: (domain: string) => Promise<unknown[]>;
};

const live: Resolver = { mx: (d) => dns.resolveMx(d), a: (d) => dns.resolve4(d) };

/** The DNS answers that mean "this name has no such record" — everything else is our own failure. */
const NOT_THERE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function has(lookup: () => Promise<unknown[]>): Promise<boolean | null> {
  try {
    return (await lookup()).length > 0;
  } catch (e) {
    return NOT_THERE.has((e as { code?: string }).code ?? "") ? false : null;
  }
}

/** The domains, among these addresses, that cannot receive mail. A domain we could not check is NOT in the set. */
export async function domainsWithoutMail(emails: string[], resolve: Resolver = live): Promise<Set<string>> {
  const domains = [...new Set(emails.map((e) => e.split("@")[1]?.toLowerCase()).filter((d): d is string => !!d))];
  const dead = new Set<string>();
  await Promise.all(
    domains.map(async (d) => {
      const mx = await has(() => resolve.mx(d));
      if (mx !== false) return; // has mail, or we could not tell
      const a = await has(() => resolve.a(d));
      if (a === false) dead.add(d);
    }),
  );
  return dead;
}
