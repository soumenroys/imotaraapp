// src/__tests__/admin/userListFiltersAndActivity.test.ts
// 🔑 Owner, 6 Nov 2026 (task #86): Admin ⇒ Licenses ⇒ User Licenses gets
// filters, each person's message count, and last active in Indian time.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const rpc = vi.fn();
vi.mock("@/app/api/admin/_auth", () => ({ adminAuthorized: async () => true }));
vi.mock("@/lib/supabaseServer", () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import { GET } from "@/app/api/admin/licenses/route";
import { formatIST, istDayStart, parseGuestMode, parseUserListFilters } from "@/lib/admin/userListFilters";

// v7 (27 Nov 2026) is asked first; these older tests start from "v7 not run yet".
const V7_MISSING = { data: null, error: { message: "Could not find the function public.admin_search_users_v7", code: "PGRST202" } };
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
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValueOnce(V7_MISSING); });

  it("asks admin_v6 with the filters and returns its rows and total", async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: "u1", message_count: 12, last_active_at: "2026-11-07T10:00:00Z", platform: "android", total_count: 1 }], error: null });
    const res = await GET(req("page=0&limit=20&excludeAnonymous=1&tier=plus&activeDays=30&sort=last_active&joinedFrom=2026-11-01"));
    const body = await res.json();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe("admin_search_users_v6");
    expect(rpc.mock.calls[1][1]).toMatchObject({ exclude_anonymous: true, f_tier: "plus", f_active_days: 30, sort_by: "last_active", f_joined_from: "2026-10-31T18:30:00.000Z", f_joined_to: null, f_msgs_min: null, f_msgs_max: null });
    expect(body).toMatchObject({ total: 1, activityUnavailable: false });
    expect(body.users[0].message_count).toBe(12);
  });

  it("⛔ before the SQL is run, the list still works on v4 and SAYS the new parts are missing", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.admin_search_users_v6", code: "PGRST202" } })
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.admin_search_users_v5", code: "PGRST202" } })
      .mockResolvedValueOnce({ data: [{ user_id: "u1", total_count: 1 }], error: null });
    const body = await (await GET(req("tier=plus"))).json();
    expect(rpc.mock.calls[3][0]).toBe("admin_search_users_with_licenses");
    expect(rpc.mock.calls[3][1]).not.toHaveProperty("f_tier");
    expect(body).toMatchObject({ activityUnavailable: true, total: 1 });
  });

  it("any other database error is an error, not a silent fallback", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function admin_search_users_v6", code: "42501" } });
    const res = await GET(req(""));
    expect(res.status).toBe(500);
    expect(rpc).toHaveBeenCalledTimes(2);
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
  it("every argument the route sends exists in the function (v5 and v6)", () => {
    const route = readFileSync("src/app/api/admin/licenses/route.ts", "utf8");
    const start = route.indexOf("const baseArgs = {");
    const block = route.slice(start, route.indexOf("};", start));
    const sent = [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(sent.length).toBe(11);
    const v6 = readFileSync("docs/sql/admin_v6_message_filter.sql", "utf8");
    for (const a of sent) {
      expect(sql).toMatch(new RegExp(`^\\s+${a}\\s+(text|integer|boolean|timestamptz)\\b`, "m"));
      expect(v6).toMatch(new RegExp(`^\\s+${a}\\s+(text|integer|boolean|timestamptz)\\b`, "m"));
    }
    expect(route).toMatch(/rpc\("admin_search_users_v6", \{ \.\.\.baseArgs, f_msgs_min: filters\.msgMin, f_msgs_max: filters\.msgMax \}\)/);
    expect(route).toMatch(/rpc\("admin_search_users_v5", baseArgs\)/);
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

// #136 (owner, 12 Nov 2026): filter by number of messages.
describe("#136 — the message-count filter", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValueOnce(V7_MISSING); });
  const v6 = readFileSync("docs/sql/admin_v6_message_filter.sql", "utf8");

  it("only whole numbers reach the database; a reversed range is put the right way round", () => {
    expect(parseUserListFilters(new URLSearchParams("msgMin=6&msgMax=20"))).toMatchObject({ msgMin: 6, msgMax: 20 });
    expect(parseUserListFilters(new URLSearchParams("msgMin=20&msgMax=6"))).toMatchObject({ msgMin: 6, msgMax: 20 });
    expect(parseUserListFilters(new URLSearchParams("msgMin=0&msgMax=0"))).toMatchObject({ msgMin: 0, msgMax: 0 });
    for (const bad of ["-1", "5.5", "1e3", "abc", "1;drop", "999999999"])
      expect(parseUserListFilters(new URLSearchParams(`msgMin=${bad}`)).msgMin).toBeNull();
    expect(parseUserListFilters(new URLSearchParams("msgMin=101")).msgMax).toBeNull(); // "more than 100"
  });

  it("the range is sent to admin_v6", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const body = await (await GET(req("msgMin=1&msgMax=5"))).json();
    expect(rpc.mock.calls[1][0]).toBe("admin_search_users_v6");
    expect(rpc.mock.calls[1][1]).toMatchObject({ f_msgs_min: 1, f_msgs_max: 5 });
    expect(body.messageFilterUnavailable).toBe(false);
  });

  it("⛔ before v6 is run: the list still works on v5 and SAYS the message filter is not applied", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.admin_search_users_v6", code: "PGRST202" } })
      .mockResolvedValueOnce({ data: [{ user_id: "u1", total_count: 1 }], error: null });
    const body = await (await GET(req("msgMin=1&msgMax=5&tier=plus"))).json();
    expect(rpc.mock.calls[2][0]).toBe("admin_search_users_v5");
    expect(rpc.mock.calls[2][1]).not.toHaveProperty("f_msgs_min");
    expect(rpc.mock.calls[2][1]).toMatchObject({ f_tier: "plus" });
    expect(body).toMatchObject({ messageFilterUnavailable: true, activityUnavailable: false, total: 1 });
  });

  it("no range asked ⇒ falling back to v5 is silent (nothing was ignored)", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.admin_search_users_v6", code: "PGRST202" } })
      .mockResolvedValueOnce({ data: [], error: null });
    const body = await (await GET(req("tier=plus"))).json();
    expect(body.messageFilterUnavailable).toBe(false);
  });

  it("the SQL filters on the same own-message count, both ends inclusive, and is service_role only", () => {
    expect(v6).toMatch(/h\.record->>'source' = 'user' and not coalesce\(h\.deleted, false\)/);
    expect(v6).toMatch(/and \(f_msgs_min\s+is null or base\.message_count >= f_msgs_min\)/);
    expect(v6).toMatch(/and \(f_msgs_max\s+is null or base\.message_count <= f_msgs_max\)/);
    expect(v6).toMatch(/revoke execute on function admin_search_users_v6\(text, integer, integer, boolean, text, text, text, integer, timestamptz, timestamptz, text, integer, integer\)\s+from public, anon, authenticated;/);
    expect(v6).toMatch(/grant\s+execute on function admin_search_users_v6\([^)]*\)\s+to service_role;/);
    expect(v6).not.toMatch(/\b(insert|update|delete)\s+(into|from)?\s*public\./i);
  });

  it("the page offers the ranges and a custom range, and says when v6 is missing", () => {
    const ui = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(ui).toMatch(/MESSAGE_RANGES\.map/);
    expect(ui).toMatch(/Custom range…/);
    expect(ui).toMatch(/run docs\/sql\/admin_v6_message_filter\.sql in Supabase/);
  });
});

// v7 (owner, 27 Nov 2026): "many users joined but with 0 text" — backup is off by default, so the
// saved-message count read 0 for people who really chat. v7 adds the reply count and a
// "guests who chatted" choice.
describe("v7 — replies next to saved messages, and guests who chatted", () => {
  beforeEach(() => rpc.mockReset());
  const v7 = readFileSync("docs/sql/admin_v7_replies_and_guests.sql", "utf8");

  it("guests= wins; the older excludeAnonymous=1 still means hidden; junk falls back", () => {
    expect(parseGuestMode(new URLSearchParams("guests=chatted"))).toBe("chatted");
    expect(parseGuestMode(new URLSearchParams("guests=all&excludeAnonymous=1"))).toBe("all");
    expect(parseGuestMode(new URLSearchParams("excludeAnonymous=1"))).toBe("none");
    expect(parseGuestMode(new URLSearchParams(""))).toBe("all");
    expect(parseGuestMode(new URLSearchParams("guests=x';drop&excludeAnonymous=1"))).toBe("none");
  });

  it("the route asks v7 first, with the guest choice, and returns reply_count", async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: "u1", message_count: 0, reply_count: 37, total_count: 1 }], error: null });
    const body = await (await GET(req("guests=chatted&excludeAnonymous=1&msgMin=1"))).json();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("admin_search_users_v7");
    expect(rpc.mock.calls[0][1]).toMatchObject({ guests: "chatted", exclude_anonymous: true, f_msgs_min: 1 });
    expect(body).toMatchObject({ total: 1, repliesUnavailable: false });
    expect(body.users[0].reply_count).toBe(37);
  });

  it("⛔ before v7 is run: v6 answers, guests stay hidden, and the page is told replies are missing", async () => {
    rpc.mockResolvedValueOnce(V7_MISSING).mockResolvedValueOnce({ data: [], error: null });
    const body = await (await GET(req("guests=chatted"))).json();
    expect(rpc.mock.calls[1][0]).toBe("admin_search_users_v6");
    expect(rpc.mock.calls[1][1]).toMatchObject({ exclude_anonymous: true });
    expect(body.repliesUnavailable).toBe(true);
  });

  it("any other v7 error is an error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function admin_search_users_v7", code: "42501" } });
    expect((await GET(req(""))).status).toBe(500);
  });

  it("the SQL: replies come from chat_reply events; filter and sort use the higher count; read-only; service_role only", () => {
    expect(v7).toMatch(/count\(\*\) filter \(where e\.event_type = 'chat_reply'\) as replies/);
    expect(v7).toMatch(/coalesce\(ue\.replies, 0\)::bigint as reply_count/);
    expect(v7).toMatch(/when 'chatted' then not base\.is_anonymous or greatest\(base\.message_count, base\.reply_count\) > 0/);
    expect(v7).toMatch(/greatest\(base\.message_count, base\.reply_count\) >= f_msgs_min/);
    expect(v7).toMatch(/when sort_by = 'messages'\s+then greatest\(base\.message_count, base\.reply_count\)/);
    expect(v7).not.toMatch(/\b(insert|update|delete)\s+(into|from)?\s*public\./i);
    const sig = "text, integer, integer, boolean, text, text, text, integer, timestamptz, timestamptz, text, integer, integer, text";
    expect(v7).toContain(`revoke execute on function admin_search_users_v7(${sig})\n  from public, anon, authenticated;`);
    expect(v7).toContain(`grant  execute on function admin_search_users_v7(${sig})\n  to service_role;`);
    // every argument the route sends exists in v7
    const route = readFileSync("src/app/api/admin/licenses/route.ts", "utf8");
    const start = route.indexOf("const baseArgs = {");
    const sent = [...route.slice(start, route.indexOf("};", start)).matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    for (const a of [...sent, "f_msgs_min", "f_msgs_max", "guests"])
      expect(v7).toMatch(new RegExp(`^\\s+${a}\\s+(text|integer|boolean|timestamptz)\\b`, "m"));
  });

  it("the page shows replies and saved messages, and offers the three guest choices", () => {
    const ui = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(ui).toMatch(/repl\$\{user\.reply_count === 1 \? "y" : "ies"\} · \$\{user\.message_count \?\? 0\} saved message/);
    expect(ui).toMatch(/<option value="none">Hidden<\/option>/);
    expect(ui).toMatch(/<option value="chatted" disabled=\{repliesUnavailable\}>Only guests who chatted<\/option>/);
    expect(ui).toMatch(/params\.set\("guests", g\)/);
    expect(ui).toMatch(/useState<GuestMode>\("none"\)/); // default unchanged: guests hidden
  });
});
