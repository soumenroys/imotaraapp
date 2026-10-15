import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CONSENT_COPY_BY_LANG, getConsentCopy, MINIMUM_AGE, PARENTAL_CONSENT_BELOW } from "@/lib/legal/consentCopy";
import { CRISIS_BANNER_BY_LANG } from "@/lib/safety/crisisCopy";
import {
    TERMS_VERSION,
    buildAcceptance,
    hasAcceptedCurrentTerms,
    parseAcceptance,
} from "@/lib/legal/termsVersion";

describe("the consent gate speaks every language the crisis card does", () => {
    // The whole point: a person who gets a Bengali crisis card must not have
    // been shown an English consent screen. Two catalogues that are supposed to
    // match have drifted in this codebase before — this pins them together.
    it("covers exactly the crisis card's language set", () => {
        const consent = Object.keys(CONSENT_COPY_BY_LANG).sort();
        const crisis = Object.keys(CRISIS_BANNER_BY_LANG).sort();
        expect(consent).toEqual(crisis);
    });

    it("has no empty string in any language", () => {
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            for (const [field, value] of Object.entries(copy)) {
                expect(value.trim(), `${lang}.${field} is empty`).not.toBe("");
            }
        }
    });

    it("keeps both link placeholders in every translation", () => {
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            expect(copy.agree, `${lang} lost {terms}`).toContain("{terms}");
            expect(copy.agree, `${lang} lost {privacy}`).toContain("{privacy}");
        }
    });

    it("🔴 states BOTH the minimum age and the parental-consent age, in every translation", () => {
        // A gate that says the age in English and omits it elsewhere is not an
        // age gate in those languages.
        //
        // 🔑 WHY BOTH NUMBERS. This test used to check for ONE number —
        // String(MINIMUM_AGE) — and MINIMUM_AGE was wrong (18, when the owner
        // had decided 13 on 2026-10-13). It passed anyway, because every
        // translation contains "18" in the parental-consent half of the same
        // sentence. The guard on the minimum age was being satisfied by a
        // different number sitting next to it.
        //
        // ⛔ Requiring both makes that coincidence impossible: 13 and 18 cannot
        // stand in for each other.
        const DIGITS: Record<string, (n: number) => string> = {
            or: (n) => String(n).replace(/[0-9]/g, (d) => "୦୧୨୩୪୫୬୭୮୯"[Number(d)]),
            bn: (n) => String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]),
        };
        const missing: string[] = [];
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            const local = DIGITS[lang] ?? ((n: number) => String(n));
            if (!copy.agree.includes(local(MINIMUM_AGE))) missing.push(`${lang}: minimum age`);
            if (!copy.agree.includes(local(PARENTAL_CONSENT_BELOW))) missing.push(`${lang}: parental age`);
        }
        expect(missing).toEqual([]);
    });

    it("⛔ the constants match the owner's decision, not a nearby number", () => {
        expect(MINIMUM_AGE).toBe(13);
        expect(PARENTAL_CONSENT_BELOW).toBe(18);
    });

    it("⛔ keeps the DISCLAIMER in every language, not just the warm line", () => {
        // The warm line leads visually. If a translation ever carried the warm
        // line but lost `body`, the gate would be pure marketing in that
        // language and would stop doing its legal job — silently, and only for
        // non-English speakers.
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            expect(copy.warm.trim(), `${lang} has no warm line`).not.toBe("");
            expect(copy.body.trim(), `${lang} has no disclaimer`).not.toBe("");
            expect(copy.emergencyLead.trim(), `${lang} has no emergency line`).not.toBe("");
        }
    });

    it("falls back to English for an unknown language, and never throws on auto", () => {
        expect(getConsentCopy("xx")).toBe(CONSENT_COPY_BY_LANG.en);
        expect(getConsentCopy(null)).toBe(CONSENT_COPY_BY_LANG.en);
        expect(getConsentCopy("auto")).toBe(CONSENT_COPY_BY_LANG.en);
        expect(getConsentCopy("bn-IN")).toBe(CONSENT_COPY_BY_LANG.bn);
    });
});

describe("an acceptance record is only good for the version it names", () => {
    it("accepts a record for the current version", () => {
        expect(hasAcceptedCurrentTerms(buildAcceptance("web", "bn"))).toBe(true);
    });

    it("REJECTS a record for an older version, so a bump re-prompts", () => {
        const stale = { ...buildAcceptance("web", "en"), version: "2020-01-01" };
        expect(hasAcceptedCurrentTerms(stale)).toBe(false);
    });

    it("rejects nothing-at-all rather than treating it as consent", () => {
        expect(hasAcceptedCurrentTerms(null)).toBe(false);
        expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
    });

    it("records the locale that was actually shown", () => {
        expect(buildAcceptance("ios", "ar").locale).toBe("ar");
        expect(buildAcceptance("android", "").locale).toBe("en");
    });

    it("survives corrupt storage without throwing", () => {
        expect(parseAcceptance("not json")).toBeNull();
        expect(parseAcceptance("")).toBeNull();
        expect(parseAcceptance(null)).toBeNull();
        expect(parseAcceptance(JSON.stringify({ nope: 1 }))).toBeNull();
    });

    it("round-trips through storage", () => {
        const rec = buildAcceptance("web", "hi");
        const back = parseAcceptance(JSON.stringify(rec));
        expect(back).toEqual(rec);
        expect(hasAcceptedCurrentTerms(back)).toBe(true);
    });

    it("⛔ TERMS_VERSION matches the Effective date printed on /terms", () => {
        // These are two copies of one fact. If they drift, an acceptance record
        // names a version that does not match the document a person was shown —
        // which is worse than no record, because it looks like evidence and is
        // not. Bumping one without the other is the exact mistake this catches.
        const page = fs.readFileSync(path.join(process.cwd(), "src/app/terms/page.tsx"), "utf8");
        const m = page.match(/Effective date:\s*([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})/);
        expect(m).not.toBeNull();
        const months: Record<string, string> = {
            Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
            Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
        };
        const printed = `${m![3]}-${months[m![1]]}-${m![2].padStart(2, "0")}`;
        // A revision suffix ("2026-10-13b") is allowed: the Terms can be
        // revised twice in one day, and an acceptance of the earlier draft must
        // never be mistaken for an acceptance of the later one.
        expect(TERMS_VERSION.startsWith(printed)).toBe(true);
        expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}[a-z]?$/);
    });

    it("⛔ /terms actually contains the clauses the gate makes people accept", () => {
        // The gate's checkbox says "I am 18 or older and I agree to the Terms".
        // If /terms does not state an age, a person is agreeing to something the
        // document does not say.
        const page = fs.readFileSync(path.join(process.cwd(), "src/app/terms/page.tsx"), "utf8");
        expect(page).toMatch(/13 years of age or older/);
        expect(page).toMatch(/parent or legal guardian/);
        expect(page).toMatch(/Emergencies and Crisis Situations/);
        expect(page).toMatch(/not an emergency service/);
    });
});

describe("the gate is mounted, and does not trap the pages it links to", () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

    it("is mounted in the root layout", () => {
        const layout = read("src/app/layout.tsx");
        expect(layout).toMatch(/<ConsentGateMount \/>/);
        expect(layout).toMatch(/from "@\/components\/legal\/ConsentGateMount"/);
    });

    it("⛔ never covers /terms or /privacy — the pages it links to", () => {
        // Gating these would mean a person cannot read what they are being
        // asked to agree to: the links would loop straight back into the gate.
        const mount = read("src/components/legal/ConsentGateMount.tsx");
        const m = mount.match(/UNGATED\s*=\s*\[([^\]]+)\]/);
        expect(m).not.toBeNull();
        const list = m![1];
        expect(list).toContain("/terms");
        expect(list).toContain("/privacy");
    });

    it("⛔ never passes \"auto\" through as a language", () => {
        // The same trap that rendered the crisis card in English for everyone
        // on the default setting (a6f167f).
        const mount = read("src/components/legal/ConsentGateMount.tsx");
        expect(mount).toMatch(/!==\s*"auto"/);
    });

    it("records acceptance server-side rather than only on the device", () => {
        const mount = read("src/components/legal/ConsentGateMount.tsx");
        expect(mount).toMatch(/\/api\/legal\/accept/);
    });
});

describe("acquisition copy does not position Imotara against clinical care", () => {
    it("⛔ no page prices Imotara against a counselling or therapy session", () => {
        // A price comparison to counselling implies substitution for clinical
        // care — the one claim the Terms exist to deny, and it sat on the pages
        // aimed at hospitals, schools and care homes. Removed 2026-10-13.
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/data/audiencePages.ts"), "utf8");
        expect(src).not.toMatch(/cost of a (single )?(counselling|counseling|therapy)/i);
        expect(src).not.toMatch(/cheaper than (a )?(counselling|counseling|therapy|therapist)/i);
    });

    it("⛔ the plan NOTE never contradicts the plan TABLE on seat pricing", () => {
        // Institutional pricing IS per seat: the row is named "Institution seat"
        // and costs "₹799 per person per year", and the org table carries
        // seats_purchased / seats_used. A note claiming "not per seat" sat
        // directly above that table saying the opposite — a false claim is
        // worse than the unsubstantiated comparison it replaced.
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/data/audiencePages.ts"), "utf8");
        expect(src).toMatch(/Institution seat/);
        expect(src).toMatch(/per person per year/);
        expect(src).not.toMatch(/not per seat/i);
        expect(src).not.toMatch(/not per resident/i);
        // "on a single plan" reads as one-price-covers-everyone, which is the
        // same false promise in gentler words.
        expect(src).not.toMatch(/supported on a single plan/i);
    });

    it("⛔ no page invites children under 13", () => {
        // The product's own age selectors start at 13-17; the Terms say 13+.
        // A landing page inviting under-13s contradicted both.
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/data/audiencePages.ts"), "utf8");
        expect(src).not.toMatch(/[Cc]hildren under 13 should/);
    });
});

describe("🔴 the web gate outranks every other overlay", () => {
    // The mobile twin of this failed on a wiped Android emulator 2026-10-13:
    // as a sibling <Modal> it was covered by SignInPrompt, so sign-in was
    // reachable without passing the gate. Web does NOT share that bug — CSS
    // z-index is deterministic where Android modal stacking is not — but only
    // while the gate stays the highest. This pins it.
    const OVERLAYS = [
        "src/components/imotara/PWAInstallPrompt.tsx",
        "src/components/imotara/OnboardingTour.tsx",
        "src/components/imotara/FirstVisitBanner.tsx",
        "src/components/imotara/LocalDataNotice.tsx",
        "src/components/imotara/OfflineIndicator.tsx",
    ];

    const maxZ = (file: string): number => {
        const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
        const hits = [...src.matchAll(/z-\[?(\d+)\]?/g)].map((m) => Number(m[1]));
        return hits.length ? Math.max(...hits) : 0;
    };

    it("sits above every sibling overlay mounted in the root layout", () => {
        const gate = maxZ("src/components/legal/ConsentGate.tsx");
        expect(gate).toBeGreaterThan(0);
        for (const f of OVERLAYS) {
            expect(maxZ(f), `${f} is at or above the gate`).toBeLessThan(gate);
        }
    });

    it("covers the whole viewport, so nothing behind is clickable", () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/components/legal/ConsentGate.tsx"), "utf8");
        expect(src).toMatch(/fixed inset-0/);
    });
});
