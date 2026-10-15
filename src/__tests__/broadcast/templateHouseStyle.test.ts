/**
 * The template house style, enforced rather than hoped for.
 *
 * 🔴 WHY THIS FILE EXISTS. Gmail routes mail to Promotions on the signals that
 * make an email look like a campaign — hero images, CTA buttons, many links,
 * promotional vocabulary. The owner's requirement on 2026-10-15 was explicitly
 * "attractive, but should not be treated as spam or promotional", and those two
 * pull against each other. The resolution was: warm WORDING, no campaign
 * FURNITURE. That resolution is worth nothing unless the next person writing a
 * template is held to it, which is what these assertions are for.
 *
 * ⚠️ The stakes are higher than a tab. Measured the same day: 20.6% bounce
 * rate, 10.2% hard. With reputation already that thin, mail that merely looks
 * like bulk marketing risks Spam rather than Promotions — and the domain's
 * reputation is shared with password resets, org invites and payment receipts.
 *
 * 🔑 THE QUESTION RULE IS THE IMPORTANT ONE. 233 broadcasts have been
 * delivered and not one person has ever replied. A reply is the strongest
 * signal a provider has that a sender is wanted, so every template must ask
 * something answerable. It is also simply more courteous than broadcasting at
 * people.
 */

import { describe, it, expect } from "vitest";
import { TEMPLATES, AUDIENCES, templatesFor, templateById } from "@/lib/broadcast/templates";
import { parse, renderHtml, renderText } from "@/lib/broadcast/markup";

describe("📋 the catalogue is complete and well-formed", () => {
    it("5 audiences × 10 templates = 50", () => {
        expect(AUDIENCES).toHaveLength(5);
        for (const a of AUDIENCES) expect(templatesFor(a)).toHaveLength(10);
        expect(TEMPLATES).toHaveLength(50);
    });

    it("every id is unique and findable", () => {
        const ids = TEMPLATES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const t of TEMPLATES) expect(templateById(t.id)).toBe(t);
    });

    it("every id is prefixed with its audience", () => {
        for (const t of TEMPLATES) expect(t.id.startsWith(`${t.audience}-`)).toBe(true);
    });

    it("every template has a subject, a body and a usage note", () => {
        for (const t of TEMPLATES) {
            expect(t.subject.trim().length, t.id).toBeGreaterThan(10);
            expect(t.body.trim().length, t.id).toBeGreaterThan(200);
            expect(t.note.trim().length, t.id).toBeGreaterThan(10);
        }
    });
});

describe("⛔ NO CAMPAIGN FURNITURE — the Promotions-tab signals", () => {
    it("no CTA buttons", () => {
        // `[[Label]](url)` is the composer's button syntax. A coloured button
        // is one of the most reliable Promotions signals there is.
        const bad = TEMPLATES.filter((t) => /\[\[[^\]]+\]\]\(/.test(t.body));
        expect(bad.map((t) => t.id)).toEqual([]);
    });

    it("no images", () => {
        // `![alt](url)`. A hero image is the other reliable signal — and it
        // also breaks the moment a client blocks remote content.
        const bad = TEMPLATES.filter((t) => /!\[[^\]]*\]\(/.test(t.body));
        expect(bad.map((t) => t.id)).toEqual([]);
    });

    it("at most ONE link per template", () => {
        const offenders = TEMPLATES
            .map((t) => [t.id, (t.body.match(/https?:\/\//g) ?? []).length] as const)
            .filter(([, n]) => n > 1);
        expect(offenders).toEqual([]);
    });

    it("⛔ no promotional vocabulary anywhere", () => {
        // Words that classifiers weight and that readers have learned to
        // distrust. Checked against subject AND body.
        const BANNED = [
            "act now", "limited time", "don't miss", "dont miss", "hurry",
            "special offer", "discount", "click here", "buy now", "order now",
            "risk-free", "no obligation", "guaranteed", "100%", "exclusive deal",
            "sign up now", "register now", "best price", "cheap", "winner",
        ];
        const offenders: string[] = [];
        for (const t of TEMPLATES) {
            const hay = `${t.subject} ${t.body}`.toLowerCase();
            for (const w of BANNED) if (hay.includes(w)) offenders.push(`${t.id}: "${w}"`);
        }
        expect(offenders).toEqual([]);
    });
});

describe("✉️ subject lines read like a person wrote them", () => {
    it("no exclamation marks", () => {
        expect(TEMPLATES.filter((t) => t.subject.includes("!")).map((t) => t.id)).toEqual([]);
    });

    it("no SHOUTED words", () => {
        // Two or more consecutive capitals outside an accepted initialism.
        const OK = new Set(["EAP", "NGO", "NRI", "AI", "UK", "US"]);
        const offenders: string[] = [];
        for (const t of TEMPLATES) {
            for (const w of t.subject.match(/\b[A-Z]{2,}\b/g) ?? []) {
                if (!OK.has(w)) offenders.push(`${t.id}: ${w}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("stays short enough not to be truncated in a phone inbox", () => {
        const long = TEMPLATES.filter((t) => t.subject.length > 62)
            .map((t) => `${t.id} (${t.subject.length})`);
        expect(long).toEqual([]);
    });

    it("no two templates share a subject", () => {
        const subs = TEMPLATES.map((t) => t.subject.toLowerCase());
        expect(new Set(subs).size).toBe(subs.length);
    });
});

describe("🔑 every template invites a reply", () => {
    it("ends by asking something answerable", () => {
        // ⚠️ THE POINT OF THE WHOLE EXERCISE. 233 delivered, zero replies.
        // The question must be near the END — a question buried in paragraph
        // two is not an invitation to respond.
        const offenders: string[] = [];
        for (const t of TEMPLATES) {
            const tail = t.body.trim().split("\n").slice(-6).join(" ");
            if (!tail.includes("?")) offenders.push(t.id);
        }
        expect(offenders).toEqual([]);
    });

    it("greets by name, with a fallback so it can never say 'Hello ,'", () => {
        // {{name}} alone renders empty for a recipient with no name on file.
        const offenders = TEMPLATES
            .filter((t) => !/\{\{name\|[^}]+\}\}/.test(t.body))
            .map((t) => t.id);
        expect(offenders).toEqual([]);
    });

    it("is signed by a person", () => {
        const offenders = TEMPLATES
            .filter((t) => !/—\s*Suchismita/.test(t.body))
            .map((t) => t.id);
        expect(offenders).toEqual([]);
    });
});

describe("⚠️ honest about what Imotara is", () => {
    it("⛔ never CLAIMS to be therapy", () => {
        // ⚠️ Deliberately a claim-shaped pattern, not the bare word. The first
        // version of this test banned the substring "diagnos" and duly failed
        // on *"It does not diagnose"* — which is precisely the sentence we
        // want kept. A banned-word list cannot tell an assertion from its
        // negation, so match the assertion's SHAPE instead.
        const CLAIMS = [
            /\b(is|as|provides?|offers?|delivers?)\s+(a\s+|real\s+)?therapy\b/i,
            /\btherapy\s+(app|service|platform|tool)\b/i,
            /\bwill\s+(cure|heal|fix)\s+you\b/i,
            /\b(cures?|treats?|diagnoses)\s+(your\s+)?(depression|anxiety|illness)\b/i,
            /\breplaces?\s+(your\s+)?(therapist|counsellor|counselor|doctor)\b/i,
        ];
        const offenders: string[] = [];
        for (const t of TEMPLATES) {
            const hay = `${t.subject} ${t.body}`;
            for (const re of CLAIMS) if (re.test(hay)) offenders.push(`${t.id}: ${re}`);
        }
        expect(offenders).toEqual([]);
    });

    it("✅ and where therapy IS mentioned, it is to deny it", () => {
        // The positive half: several templates say "not therapy" on purpose.
        // This pins that the denial survives an edit, rather than merely that
        // no claim was added.
        const mentions = TEMPLATES.filter((t) => /therapy/i.test(t.body));
        expect(mentions.length).toBeGreaterThan(3);
        for (const t of mentions) {
            expect(t.body, t.id).toMatch(/\b(not|isn't|never|won't|doesn't)\b[^.]*therapy|therapy[^.]*\b(not|never)\b/i);
        }
    });

    it("🔴 nothing implies it suits anyone under 13", () => {
        // Minimum age is 13, parental consent under 18 — a template implying
        // otherwise would contradict the Terms the consent gate makes people
        // accept, the exact contradiction found and fixed on 2026-10-13.
        //
        // ⚠️ NARROWED from a bare "children", which fired on the eldercare
        // templates where it means a RESIDENT'S ADULT CHILDREN. Banning that
        // word would have forced worse copy to satisfy a careless test.
        const MINORS = [
            /\byoung children\b/i, /\bkids\b/i, /\btoddler/i, /\bprimary school\b/i,
            /\bunder 13\b/i, /\bschoolchildren\b/i, /\bchildren['’]s? (wellbeing|mental)\b/i,
        ];
        const offenders: string[] = [];
        for (const t of TEMPLATES) {
            const hay = `${t.subject} ${t.body}`;
            for (const re of MINORS) if (re.test(hay)) offenders.push(`${t.id}: ${re}`);
        }
        expect(offenders).toEqual([]);
    });
});

describe("🛠️ every template actually renders", () => {
    it("parses with no malformed blocks", () => {
        // `literal` is what the parser emits when image or button syntax is
        // broken — it would ship the raw markup to a recipient.
        for (const t of TEMPLATES) {
            const kinds = parse(t.body).map((b) => b.k);
            expect(kinds, t.id).not.toContain("literal");
        }
    });

    it("produces non-empty HTML and a plain-text alternative", () => {
        for (const t of TEMPLATES) {
            const html = renderHtml(t.body);
            const text = renderText(t.body);
            expect(html.length, t.id).toBeGreaterThan(200);
            expect(text.length, t.id).toBeGreaterThan(150);
            // A multipart message whose text part is empty is a spam signal in
            // its own right.
            expect(text.trim(), t.id).not.toBe("");
        }
    });

    it("⛔ no unescaped angle brackets survive into the HTML", () => {
        for (const t of TEMPLATES) {
            expect(renderHtml(t.body), t.id).not.toMatch(/<script/i);
        }
    });
});
