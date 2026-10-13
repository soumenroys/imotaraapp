import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CONSENT_COPY_BY_LANG, getConsentCopy, MINIMUM_AGE } from "@/lib/legal/consentCopy";
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

    it("states the minimum age in every translation", () => {
        // A gate that says "I am 18 or older" in English and omits the number
        // elsewhere is not an age gate in those languages.
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            const hasWesternDigits = copy.agree.includes(String(MINIMUM_AGE));
            const hasOdiaDigits = copy.agree.includes("୧୮");
            const hasBengaliDigits = copy.agree.includes("১৮");
            expect(
                hasWesternDigits || hasOdiaDigits || hasBengaliDigits,
                `${lang} does not state the age`,
            ).toBe(true);
        }
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
        expect(TERMS_VERSION).toBe(printed);
    });

    it("⛔ /terms actually contains the clauses the gate makes people accept", () => {
        // The gate's checkbox says "I am 18 or older and I agree to the Terms".
        // If /terms does not state an age, a person is agreeing to something the
        // document does not say.
        const page = fs.readFileSync(path.join(process.cwd(), "src/app/terms/page.tsx"), "utf8");
        expect(page).toMatch(/18 years of age or older/);
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
