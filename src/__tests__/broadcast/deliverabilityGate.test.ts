/**
 * A domain with no mail server must never reach a recipient list.
 *
 * 🔴 MEASURED 2026-10-15, in production: the broadcast bounce rate was **20.6%**
 * (67 of 325 attempted), of which **33 were HARD — 10.2%**, against a healthy
 * ceiling of about 2%. On 10 October, 12 of 15 sends bounced. Mail providers
 * read a sustained hard-bounce rate as a sender mailing a list they did not
 * earn, and that judgement lands on the whole sending domain — which would take
 * the TRANSACTIONAL mail down with it: password resets, org invites, receipts.
 *
 * ⚠️ Suppression already worked (33 hard bounces → 33 suppressions, never
 * retried). It is a CLEANUP: the address is suppressed only after it has
 * bounced, by which time the damage is done. This gate is the other half.
 *
 * 🔑 THE ASYMMETRY IS THE WHOLE DESIGN, and it is what these tests mostly pin.
 * Wrongly REJECTING a good address silently costs a real subscriber the admin
 * meant to reach. Wrongly ACCEPTING a dead one costs one bounce that
 * suppression then catches. So every ambiguous DNS answer must fail OPEN.
 *
 * ⛔ DNS is mocked rather than live. A test that asks the real resolver would
 * pass or fail on the network rather than on the logic, and could not exercise
 * SERVFAIL or a null MX at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveMx = vi.fn();
const resolve4 = vi.fn();
const resolve6 = vi.fn();
const resolveAny = vi.fn();

vi.mock("node:dns", () => ({
    promises: {
        resolveMx: (d: string) => resolveMx(d),
        resolve4: (d: string) => resolve4(d),
        resolve6: (d: string) => resolve6(d),
        resolveAny: (d: string) => resolveAny(d),
    },
}));

const { checkDomain, checkEmailDomains, domainOf } =
    await import("@/lib/broadcast/deliverability");

/** A DNS error carrying the code Node actually sets. */
function dnsError(code: string) {
    const e = new Error(code) as NodeJS.ErrnoException;
    e.code = code;
    return e;
}

beforeEach(() => {
    resolveMx.mockReset(); resolve4.mockReset();
    resolve6.mockReset(); resolveAny.mockReset();
});

describe("🔴 a definite 'nothing can receive mail here' is refused", () => {
    it("a domain that does not exist at all ⇒ no_mail_server", async () => {
        resolveMx.mockRejectedValue(dnsError("ENOTFOUND"));
        resolve4.mockRejectedValue(dnsError("ENOTFOUND"));
        resolve6.mockRejectedValue(dnsError("ENOTFOUND"));
        resolveAny.mockRejectedValue(dnsError("ENOTFOUND"));
        expect(await checkDomain("not-a-real-domain.invalid")).toBe("no_mail_server");
    });

    it("⛔ a NULL MX ('.') is an explicit refusal, not a mail server", async () => {
        // RFC 7505. A domain publishing `0 .` is stating it sends and receives
        // no mail. Counting it as "has MX" would be the easiest bug to write
        // here, because the array is non-empty.
        resolveMx.mockResolvedValue([{ exchange: ".", priority: 0 }]);
        expect(await checkDomain("no-mail.example")).toBe("no_mail_server");
    });

    it("an empty or domain-less string is refused without any lookup", async () => {
        expect(await checkDomain("")).toBe("no_mail_server");
        expect(await checkDomain("localhost")).toBe("no_mail_server");
        expect(resolveMx).not.toHaveBeenCalled();
    });
});

describe("✅ anything that can take mail is allowed", () => {
    it("a normal MX ⇒ deliverable", async () => {
        resolveMx.mockResolvedValue([{ exchange: "mx1.hostinger.com", priority: 5 }]);
        expect(await checkDomain("imotara.com")).toBe("deliverable");
    });

    it("🔑 no MX but an A record ⇒ deliverable (RFC 5321 implicit MX)", async () => {
        // ⚠️ The expensive mistake this prevents. Plenty of small charities and
        // NGOs — exactly this product's list — run mail on a host with an
        // address record and no MX. Rejecting them would quietly delete the
        // real audience while claiming to protect it.
        resolveMx.mockResolvedValue([]);
        resolve4.mockResolvedValue(["203.0.113.10"]);
        expect(await checkDomain("small-charity.example")).toBe("deliverable");
    });

    it("no MX, no A, but AAAA ⇒ deliverable", async () => {
        resolveMx.mockResolvedValue([]);
        resolve4.mockResolvedValue([]);
        resolve6.mockResolvedValue(["2001:db8::1"]);
        expect(await checkDomain("v6-only.example")).toBe("deliverable");
    });
});

describe("🔑 THE ASYMMETRY — every ambiguous answer fails OPEN", () => {
    it("SERVFAIL ⇒ unknown, never no_mail_server", async () => {
        resolveMx.mockRejectedValue(dnsError("SERVFAIL"));
        resolve4.mockRejectedValue(dnsError("SERVFAIL"));
        resolve6.mockRejectedValue(dnsError("SERVFAIL"));
        resolveAny.mockRejectedValue(dnsError("SERVFAIL"));
        expect(await checkDomain("flaky.example")).toBe("unknown");
    });

    it("a timeout ⇒ unknown", async () => {
        resolveMx.mockRejectedValue(dnsError("ETIMEOUT"));
        resolve4.mockRejectedValue(dnsError("ETIMEOUT"));
        resolve6.mockRejectedValue(dnsError("ETIMEOUT"));
        resolveAny.mockRejectedValue(dnsError("ETIMEOUT"));
        expect(await checkDomain("slow.example")).toBe("unknown");
    });

    it("resolves something, just nothing mailable ⇒ unknown", async () => {
        resolveMx.mockResolvedValue([]);
        resolve4.mockResolvedValue([]);
        resolve6.mockResolvedValue([]);
        resolveAny.mockResolvedValue([{ type: "TXT" }]);
        expect(await checkDomain("txt-only.example")).toBe("unknown");
    });

    it("⛔ it NEVER throws, whatever DNS does", async () => {
        resolveMx.mockImplementation(() => { throw new Error("boom"); });
        resolve4.mockImplementation(() => { throw new Error("boom"); });
        resolve6.mockImplementation(() => { throw new Error("boom"); });
        resolveAny.mockImplementation(() => { throw new Error("boom"); });
        await expect(checkDomain("explodes.example")).resolves.toBe("unknown");
    });
});

describe("⚠️ one lookup per DISTINCT domain, not per address", () => {
    it("200 addresses across 2 domains ⇒ 2 lookups", async () => {
        // A pasted NGO batch is a handful of domains repeated many times.
        // Per-address lookups would be ~100x the DNS traffic for identical
        // answers, and some resolvers rate-limit that into failures — which,
        // given the fail-open rule, would silently disable the whole gate.
        resolveMx.mockResolvedValue([{ exchange: "mx.example", priority: 5 }]);
        const emails = [
            ...Array.from({ length: 100 }, (_, i) => `a${i}@one.example`),
            ...Array.from({ length: 100 }, (_, i) => `b${i}@two.example`),
        ];
        const verdicts = await checkEmailDomains(emails);
        expect(resolveMx).toHaveBeenCalledTimes(2);
        expect(verdicts.get("one.example")).toBe("deliverable");
        expect(verdicts.get("two.example")).toBe("deliverable");
    });

    it("domains are compared case-insensitively", async () => {
        resolveMx.mockResolvedValue([{ exchange: "mx.example", priority: 5 }]);
        await checkEmailDomains(["A@Example.COM", "b@example.com"]);
        expect(resolveMx).toHaveBeenCalledTimes(1);
        expect(resolveMx).toHaveBeenCalledWith("example.com");
    });

    it("domainOf matches how the map is keyed", async () => {
        expect(domainOf("Someone@Example.COM ")).toBe("example.com");
        expect(domainOf("weird@sub.domain.co.uk")).toBe("sub.domain.co.uk");
    });
});

describe("⛔ the route rejects ONLY a definite verdict", () => {
    it("the gate tests for no_mail_server, never for 'not deliverable'", async () => {
        // 🔑 The regression this guards is a one-word change with a large blast
        // radius: `!== "deliverable"` instead of `=== "no_mail_server"` would
        // start dropping every address whose DNS merely timed out, and nobody
        // would notice because the addresses just quietly stop being added.
        const fs = await import("fs");
        const path = await import("path");
        const src = fs.readFileSync(path.join(process.cwd(),
            "src/app/api/admin/broadcast/lists/[id]/recipients/route.ts"), "utf8");
        expect(src).toMatch(/=== "no_mail_server"/);
        expect(src).not.toMatch(/!== "deliverable"/);
    });

    it("…and the refused addresses are reported, not silently dropped", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const src = fs.readFileSync(path.join(process.cwd(),
            "src/app/api/admin/broadcast/lists/[id]/recipients/route.ts"), "utf8");
        // Both the dry run AND the write must carry it back.
        expect(src).toMatch(/dryRun: true, buckets, undeliverable/);
        expect(src).toMatch(/\{ added, buckets, undeliverable \}/);
    });
});
