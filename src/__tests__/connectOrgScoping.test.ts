/**
 * Connect org scoping — the seam that stops one organisation seeing another's
 * people and sessions.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-10-06 Connect had NO notion of organisations:
 * 0 of 28 route handlers referenced org_id. Imotara is being sold to an NGO
 * whose members are elderly residents, so the failure mode — one org's admin
 * reading another org's sessions, or an outsider seeing an org's private
 * companions — is the worst defect the product can have.
 *
 * 🔑 THESE TESTS TARGET THE SEAM, NOT THE CALL SITES. A per-route filter rule
 * holds for 27 routes and then fails silently on the 28th, because a missing
 * scope filter does not throw — it returns somebody else's data. So the
 * invariants live in src/lib/connect/scope.ts and are pinned here.
 *
 * ⚠️ The cases that actually matter are the DENIALS. A test that only proves
 * "the owner can read their own session" passes just as happily when scoping is
 * removed entirely.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// 🔴 These were inline `require("fs")`/`require("path")` calls inside three
// IIFEs. Each carried ONE eslint-disable comment, which covers only the next
// line — so the `fs` require was suppressed and the `path` require directly
// below it was not. Three real lint errors, red in CI since 2026-10-06, while
// typecheck and the test suite both stayed green. Static imports need no
// suppression at all.
import fs from "fs";
import path from "path";

// ── Supabase stub ────────────────────────────────────────────────────────────
// A minimal chainable query builder: enough to record what the code asked for.
type Row = Record<string, unknown>;
interface Recorded { table: string; eq: Array<[string, unknown]>; or: string[] }

const recorded: Recorded[] = [];
let memberRows: Row[] = [];
let sessionRow: Row | null = null;
let consultantRow: Row | null = null;
let memberError: unknown = null;
let sessionError: unknown = null;
let allowsPublic: boolean | null = true;
let rpcError: unknown = null;

function builder(table: string) {
  const rec: Recorded = { table, eq: [], or: [] };
  recorded.push(rec);
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = chain;
  api.order = chain;
  api.eq = (c: string, v: unknown) => { rec.eq.push([c, v]); return api; };
  api.or = (f: string) => { rec.or.push(f); return api; };
  api.limit = () =>
    table === "org_members"
      ? Promise.resolve({ data: memberRows, error: memberError })
      : Promise.resolve({ data: [], error: null });
  api.maybeSingle = () =>
    table === "connect_sessions"
      ? Promise.resolve({ data: sessionRow, error: sessionError })
      : Promise.resolve({ data: consultantRow, error: null });
  return api;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: {
    from: (t: string) => builder(t),
    rpc: () => Promise.resolve({ data: allowsPublic, error: rpcError }),
  },
}));

let currentUser: { id: string } | null = { id: "user-1" };
vi.mock("@/lib/connect/auth", () => ({
  getConnectUser: () => Promise.resolve(currentUser),
}));

const { getConnectScope, applyConsultantVisibility, assertSessionAccess } =
  await import("@/lib/connect/scope");

const req = () => new Request("https://x.test/api/connect/consultants");

beforeEach(() => {
  recorded.length = 0;
  currentUser = { id: "user-1" };
  memberRows = []; memberError = null;
  sessionRow = null; sessionError = null; consultantRow = null;
  allowsPublic = true; rpcError = null;
});

// ── The visibility predicate ─────────────────────────────────────────────────

describe("🔴 a caller never sees another organisation's private consultants", () => {
  const fake = () => {
    const calls = { eq: [] as Array<[string, unknown]>, or: [] as string[] };
    const q = {
      eq(c: string, v: unknown) { calls.eq.push([c, v]); return q; },
      or(f: string) { calls.or.push(f); return q; },
    };
    return { q, calls };
  };

  it("anonymous / no-org callers are restricted to public", () => {
    const { q, calls } = fake();
    applyConsultantVisibility(q, { userId: null, orgId: null, orgRole: null, allowsPublic: true });
    expect(calls.eq).toEqual([["visibility", "public"]]);
    // and crucially: no OR that could widen it
    expect(calls.or).toEqual([]);
  });

  it("an org member sees public PLUS their own org — and names only their own org id", () => {
    const { q, calls } = fake();
    applyConsultantVisibility(q, { userId: "u", orgId: "ORG-A", orgRole: "member", allowsPublic: true });
    expect(calls.or).toHaveLength(1);
    expect(calls.or[0]).toContain("visibility.eq.public");
    expect(calls.or[0]).toContain("org_id.eq.ORG-A");
    expect(calls.or[0]).not.toContain("ORG-B");
  });

  it("🔑 with the marketplace switched OFF, the org's OWN people remain visible", () => {
    // The dangerous mistake would be filtering to "nothing" and leaving a
    // member with no one to talk to.
    const { q, calls } = fake();
    applyConsultantVisibility(q, { userId: "u", orgId: "ORG-A", orgRole: "member", allowsPublic: false });
    expect(calls.eq).toEqual([["org_id", "ORG-A"]]);
    expect(calls.or).toEqual([]);
  });

  it("the switch never widens access to another org", () => {
    for (const allows of [true, false]) {
      const { q, calls } = fake();
      applyConsultantVisibility(q, { userId: "u", orgId: "ORG-A", orgRole: "admin", allowsPublic: allows });
      const asked = JSON.stringify(calls);
      expect(asked).toContain("ORG-A");
      expect(asked).not.toContain("ORG-B");
    }
  });
});

// ── Scope resolution ─────────────────────────────────────────────────────────

describe("scope resolution fails CLOSED", () => {
  it("an anonymous request gets no org", async () => {
    currentUser = null;
    const s = await getConnectScope(req());
    expect(s).toMatchObject({ userId: null, orgId: null });
  });

  it("if membership cannot be read, the caller is treated as having NO org", async () => {
    // Shows less (public only), never another org's people.
    memberError = { message: "boom" };
    const s = await getConnectScope(req());
    expect(s.orgId).toBeNull();
  });

  it("only ACTIVE memberships count", async () => {
    memberRows = [{ org_id: "ORG-A", role: "member" }];
    await getConnectScope(req());
    const m = recorded.find((r) => r.table === "org_members")!;
    expect(m.eq).toContainEqual(["status", "active"]);
  });

  it("the marketplace switch is read from the org, defaulting to allowed", async () => {
    memberRows = [{ org_id: "ORG-A", role: "member" }];
    allowsPublic = null;              // org has never set it
    const s = await getConnectScope(req());
    expect(s.allowsPublic).toBe(true);
  });

  it("an explicit false is honoured", async () => {
    memberRows = [{ org_id: "ORG-A", role: "member" }];
    allowsPublic = false;
    const s = await getConnectScope(req());
    expect(s.allowsPublic).toBe(false);
  });
});

// ── The session guard — the denials are the point ────────────────────────────

describe("🔴 cross-org session access is refused", () => {
  const scopeA = { userId: "admin-A", orgId: "ORG-A", orgRole: "admin", allowsPublic: true };

  it("an admin of org A cannot read a session stamped org B", async () => {
    sessionRow = { id: "s1", user_id: "someone", consultant_id: "c1", org_id: "ORG-B" };
    const r = await assertSessionAccess("s1", scopeA);
    expect(r.ok).toBe(false);
  });

  it("…and it answers 404, so the id is not confirmed to exist", async () => {
    sessionRow = { id: "s1", user_id: "someone", consultant_id: "c1", org_id: "ORG-B" };
    const r = await assertSessionAccess("s1", scopeA);
    expect(r.ok === false && r.status).toBe(404);
  });

  it("an admin cannot read an UNSTAMPED session they have no part in", async () => {
    // org_id null must not be read as "belongs to everyone".
    sessionRow = { id: "s1", user_id: "someone", consultant_id: "c1", org_id: null };
    const r = await assertSessionAccess("s1", scopeA);
    expect(r.ok).toBe(false);
  });

  it("a plain MEMBER of the right org still cannot read another member's session", async () => {
    sessionRow = { id: "s1", user_id: "someone-else", consultant_id: "c1", org_id: "ORG-A" };
    const r = await assertSessionAccess("s1", {
      userId: "member-A", orgId: "ORG-A", orgRole: "member", allowsPublic: true,
    });
    expect(r.ok).toBe(false);
  });

  it("an anonymous caller is refused outright", async () => {
    sessionRow = { id: "s1", user_id: "x", consultant_id: "c1", org_id: null };
    const r = await assertSessionAccess("s1", {
      userId: null, orgId: null, orgRole: null, allowsPublic: true,
    });
    expect(r.ok).toBe(false);
  });

  it("a read error DENIES rather than allowing", async () => {
    sessionError = { message: "db down" };
    const r = await assertSessionAccess("s1", scopeA);
    expect(r.ok).toBe(false);
  });
});

// ── The wiring ───────────────────────────────────────────────────────────────
// A perfect seam that no route calls protects nothing. These assert the CALL,
// not the import — an import can sit unused and a mention can live in a comment.

describe("the marketplace route is actually wired to the seam", () => {
  const SRC = (() => {
    return fs.readFileSync(
      path.join(process.cwd(), "src/app/api/connect/consultants/route.ts"),
      "utf8",
    );
  })();
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("resolves the scope and applies the visibility filter", () => {
    expect(code).toMatch(/getConnectScope\(\s*req\s*\)/);
    expect(code).toMatch(/applyConsultantVisibility\(\s*query\s*,\s*scope\s*\)/);
  });

  it("🔑 filters BEFORE the query runs, so the count matches what is visible", () => {
    // A filter applied after execution would still leak totals — the page count
    // would describe rows the caller may not see.
    const filterAt = code.indexOf("applyConsultantVisibility(");
    const awaitAt  = code.indexOf("await query");
    expect(filterAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(-1);
    expect(filterAt).toBeLessThan(awaitAt);
  });

  it("does not resolve the user independently of the scope", () => {
    // Two sources of identity drift. The scope is the only one.
    expect(code).not.toMatch(/getConnectUser\s*\(/);
  });
});

describe("🔴 booking cannot be used to walk around the filters either", () => {
  // Browse routes are not the only way to reach a companion. A booking is a
  // direct POST carrying an id, so without the same predicate an org's private
  // companion could be booked by anyone who guessed or kept that id.
  const BOOK = (() => {
    return fs
      .readFileSync(path.join(process.cwd(), "src/app/api/connect/sessions/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  })();

  it("the consultant lookup is visibility-filtered", () => {
    expect(BOOK).toMatch(/applyConsultantVisibility\(\s*consultantQuery\s*,\s*scope\s*\)/);
  });

  it("…and filtered BEFORE the row is fetched", () => {
    const filterAt = BOOK.indexOf("applyConsultantVisibility(");
    const fetchAt  = BOOK.indexOf("consultantQuery.maybeSingle()");
    expect(filterAt).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(filterAt);
  });

  it("🔑 the session is STAMPED with the booker's org at creation", () => {
    // Billing and audit must keep saying which org a session belonged to even
    // after the member leaves, so it is stored, never re-derived.
    expect(BOOK).toMatch(/org_id:\s*scope\.orgId/);
  });

  it("the stamp is on the INSERT, not a later update", () => {
    const insertAt = BOOK.indexOf(".insert({");
    const stampAt  = BOOK.search(/org_id:\s*scope\.orgId/);
    expect(insertAt).toBeGreaterThan(-1);
    expect(stampAt).toBeGreaterThan(insertAt);
  });

  it("booking resolves the scope rather than identity alone", () => {
    expect(BOOK).toMatch(/const scope = await getConnectScope\(\s*req\s*\)/);
  });
});

describe("🔴 the by-id route cannot be used to walk around the list filter", () => {
  // Hiding a consultant from the list is worthless if GET /consultants/<id>
  // still returns them — ids are enumerable.
  const BY_ID = (() => {
    return fs
      .readFileSync(path.join(process.cwd(), "src/app/api/connect/consultants/[id]/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  })();

  it("applies the same visibility predicate as the list", () => {
    expect(BY_ID).toMatch(/applyConsultantVisibility\(\s*query\s*,\s*scope\s*\)/);
  });

  it("filters before the row is fetched", () => {
    const filterAt = BY_ID.indexOf("applyConsultantVisibility(");
    const fetchAt  = BY_ID.search(/await query\.maybeSingle\(\)/);
    expect(filterAt).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(filterAt);
  });

  it("🔑 answers the same 404 whether the consultant is missing or merely hidden", () => {
    // A distinct error would confirm that an org's private companion exists.
    const notFounds = BY_ID.match(/status:\s*404/g) ?? [];
    expect(notFounds).toHaveLength(1);
    expect(BY_ID).not.toMatch(/403/);
  });
});

describe("…while the people who should have access keep it", () => {
  it("the member whose session it is", async () => {
    sessionRow = { id: "s1", user_id: "user-1", consultant_id: "c1", org_id: "ORG-A" };
    const r = await assertSessionAccess("s1", {
      userId: "user-1", orgId: null, orgRole: null, allowsPublic: true,
    });
    expect(r.ok).toBe(true);
  });

  it("the consultant who took it", async () => {
    sessionRow = { id: "s1", user_id: "other", consultant_id: "c-9", org_id: "ORG-A" };
    consultantRow = { id: "c-9" };
    const r = await assertSessionAccess("s1", {
      userId: "consultant-user", orgId: null, orgRole: null, allowsPublic: true,
    });
    expect(r.ok).toBe(true);
  });

  it("an admin of the org the session WAS stamped with — for METADATA", async () => {
    sessionRow = { id: "s1", user_id: "other", consultant_id: "c1", org_id: "ORG-A" };
    const r = await assertSessionAccess("s1", {
      userId: "admin-A", orgId: "ORG-A", orgRole: "admin", allowsPublic: true,
    }, "metadata");
    expect(r.ok).toBe(true);
  });
});

// ── The hard boundary ────────────────────────────────────────────────────────

describe("🔴 an org admin can never reach a member's conversation", () => {
  /**
   * help/organizations.md promises organisations, without qualification:
   *   "You can never see any member's conversations. Not their words, not a
   *    summary of their words, not a single message... That is a hard boundary
   *    and there is no setting anywhere that unlocks it."
   * Connect messages, notes and review text ARE member conversations.
   */
  const ownSessionOfSomeoneElse = { id: "s1", user_id: "member-x", consultant_id: "c1", org_id: "ORG-A" };

  it("denied at 'contents' even for the owner of that very org", async () => {
    sessionRow = ownSessionOfSomeoneElse;
    const r = await assertSessionAccess("s1", {
      userId: "owner-A", orgId: "ORG-A", orgRole: "owner", allowsPublic: true,
    }, "contents");
    expect(r.ok).toBe(false);
  });

  it("denied for an admin of that org too", async () => {
    sessionRow = ownSessionOfSomeoneElse;
    const r = await assertSessionAccess("s1", {
      userId: "admin-A", orgId: "ORG-A", orgRole: "admin", allowsPublic: true,
    }, "contents");
    expect(r.ok).toBe(false);
  });

  it("🔑 the DEFAULT level is the strict one — a forgetful call site is safe", async () => {
    // Omitting the argument must not quietly grant an admin someone's messages.
    sessionRow = ownSessionOfSomeoneElse;
    const r = await assertSessionAccess("s1", {
      userId: "admin-A", orgId: "ORG-A", orgRole: "admin", allowsPublic: true,
    });
    expect(r.ok).toBe(false);
  });

  it("but the participants still reach their own contents", async () => {
    sessionRow = { id: "s1", user_id: "member-x", consultant_id: "c1", org_id: "ORG-A" };
    const r = await assertSessionAccess("s1", {
      userId: "member-x", orgId: "ORG-A", orgRole: "member", allowsPublic: true,
    }, "contents");
    expect(r.ok).toBe(true);
  });

  it("🔑 access follows the session's STAMPED org, not the caller's current one", async () => {
    // A member who later moved to another org must not retain access, and an
    // admin must not gain access to history that was never theirs.
    sessionRow = { id: "s1", user_id: "other", consultant_id: "c1", org_id: "ORG-A" };
    const movedAway = await assertSessionAccess("s1", {
      userId: "admin-A", orgId: "ORG-B", orgRole: "admin", allowsPublic: true,
    });
    expect(movedAway.ok).toBe(false);
  });
});
