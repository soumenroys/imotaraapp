// src/__tests__/admin/userListFiltersAndActivity.test.ts
// 🔑 Owner, 6 Nov 2026 (task #86): Admin ⇒ Licenses ⇒ User Licenses gets
// filters, each person's message count, and last active in Indian time.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const rpc = vi.fn();
vi.mock("@/app/api/admin/_auth", () => ({ adminAuthorized: async () => true }));
vi.mock("@/lib/supabaseServer", () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import { GET } from "@/app/api/admin/licenses/route";
import { formatIST, istDayStart, parseUserListFilters } from "@/lib/admin/userListFilters";

const req = (qs: string) => ({ nextUrl: new URL(`https://imotara.com/api/admin/licenses?${qs}`) }) as never;

describe("the filters reach the database only as known words", () => {
  it("known values pass; anything else is dropped", () => {
    const f = parseUserListFilters(new URLSearchParams("tier=plus&status=bogus&platform=ios&activeDays=7&sort=messages"));
    expect(f).toMatchObject({ tier: "plus", status: null, platform: "ios", activeDays: 7, sort: "messages" });
    const g = parseUserListFilters(new URLSearchParams("tier=plus';drop table licenses;--&activeDays=5&sort=x"));
    expect(g).toMatchObject({ tier: null, activeDays: null, sort: "updated" });
  });
  it("'never active' (0) is a real choice, not 'no filter'", () => {
    expect(parseUserListFilters(new URLSearchParams("activeDays=0")).activeDays).toBe(0);
  });
  it("joined dates are whole India days: from = that midnight IST, to = the NEXT midnight IST", () => {
    const f = parseUserListFilters(new URLSearchParams("joinedFrom=2026-11-01&joinedTo=2026-11-06"));
    expect(f.joinedFrom).toBe("2026-10-31T18:30:00.000Z");
    expect(f.joinedTo).toBe("2026-11-06T18:30:00.000Z");
  });
  it("a date that does not exist is ignored", () => {
    expect(istDayStart("2026-02-31")).toBeNull();
    expect(istDayStart("06/11/2026")).toBeNull();
  });
});

describe("last active is shown in Indian time, whatever the admin's computer says", () => {
  it("UTC 15:35 ⇒ 9:05 pm IST", () => {
    expect(formatIST("2026-11-07T15:35:00Z")).toMatch(/7 Nov 2026.*9:05\s?pm IST$/i);
  });
  it("never active ⇒ null (the row says 'never')", () => {
    expect(formatIST(null)).toBeNull();
    expect(formatIST("not a date")).toBeNull();
  });
});

describe("the route", () => {
  beforeEach(() => rpc.mockReset());

  it("asks admin_v5 with the filters and returns its rows and total", async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: "u1", message_count: 12, last_active_at: "2026-11-07T10:00:00Z", platform: "android", total_count: 1 }], error: null });
    const res = await GET(req("page=0&limit=20&excludeAnonymous=1&tier=plus&activeDays=30&sort=last_active&joinedFrom=2026-11-01"));
    const body = await res.json();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("admin_search_users_v5");
    expect(rpc.mock.calls[0][1]).toMatchObject({ exclude_anonymous: true, f_tier: "plus", f_active_days: 30, sort_by: "last_active", f_joined_from: "2026-10-31T18:30:00.000Z", f_joined_to: null });
    expect(body).toMatchObject({ total: 1, activityUnavailable: false });
    expect(body.users[0].message_count).toBe(12);
  });

  it("⛔ before the SQL is run, the list still works on v4 and SAYS the new parts are missing", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.admin_search_users_v5", code: "PGRST202" } })
      .mockResolvedValueOnce({ data: [{ user_id: "u1", total_count: 1 }], error: null });
    const body = await (await GET(req("tier=plus"))).json();
    expect(rpc.mock.calls[1][0]).toBe("admin_search_users_with_licenses");
    expect(rpc.mock.calls[1][1]).not.toHaveProperty("f_tier");
    expect(body).toMatchObject({ activityUnavailable: true, total: 1 });
  });

  it("any other database error is an error, not a silent fallback", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function admin_search_users_v5", code: "42501" } });
    const res = await GET(req(""));
    expect(res.status).toBe(500);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("the SQL", () => {
  const sql = readFileSync("docs/sql/admin_v5_users_activity.sql", "utf8");
  it("counts only the person's own messages, never deleted ones", () => {
    expect(sql).toMatch(/h\.record->>'source' = 'user' and not coalesce\(h\.deleted, false\)/);
  });
  it("is service_role only, with the argument list spelled out", () => {
    expect(sql).toMatch(/revoke execute on function admin_search_users_v5\(text, integer, integer, boolean, text, text, text, integer, timestamptz, timestamptz, text\)\s+from public, anon, authenticated;/);
    expect(sql).toMatch(/grant\s+execute on function admin_search_users_v5\([^)]*\)\s+to service_role;/);
  });
  it("every argument the route sends exists in the function", () => {
    const route = readFileSync("src/app/api/admin/licenses/route.ts", "utf8");
    const v5Call = route.slice(route.indexOf('rpc("admin_search_users_v5"'), route.indexOf("});", route.indexOf('rpc("admin_search_users_v5"')));
    const sent = [...v5Call.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(sent.length).toBe(11);
    for (const a of sent) expect(sql).toMatch(new RegExp(`^\\s+${a}\\s+(text|integer|boolean|timestamptz)\\b`, "m"));
  });
});

describe("the page", () => {
  const ui = readFileSync("src/app/admin/page.tsx", "utf8");
  it("shows message count, last active in IST, and platform on each row", () => {
    expect(ui).toMatch(/Last active \$\{formatIST\(user\.last_active_at\) \?\? "never"\}/);
    expect(ui).toMatch(/message\$\{user\.message_count === 1 \? "" : "s"\}/);
  });
  it("says counts leave out phone-only chats, and what to run when the query is missing", () => {
    expect(ui).toMatch(/chats kept only on a phone are not counted/);
    expect(ui).toMatch(/run docs\/sql\/admin_v5_users_activity\.sql in Supabase/);
  });
});
