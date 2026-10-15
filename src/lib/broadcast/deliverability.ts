// src/lib/broadcast/deliverability.ts
//
// Can this domain receive mail at all? Asked BEFORE an address is written to a
// list, not after it bounces.
//
// 🔴 WHY THIS EXISTS. Measured 2026-10-15: the broadcast bounce rate was
// **20.6%** (67 of 325 attempted), of which **33 were HARD bounces — 10.2%**.
// The healthy ceiling is around 2%; mail providers read a sustained hard-bounce
// rate as "this sender is mailing a list they did not earn", and that judgement
// lands on the whole domain. On 10 October alone, 12 of 15 sends bounced.
//
// ⚠️ Suppression already exists and works (33 hard bounces → 33 suppressions,
// never retried). But suppression is a CLEANUP: the address is only suppressed
// *after* it has bounced, which means the reputation damage is already done.
// This module is the other half — refusing the address at the door.
//
// ⛔ WHAT THIS CANNOT DO. It proves the DOMAIN can receive mail. It cannot
// prove the MAILBOX exists, which is the other half of hard bounces and needs
// either SMTP probing (unreliable, widely blocked, and rude) or a paid
// verification API. A domain with no mail server is a GUARANTEED hard bounce;
// that is the subset worth catching for free.

import "server-only";
import { promises as dns } from "node:dns";

export type DomainVerdict =
    /** Has MX, or an A/AAAA record that RFC 5321 treats as an implicit MX. */
    | "deliverable"
    /** Resolvable or not, but nothing will ever accept mail for it. */
    | "no_mail_server"
    /** DNS failed in a way that says nothing about the domain. ⚠️ Treated as OK. */
    | "unknown";

/** How long a single domain's DNS lookup may take before we give up on it. */
const TIMEOUT_MS = 3_000;
/** Lookups in flight at once. A paste of 500 addresses must not open 500 sockets. */
const CONCURRENCY = 8;

/**
 * ⚠️ Takes a THUNK, not a promise. `dns.promises.resolveMx` can throw
 * SYNCHRONOUSLY (ERR_INVALID_ARG_TYPE on a malformed host, for one), and a
 * synchronous throw escapes before any `.then` handler exists to catch it —
 * so passing `withTimeout(dns.resolveMx(d), …)` would blow straight past this
 * function and out of checkDomain, breaking its "never throws" contract.
 * Caught by the test that asserts it never throws, not by review.
 */
function withTimeout<T>(run: () => Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), ms);
        let p: Promise<T>;
        try {
            p = run();
        } catch {
            clearTimeout(t);
            resolve(null);
            return;
        }
        p.then(
            (v) => { clearTimeout(t); resolve(v); },
            () => { clearTimeout(t); resolve(null); },
        );
    });
}

/**
 * ⛔ NEVER THROWS, and never returns "no_mail_server" on a transient failure.
 *
 * 🔑 THE BIAS IS DELIBERATE AND ASYMMETRIC. Wrongly rejecting a good address
 * costs a real subscriber the admin meant to reach, and they will never know
 * why. Wrongly accepting a dead one costs a single bounce that suppression
 * then catches. So anything ambiguous — SERVFAIL, timeout, a DNS outage on our
 * side — resolves to "unknown", which is allowed through.
 *
 * Only ENOTFOUND/ENODATA, which mean the DNS answered definitively that there
 * is nothing there, produce "no_mail_server".
 */
export async function checkDomain(domain: string): Promise<DomainVerdict> {
    const d = domain.trim().toLowerCase();
    if (!d || !d.includes(".")) return "no_mail_server";

    const mx = await withTimeout(() => dns.resolveMx(d), TIMEOUT_MS);
    // A non-empty MX set is the normal, decisive yes. Note the filter: some
    // domains publish a single "." MX, which is RFC 7505's explicit "this
    // domain sends no mail" — a null MX is a definite NO, not a yes.
    if (mx && mx.length > 0) {
        const real = mx.filter((r) => r.exchange && r.exchange !== "." && r.exchange.trim() !== "");
        return real.length > 0 ? "deliverable" : "no_mail_server";
    }

    // No MX is not yet a verdict. RFC 5321 §5.1: a host with an address record
    // and no MX still accepts mail there. Plenty of small charities are set up
    // exactly this way, and rejecting them would be the expensive mistake.
    const a = await withTimeout(() => dns.resolve4(d), TIMEOUT_MS);
    if (a && a.length > 0) return "deliverable";
    const aaaa = await withTimeout(() => dns.resolve6(d), TIMEOUT_MS);
    if (aaaa && aaaa.length > 0) return "deliverable";

    // Everything came back empty. Distinguish "the domain does not exist" from
    // "we could not find out", because only the first is actionable.
    try {
        await dns.resolveAny(d);
        return "unknown";          // something resolves, just nothing we can mail
    } catch (e) {
        const code = (e as NodeJS.ErrnoException)?.code;
        return code === "ENOTFOUND" || code === "ENODATA" ? "no_mail_server" : "unknown";
    }
}

/**
 * Verdicts for many addresses, one lookup per DISTINCT domain.
 *
 * A pasted list is overwhelmingly a handful of domains repeated — an NGO batch
 * might be 200 addresses across 30 domains. Looking up per address would be
 * ~7x the DNS traffic for identical answers.
 */
export async function checkEmailDomains(
    emails: readonly string[],
): Promise<Map<string, DomainVerdict>> {
    const domains = [...new Set(
        emails
            .map((e) => e.slice(e.lastIndexOf("@") + 1).trim().toLowerCase())
            .filter(Boolean),
    )];

    const out = new Map<string, DomainVerdict>();
    let i = 0;
    async function worker() {
        while (i < domains.length) {
            const d = domains[i++];
            out.set(d, await checkDomain(d));
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, domains.length) }, worker));
    return out;
}

/** The domain half of an address, normalised the same way checkEmailDomains does. */
export function domainOf(email: string): string {
    return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}
