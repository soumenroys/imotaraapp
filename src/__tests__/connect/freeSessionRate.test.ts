/**
 * src/__tests__/connect/freeSessionRate.test.ts
 *
 * Regression test for a 2026-08-16 bug report: a companion offering a FREE
 * session (rate_per_min = 0, a deliberate value set at the companion's own
 * choice — see connect_rate_whole_number_fix_2026_07_26) could never
 * actually be booked. Two independent falsy-zero checks both treated
 * rate_per_min = 0 as "no rate" instead of "free rate":
 *
 *  1. POST /api/connect/sessions rejected session creation with a 409
 *     ("Consultant rate unavailable. Please try again.") — this is the
 *     exact error the user screenshotted.
 *  2. POST /api/connect/sessions/[id]/tick — the 60-second billing loop —
 *     would have aborted every tick with a 422 ("session_rate_invalid")
 *     immediately after a free session somehow got created, silently
 *     freezing the session client-side (the client's tick handler doesn't
 *     recognize this specific error and does nothing with it).
 *
 * These tests exercise the REAL route handlers (unmodified import, not a
 * reimplementation) against a mocked Supabase client, proving the exact
 * boundary condition (rate_per_min = 0) no longer triggers either false
 * rejection, while a genuinely invalid rate (missing/negative) still does.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/connect/auth", () => ({
  getConnectUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" })),
}));
vi.mock("@/lib/connect/mailer", () => ({
  sendSessionRequestEmail: vi.fn(),
  sendSessionSummaryEmail: vi.fn(),
  sendConsultantEarningsEmail: vi.fn(),
  sendPlatformRevenueEmail: vi.fn(),
}));
vi.mock("@/lib/connect/creditConsultant", () => ({
  creditConsultantDurably: vi.fn(),
}));

type Resp = { data: unknown; error: unknown; count?: number };

/** A minimal chainable Supabase query-builder stub. Each `.from(table)` call
 * pops the next scripted response for that table off a per-table queue —
 * callers don't need to model every intermediate `.eq()/.select()` call,
 * just the shape of what each query ultimately resolves to. */
function makeSupabaseMock(fromQueue: Record<string, Resp[]>, rpcQueue: Resp[] = []) {
  let rpcIndex = 0;
  return {
    from(table: string) {
      const queue = fromQueue[table];
      const response = queue?.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ["select", "eq", "neq", "in", "not", "gte", "lt", "order", "limit", "insert", "update"]) {
        builder[m] = chain;
      }
      builder.single = () => Promise.resolve(response);
      builder.maybeSingle = () => Promise.resolve(response);
      // Supports being awaited directly with no terminal method (the count-only rate-limit query).
      builder.then = (resolve: (v: Resp) => void) => resolve(response);
      return builder;
    },
    rpc: () => Promise.resolve(rpcQueue[rpcIndex++] ?? { data: null, error: null }),
  };
}

const CONSULTANT_ID = "22222222-2222-2222-2222-222222222222";
const baseConsultant = {
  id: CONSULTANT_ID,
  status: "approved",
  is_busy: false,
  is_online: true,
  currency_code: "INR",
  preferred_lang: "en",
};

function makeSessionsRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/connect/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/connect/sessions — free (rate=0) companion booking", () => {
  beforeEach(() => vi.resetModules());

  it("rate_per_min = 0 is accepted — session creation proceeds past the rate check", async () => {
    vi.doMock("@/lib/supabaseServer", () => ({
      getSupabaseAdmin: () =>
        makeSupabaseMock(
          {
            // 1. rate-limit count query (awaited directly, no .single())
            connect_sessions: [
              { data: null, error: null, count: 0 },
              { data: null, error: null },  // 2. duplicate-with-this-consultant check
              { data: null, error: null },  // 3. other-active-session check
              // 4. the INSERT — reaching this proves the rate=0 check did NOT reject earlier
              { data: { id: "new-session-id", status: "pending" }, error: null },
            ],
            connect_consultants: [
              { data: { ...baseConsultant, rate_per_min: 0 }, error: null }, // consultant fetch
              { data: null, error: null }, // self-consultant check
            ],
            connect_blocks: [{ data: null, error: null }],
          },
          [{ data: 5, error: null }], // get_session_balance RPC — plenty of balance
        ),
    }));
    const { POST } = await import("@/app/api/connect/sessions/route");
    const res = await POST(makeSessionsRequest({ consultant_id: CONSULTANT_ID, type: "instant" }));
    const json = await res.json();

    expect(res.status).not.toBe(409);
    expect(json.error).not.toBe("Consultant rate unavailable. Please try again.");
    expect(json.ok).toBe(true);
  });

  it("regression guard: a missing/null rate is still correctly rejected", async () => {
    vi.doMock("@/lib/supabaseServer", () => ({
      getSupabaseAdmin: () =>
        makeSupabaseMock(
          {
            connect_sessions: [
              { data: null, error: null, count: 0 },
              { data: null, error: null },
              { data: null, error: null },
            ],
            connect_consultants: [
              { data: { ...baseConsultant, rate_per_min: null }, error: null },
              { data: null, error: null },
            ],
            connect_blocks: [{ data: null, error: null }],
          },
          [{ data: 5, error: null }],
        ),
    }));
    const { POST } = await import("@/app/api/connect/sessions/route");
    const res = await POST(makeSessionsRequest({ consultant_id: CONSULTANT_ID, type: "instant" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Consultant rate unavailable. Please try again.");
  });
});

describe("POST /api/connect/sessions/[id]/tick — free (rate=0) session billing", () => {
  beforeEach(() => vi.resetModules());

  const SESSION_ID = "33333333-3333-3333-3333-333333333333";
  const USER_ID = "11111111-1111-1111-1111-111111111111";

  function makeTickRequest() {
    return new Request(`http://localhost/api/connect/sessions/${SESSION_ID}/tick`, {
      method: "POST",
    }) as unknown as import("next/server").NextRequest;
  }

  it("session.rate_per_min = 0 is accepted — tick proceeds past the rate check", async () => {
    vi.doMock("@/lib/supabaseServer", () => ({
      getSupabaseAdmin: () =>
        makeSupabaseMock(
          {
            connect_sessions: [
              {
                data: {
                  id: SESSION_ID, user_id: USER_ID, consultant_id: CONSULTANT_ID,
                  status: "active", minutes_used: 2, amount_charged: 0, currency_code: "INR",
                  rate_per_min: 0, last_tick_at: null, started_at: new Date().toISOString(),
                },
                error: null,
              },
            ],
          },
          // Deliberately fail the balance RPC so the route stops cleanly right after the
          // rate check — proves we got PAST the rate=0 check (a 422 would have fired first
          // and this RPC would never be reached) without needing to mock the entire rest
          // of the billing/credit/email flow.
          [{ data: null, error: { message: "boundary-stop: proves rate check passed" } }],
        ),
    }));
    const { POST } = await import("@/app/api/connect/sessions/[id]/tick/route");
    const res = await POST(makeTickRequest(), { params: Promise.resolve({ id: SESSION_ID }) });
    const json = await res.json();

    expect(json.error).not.toBe("session_rate_invalid");
    expect(res.status).not.toBe(422);
    // Confirms we reached the balance RPC step (which we made fail on purpose).
    expect(res.status).toBe(503);
  });

  it("regression guard: a negative/corrupted stored rate is still correctly rejected", async () => {
    vi.doMock("@/lib/supabaseServer", () => ({
      getSupabaseAdmin: () =>
        makeSupabaseMock({
          connect_sessions: [
            {
              data: {
                id: SESSION_ID, user_id: USER_ID, consultant_id: CONSULTANT_ID,
                status: "active", minutes_used: 2, amount_charged: 0, currency_code: "INR",
                rate_per_min: -5, last_tick_at: null, started_at: new Date().toISOString(),
              },
              error: null,
            },
          ],
        }),
    }));
    const { POST } = await import("@/app/api/connect/sessions/[id]/tick/route");
    const res = await POST(makeTickRequest(), { params: Promise.resolve({ id: SESSION_ID }) });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("session_rate_invalid");
  });
});
