/**
 * #76 (owner, 10 Nov 2026): our own team's and test accounts' chats are not
 * product usage. Admin → Analytics leaves them out.
 *
 * 🔑 The emails live in the database (app_settings "team_accounts"), never in
 * this public repository — the last test pins that.
 * ⛔ A missing or broken list must change nothing: everyone is counted, as before.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const state = {
  setting: null as unknown,
  users: [] as { id: string; email: string }[],
  rows: [] as { user_id: string; event_type: string; emotion: null; platform: string; created_at: string }[],
};

vi.mock("@/app/api/admin/_auth", () => ({ adminAuthorized: async () => true }));

function usageQuery() {
  // .select().gte().lt().order().range()  and  .select().lt().range()
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.gte = () => q;
  q.lt = () => q;
  q.order = () => q;
  q.range = async (from: number) => ({ data: from === 0 ? state.rows : [], error: null });
  return q;
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "app_settings") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.setting ? { value: state.setting } : null, error: null }) }) }) };
      }
      if (table === "usage_events") return usageQuery();
      throw new Error("unexpected table " + table);
    },
    auth: { admin: { listUsers: async () => ({ data: { users: state.users }, error: null }) } },
  }),
}));

import { GET } from "@/app/api/admin/analytics/route";
import { teamEmailsFrom } from "@/lib/admin/teamAccounts";

const now = new Date().toISOString();
const row = (user_id: string) => ({ user_id, event_type: "chat_reply", emotion: null, platform: "web", created_at: now });

beforeEach(() => {
  state.setting = null;
  state.users = [
    { id: "team-1", email: "Owner@Example.com" },
    { id: "real-1", email: "someone@example.org" },
  ];
  state.rows = [row("team-1"), row("team-1"), row("real-1")];
});

async function run() {
  const res = await GET(new NextRequest("https://x/api/admin/analytics?days=7"));
  return res.json();
}

describe("teamEmailsFrom", () => {
  it("reads { emails: [...] }, lower-cases, drops junk", () => {
    expect(teamEmailsFrom({ emails: [" A@B.com ", 3, "nope", "c@d.org"] })).toEqual(["a@b.com", "c@d.org"]);
    expect(teamEmailsFrom(null)).toEqual([]);
    expect(teamEmailsFrom({ emails: "a@b.com" })).toEqual([]);
  });
});

describe("Admin → Analytics leaves team accounts out", () => {
  it("a listed account's events are not counted, and the page says so", async () => {
    state.setting = { emails: ["owner@example.com"] };
    const j = await run();
    expect(j.totals.events).toBe(1);
    expect(j.totals.activeUsers).toBe(1);
    expect(j.meta.teamExcluded).toEqual({ accounts: 1, events: 2 });
  });

  it("⛔ no list ⇒ everyone counted, exactly as before", async () => {
    const j = await run();
    expect(j.totals.events).toBe(3);
    expect(j.totals.activeUsers).toBe(2);
    expect(j.meta.teamExcluded).toEqual({ accounts: 0, events: 0 });
  });
});

describe("⛔ the team list is never in the code", () => {
  it("the helper and the analytics route hold no email address", () => {
    for (const f of ["src/lib/admin/teamAccounts.ts", "src/app/api/admin/analytics/route.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).toEqual([]);
    }
  });
});
