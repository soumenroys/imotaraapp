// src/__tests__/safety/crisisShownFindsTheEpisode.test.ts
// #105 (8 Nov 2026): /api/safety/crisis-shown identified people by COOKIE only.
// chat-reply logs phones by Bearer and web guests by x-imotara-guest-token ⇒ the
// card could never find their episode and wrote a second, unlinked row.
// These tests RUN the route with a stub database.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { op: string; args: unknown[] };
let calls: Call[];
let episodeId: string | null;
const users: Record<string, { id: string; is_anonymous: boolean }> = {
    "phone-jwt": { id: "user-phone", is_anonymous: false },
    "guest-jwt": { id: "user-guest", is_anonymous: true },
    "real-user-as-guest": { id: "user-real", is_anonymous: false },
};

function chain() {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "gte", "order", "limit", "eq"]) {
        q[m] = (...args: unknown[]) => { calls.push({ op: m, args }); return q; };
    }
    q.maybeSingle = async () => ({ data: episodeId ? { id: episodeId } : null });
    q.update = (v: unknown) => { calls.push({ op: "update", args: [v] }); return { eq: async (...a: unknown[]) => { calls.push({ op: "update.eq", args: a }); return {}; } }; };
    q.insert = async (v: unknown) => { calls.push({ op: "insert", args: [v] }); return {}; };
    return q;
}

vi.mock("@/lib/supabaseServer", () => ({
    getSupabaseAdmin: () => ({
        from: () => chain(),
        auth: { getUser: async (t: string) => ({ data: { user: users[t] ?? null } }) },
    }),
}));
vi.mock("@/lib/supabase/userServer", () => ({
    supabaseUserServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

async function post(headers: Record<string, string>, body: object) {
    const { POST } = await import("@/app/api/safety/crisis-shown/route");
    const req = new Request("http://x/api/safety/crisis-shown", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
    return POST(req as never);
}
const BODY = { cardLang: "bn", tier: 2, resourcesCountry: "IN", resourceIds: ["in-tele-manas"], platform: "mobile" };

describe("crisis-shown finds the episode chat-reply logged", () => {
    beforeEach(() => { calls = []; episodeId = "ep-1"; });

    it("📱 a phone (Bearer) is matched by user id and the episode is UPDATED, not duplicated", async () => {
        const res = await post({ Authorization: "Bearer phone-jwt" }, BODY);
        expect(res.status).toBe(200);
        expect(calls).toContainEqual({ op: "eq", args: ["user_id", "user-phone"] });
        expect(calls.some((c) => c.op === "update")).toBe(true);
        expect(calls.some((c) => c.op === "insert")).toBe(false);
    });

    it("🌐 a web guest (own header) is matched by their anonymous user id", async () => {
        const res = await post({ "x-imotara-guest-token": "guest-jwt" }, { ...BODY, platform: "web", anonId: "anon-12345678" });
        expect(res.status).toBe(200);
        expect(calls).toContainEqual({ op: "eq", args: ["user_id", "user-guest"] });
        expect(calls.some((c) => c.op === "insert")).toBe(false);
    });

    it("⛔ the guest header is refused for a NON-anonymous account (falls back to the anon id)", async () => {
        await post({ "x-imotara-guest-token": "real-user-as-guest" }, { ...BODY, anonId: "anon-12345678" });
        expect(calls).not.toContainEqual({ op: "eq", args: ["user_id", "user-real"] });
        expect(calls).toContainEqual({ op: "eq", args: ["anon_id", "anon-12345678"] });
    });

    it("no episode found ⇒ a standalone row is still written (a card shown with no record is the worst outcome)", async () => {
        episodeId = null;
        await post({ Authorization: "Bearer phone-jwt" }, BODY);
        const ins = calls.find((c) => c.op === "insert");
        expect(ins).toBeTruthy();
        expect(ins!.args[0]).toMatchObject({ user_id: "user-phone", platform: "mobile", card_shown: true, card_lang: "bn", resources_country: "IN" });
    });
});
