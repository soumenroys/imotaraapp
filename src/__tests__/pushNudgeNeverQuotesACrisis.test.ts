/**
 * A push notification must never quote someone's crisis back to them.
 *
 * 🔴 FOUND 2026-10-10, live in production. `api/push/cron` runs daily and
 * sends a re-engagement nudge to anyone silent for 48h, personalising the body
 * with a 50-character snippet of their last message so that — in the route's
 * own words — "it feels like Imotara remembers".
 *
 * ⛔ It had no crisis gate. So the most private sentence someone has ever typed
 * could be quoted back on a LOCK SCREEN, readable by whoever picks up the
 * phone, two days later, with nobody there to respond. "Last time you
 * mentioned wanting to end it — how are you now?" is not a re-engagement
 * nudge; it is a breach of the one confidence this product exists to hold.
 *
 * 🔑 The nudge still goes out. Only the personalisation is dropped, because
 * going silent would mean the people who most need a gentle "I'm still here"
 * are the only ones who never get one.
 *
 * ⚠️ Gated on the whole fetched message window, not just the quoted sentence:
 * someone can say "I want to end it" and then "ok goodnight", and quoting the
 * second while the first sits two messages above it is the same failure.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildNudge } from "@/app/api/push/cron/route";
import { getNudgeLang, pick } from "@/lib/imotara/nudgeStrings";

/** Is this the generic body, i.e. was personalisation dropped? */
function isGeneric(body: string, lang?: string): boolean {
    const L = getNudgeLang(lang);
    const variants = Array.isArray(L.gb) ? L.gb : [L.gb];
    return variants.includes(body);
}

describe("🔴 a crisis in the window is NEVER quoted", () => {
    const CRISES: Array<[string, string]> = [
        ["English",    "I want to die, nothing helps anymore"],
        ["Bengali",    "আমি মরতে চাই"],
        ["Hindi",      "मैं मरना चाहता हूँ"],
        ["Spanish",    "quiero morir"],
        ["Japanese",   "死にたい"],
        ["Arabic",     "أريد أن أموت"],
        ["Russian",    "я хочу умереть"],
        ["self-harm",  "I cut myself again last night"],
        ["assault",    "someone raped me"],
        ["bare word",  "suicide"],
    ];

    it.each(CRISES)("%s — the body is generic, not a quote", (_what, msg) => {
        const n = buildNudge(msg, "en", [msg]);
        expect(isGeneric(n.body)).toBe(true);
        // and the words themselves never appear
        expect(n.body).not.toContain(msg.slice(0, 12));
    });

    it("⚠️ a crisis EARLIER in the window blocks a benign last message", () => {
        // The case a last-message-only check would miss, and the likeliest
        // real shape: the crisis, then something ordinary, then silence.
        const n = buildNudge("ok goodnight", "en", [
            "ok goodnight",
            "I don't want to live anymore",
        ]);
        expect(isGeneric(n.body)).toBe(true);
        expect(n.body).not.toContain("goodnight");
    });

    it("🔑 …but the nudge is still SENT — silence would be worse", () => {
        const n = buildNudge("I want to die", "en", ["I want to die"]);
        expect(n.title).toBeTruthy();
        expect(n.body).toBeTruthy();
        expect(n.body.length).toBeGreaterThan(10);
    });

    it("⛔ and it stays generic in the person's own language", () => {
        for (const [lang, msg] of [["bn", "আমি মরতে চাই"], ["es", "quiero morir"], ["hi", "मैं मरना चाहता हूँ"]] as const) {
            const n = buildNudge(msg, lang, [msg]);
            expect(isGeneric(n.body, lang), `${lang} must fall back to ITS generic body`).toBe(true);
        }
    });
});

describe("⚖️ the feature still works for everyone else", () => {
    it("an ordinary message IS quoted — that is the point of the nudge", () => {
        const n = buildNudge("work has been really stressful this week", "en",
                             ["work has been really stressful this week"]);
        expect(isGeneric(n.body)).toBe(false);
        expect(n.body).toContain("work has been really stressful");
    });

    it("a hard but non-crisis message is still quoted", () => {
        // ⚠️ The regression that would matter: over-blocking turns this into a
        // generic broadcast. Sadness and exhaustion are what this app is FOR.
        for (const msg of [
            "I feel very tired today",
            "আমার আজ খুব ক্লান্ত লাগছে",
            "my mum is in hospital and I'm scared",
            "I had a fight with my partner",
        ]) {
            const n = buildNudge(msg, "en", [msg]);
            expect(isGeneric(n.body), `"${msg}" should still personalise`).toBe(false);
        }
    });

    it("no last message ⇒ generic, unchanged behaviour", () => {
        expect(isGeneric(buildNudge(undefined, "en").body)).toBe(true);
        expect(isGeneric(buildNudge("", "en").body)).toBe(true);
    });

    it("an empty window falls back to the quoted message alone", () => {
        // Defensive: if the window is not supplied, the gate must still run on
        // what we are about to quote, rather than silently passing.
        const n = buildNudge("I want to die", "en", []);
        expect(isGeneric(n.body)).toBe(true);
    });
});

describe("⚠️ the premise, pinned in the route", () => {
    const SRC = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/push/cron/route.ts"), "utf8");

    it("the gate uses the shared crisis detector, not a local regex", () => {
        expect(SRC).toMatch(/import \{ isCrisisTier2 \} from "@\/lib\/emotion\/keywordMaps";/);
        expect(SRC).toMatch(/window\.some\(\(m\) => isCrisisTier2\(m\)\)/);
    });

    it("…and POST passes the whole window, not just the last message", () => {
        expect(SRC).toMatch(/recentMessagesMap\.get\(row\.user_id\) \?\? \[\]/);
    });

    it("⛔ the snippet is only built AFTER the gate has passed", () => {
        // Order matters: a snippet computed first and blanked later is one
        // refactor away from leaking.
        const i = SRC.indexOf("if (window.some((m) => isCrisisTier2(m))) return generic;");
        const j = SRC.indexOf("const snippet = truncateToWord(");
        expect(i).toBeGreaterThan(-1);
        expect(j).toBeGreaterThan(i);
    });
});
