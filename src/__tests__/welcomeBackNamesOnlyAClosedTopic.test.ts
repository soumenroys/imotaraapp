/**
 * 🌿 #16 C (owner, 10 Nov 2026): "Welcome back. Last time we talked about:
 * <topic>." — TOPIC ONLY, 17 topics, from a closed list.
 *
 * ⛔ The model may only pick a key; it never writes the words on the card.
 * ⛔ Never after a crisis; never sensitive topics (not in the list).
 * ⛔ Separate from the reply: /api/chat-reply is not involved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    SESSION_TOPICS, TOPIC_LABELS, WELCOME, welcomeBackText, shouldShowWelcomeBack,
    WELCOME_BACK_AFTER_MS, isSessionTopic, type LastSession,
} from "@/lib/imotara/welcomeBackTopic";

const LANGS = ["en", "hi", "bn", "mr", "ta", "te", "gu", "kn", "ml", "pa", "or", "ur", "ar", "ru", "zh", "ja", "es", "fr", "de", "pt", "id", "he"];
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the closed list — 17 topics, every language", () => {
    it("17 topics, owner-approved", () => {
        expect(SESSION_TOPICS).toHaveLength(17);
        expect(SESSION_TOPICS).toEqual(expect.arrayContaining(["work", "good_news", "overthinking", "caring", "big_change"]));
    });
    it("⛔ no sensitive topic can ever be named on the card", () => {
        for (const bad of ["self_harm", "suicide", "abuse", "addiction", "sexuality", "crisis"]) expect(isSessionTopic(bad)).toBe(false);
    });
    it("all 22 languages: every topic label and every card line written", () => {
        expect(Object.keys(TOPIC_LABELS).sort()).toEqual([...LANGS].sort());
        expect(Object.keys(WELCOME).sort()).toEqual([...LANGS].sort());
        for (const l of LANGS) {
            for (const k of SESSION_TOPICS) expect(TOPIC_LABELS[l][k].trim().length).toBeGreaterThan(1);
            const w = WELCOME[l];
            for (const v of [w.lead, w.ask, w.pick, w.fresh]) expect(v.trim().length).toBeGreaterThan(1);
            expect(w.topic("TOPIC")).toContain("TOPIC");
        }
    });
    it("the card: topic line only for a known topic; plain otherwise", () => {
        expect(welcomeBackText("en", "work").lines).toEqual(["Welcome back.", "Last time we talked about: work.", "Want to pick up where we left off?"]);
        expect(welcomeBackText("en", "made_up").lines).toEqual(["Welcome back.", "Want to pick up where we left off?"]);
        expect(welcomeBackText("bn-IN", "sleep").lines[1]).toContain("ঘুম");
        expect(welcomeBackText("xx", null).lines[0]).toBe("Welcome back.");
    });
});

describe("when the card shows", () => {
    const now = 1_800_000_000_000;
    const s = (o: Partial<LastSession> = {}): LastSession => ({ threadId: "t1", topic: "work", at: now - WELCOME_BACK_AFTER_MS - 1, userMessages: 3, crisis: false, ...o });
    it("after being away ≥4 h, after a real exchange", () => expect(shouldShowWelcomeBack(s(), now, null)).toBe(true));
    it("⛔ never after a crisis", () => expect(shouldShowWelcomeBack(s({ crisis: true }), now, null)).toBe(false));
    it("⛔ not on a quick return, not after a single message", () => {
        expect(shouldShowWelcomeBack(s({ at: now - 60_000 }), now, null)).toBe(false);
        expect(shouldShowWelcomeBack(s({ userMessages: 1 }), now, null)).toBe(false);
    });
    it("⛔ not again once dismissed for that conversation", () => {
        const x = s();
        expect(shouldShowWelcomeBack(x, now, `${x.threadId}:${x.at}`)).toBe(false);
    });
});

describe("wired on the web chat — and never into a reply", () => {
    const page = src("src/app/chat/page.tsx");
    it("noted after both reply paths", () => expect(page.match(/noteSessionForWelcomeBack\(threadId, msgsForAnalysis\)/g)?.length).toBe(2));
    it("the device keeps a topic KEY, never words", () => {
        expect(page).toMatch(/const saved: LastSession = \{ threadId, topic: keepTopic, at: Date\.now\(\), userMessages: userTexts\.length, crisis \}/);
    });
    it("crisis checked across the WHOLE conversation", () =>
        expect(page).toMatch(/const crisis = userTexts\.some\(\(t\) =>\s*isCrisisTier2\(t\) \|\| CRISIS_TIER1_RE\.test\(t\)/));
    it("⛔ chat-reply knows nothing about it", () => {
        const reply = src("src/app/api/chat-reply/route.ts");
        expect(reply).not.toMatch(/session-topic|welcomeBack|SESSION_TOPICS/);
    });
});

// ── the endpoint ──────────────────────────────────────────────────────────────
const ai = vi.fn();
vi.mock("@/lib/imotara/aiClient", () => ({ callImotaraAI: (...a: unknown[]) => ai(...a) }));
vi.mock("@/lib/imotara/ipRateLimit", () => ({ getClientIp: () => "1.1.1.1", checkPersistentIpRateLimit: async () => true }));

describe("/api/session-topic", () => {
    beforeEach(() => ai.mockReset());
    const call = async (messages: string[]) => {
        const { POST } = await import("@/app/api/session-topic/route");
        const r = await POST(new Request("https://x/api/session-topic", { method: "POST", body: JSON.stringify({ messages }) }));
        return (await r.json()).topic;
    };
    it("a key from the list comes back", async () => {
        ai.mockResolvedValue({ text: " Work\n" });
        expect(await call(["my boss shouted at me", "I can't face the office"])).toBe("work");
    });
    it("⛔ anything outside the list ⇒ no topic", async () => {
        ai.mockResolvedValue({ text: "your difficult manager" });
        expect(await call(["a", "b"])).toBeNull();
    });
    it("⛔ a crisis signal ⇒ no topic, and the model is never asked", async () => {
        ai.mockResolvedValue({ text: "worry" });
        expect(await call(["I want to kill myself", "nothing matters"])).toBeNull();
        expect(ai).not.toHaveBeenCalled();
    });
    it("fewer than 2 messages ⇒ no topic, no model call", async () => {
        expect(await call(["hello"])).toBeNull();
        expect(ai).not.toHaveBeenCalled();
    });
    it("the question lists exactly the closed keys", async () => {
        const { topicPrompt } = await import("@/lib/imotara/sessionTopicPrompt");
        for (const k of SESSION_TOPICS) expect(topicPrompt()).toContain(k);
        expect(topicPrompt()).toMatch(/Reply with the key only/);
    });
});
