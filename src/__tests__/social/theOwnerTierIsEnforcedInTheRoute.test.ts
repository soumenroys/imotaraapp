/**
 * 🔐 THE PERMISSION RULE, CHECKED WHERE IT IS ACTUALLY ENFORCED.
 *
 * The owner settled this on 17 Oct: social posting is for the owner and Imotara
 * admins, and connecting a channel, replacing a token and switching
 * auto-publish on are *"the someone equivalent permission level of soumenroys
 * or suchismita only"* — both of which are `role = 'owner'`.
 *
 * 🔴 WHY A ROUTE TEST AND NOT A UI ONE. The admin page disables the controls an
 * admin may not use. ⛔ That is a hint, not a gate: anybody who can open the
 * page can also open a terminal. So the assertions below call the HANDLERS and
 * check the status codes, which is the only place the rule is real.
 *
 * ⚠️ Every identity below is a fake signed in through a mocked
 * `requireSuperAdmin`. That is the seam between "who are you" (tested
 * elsewhere, and shared with every other admin route) and "what may you do",
 * which is what this feature added and what this file is for.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type Role = "owner" | "admin" | "connect_reviewer";
let currentRole: Role | null = "owner";

vi.mock("@/app/api/admin/_auth", () => ({
  requireSuperAdmin: async () => {
    if (!currentRole) {
      const { NextResponse } = await import("next/server");
      return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    }
    return {
      ok: true,
      admin: { id: "actor-1", email: "someone@imotara.com", name: "Someone", role: currentRole },
    };
  },
}));

/** ⛔ Nothing in this file may reach a database. Every query throws, so a route
 *  that got past the permission check would fail loudly rather than quietly
 *  appearing to work. */
vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => {
    throw new Error("a route reached the database after the permission check should have refused it");
  },
}));

const post = (url: string, body: unknown) =>
  new NextRequest(new URL(url, "https://www.imotara.com"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const patch = (url: string, body: unknown) =>
  new NextRequest(new URL(url, "https://www.imotara.com"), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  currentRole = "owner";
});

describe("connecting a channel", () => {
  it("is refused for an Imotara admin", async () => {
    const { POST } = await import("@/app/api/admin/social/channels/route");
    currentRole = "admin";
    const res = await POST(
      post("/api/admin/social/channels", {
        platform: "facebook",
        displayName: "Imotara",
        externalId: "123",
        accessToken: "a-token-value",
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/owner tier/i);
  });

  it("is refused for a Connect reviewer", async () => {
    const { POST } = await import("@/app/api/admin/social/channels/route");
    currentRole = "connect_reviewer";
    const res = await POST(post("/api/admin/social/channels", { platform: "facebook" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/scoped to connect/i);
  });

  it("is refused when nobody is signed in", async () => {
    const { POST } = await import("@/app/api/admin/social/channels/route");
    currentRole = null;
    const res = await POST(post("/api/admin/social/channels", { platform: "facebook" }));
    expect(res.status).toBe(401);
  });

  it("⛔ reaches the owner and still refuses to store without a key", async () => {
    /**
     * 🔑 THE ASSERTION THAT MATTERS MOST HERE, and it is not about permissions.
     * Even for the owner, this route will not write a credential it cannot
     * encrypt — a token in a plain column outlives the intention to protect it
     * later, and the row would still be there in a year.
     *
     * ⚠️ SOCIAL_TOKEN_KEY is deliberately absent here, so this exercises the
     * refusal rather than the happy path.
     */
    const previous = process.env.SOCIAL_TOKEN_KEY;
    delete process.env.SOCIAL_TOKEN_KEY;
    try {
      const { POST } = await import("@/app/api/admin/social/channels/route");
      currentRole = "owner";
      const res = await POST(
        post("/api/admin/social/channels", {
          platform: "facebook",
          displayName: "Imotara",
          externalId: "123",
          accessToken: "a-token-value-ending-abcd",
        }),
      );
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatch(/SOCIAL_TOKEN_KEY/);
      // ⛔ And the token is never echoed back, on any path.
      expect(JSON.stringify(json)).not.toContain("a-token-value-ending-abcd");
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_TOKEN_KEY;
      else process.env.SOCIAL_TOKEN_KEY = previous;
    }
  });

  it("⛔ refuses something that is plainly not a token, even from the owner", async () => {
    // ⚠️ A guardrail against the honest mistake of pasting a login into a field
    // meant for a token — not a security control.
    const previous = process.env.SOCIAL_TOKEN_KEY;
    process.env.SOCIAL_TOKEN_KEY = Buffer.alloc(32, 3).toString("base64");
    try {
      const { POST } = await import("@/app/api/admin/social/channels/route");
      currentRole = "owner";
      const res = await POST(
        post("/api/admin/social/channels", {
          platform: "facebook",
          displayName: "Imotara",
          externalId: "123",
          accessToken: "soumenroys@gmail.com",
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/never takes an email or a password/i);
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_TOKEN_KEY;
      else process.env.SOCIAL_TOKEN_KEY = previous;
    }
  });
});

describe("the master switch", () => {
  it("is refused for an Imotara admin, in both directions", async () => {
    const { PATCH } = await import("@/app/api/admin/social/settings/route");
    currentRole = "admin";
    for (const paused of [true, false]) {
      const res = await PATCH(patch("/api/admin/social/settings", { postingPaused: paused }));
      expect(res.status, `postingPaused=${paused} was allowed for an admin`).toBe(403);
    }
  });

  it("validates the input even for the owner", async () => {
    const { PATCH } = await import("@/app/api/admin/social/settings/route");
    currentRole = "owner";
    const res = await PATCH(patch("/api/admin/social/settings", { postingPaused: "yes" }));
    expect(res.status).toBe(400);
  });
});

describe("abuse terms for a language", () => {
  it("are refused for an Imotara admin", async () => {
    /**
     * ⚠️ This one looks like a small edit and is not. Contributing terms is
     * what makes a language eligible for unattended posting, so it is the same
     * power as switching auto-publish on, reached by a different door.
     */
    const { POST } = await import("@/app/api/admin/social/languages/route");
    currentRole = "admin";
    const res = await POST(post("/api/admin/social/languages", { language: "bn", terms: ["x"] }));
    expect(res.status).toBe(403);
  });

  it("refuse a language this product does not speak, for the owner too", async () => {
    const { POST } = await import("@/app/api/admin/social/languages/route");
    currentRole = "owner";
    const res = await POST(post("/api/admin/social/languages", { language: "ko", terms: ["x"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/22 languages/);
  });
});

describe("creating a schedule", () => {
  it("is allowed for an admin while auto-publish is off", async () => {
    const { POST } = await import("@/app/api/admin/social/schedules/route");
    currentRole = "admin";
    /**
     * 🔑 "ALLOWED THROUGH" IS ASSERTED AS "REACHED THE DATABASE".
     *
     * The mocked client throws on use, so a route that passes the permission
     * check dies there — and that throw is positive proof it was not refused.
     * ⛔ Asserting "no error" would have been wrong in the other direction: a
     * 403 returns cleanly, so the test would have passed while the admin was
     * being refused.
     */
    await expect(
      POST(
        post("/api/admin/social/schedules", {
          name: "A schedule",
          brief: "Say one true thing about privacy, plainly, as a person would.",
          platforms: ["facebook"],
          contentType: "text",
          languages: ["en"],
          days: [1],
          postAt: "09:30",
          autoPublish: false,
        }),
      ),
    ).rejects.toThrow(/reached the database/);
  });

  it("⛔ is refused for an admin the moment auto-publish is on", async () => {
    const { POST } = await import("@/app/api/admin/social/schedules/route");
    currentRole = "admin";
    const res = await POST(
      post("/api/admin/social/schedules", {
        name: "A schedule",
        brief: "Say one true thing about privacy, plainly, as a person would.",
        platforms: ["facebook"],
        contentType: "text",
        languages: ["en"],
        days: [1],
        postAt: "09:30",
        autoPublish: true,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/owner tier/i);
  });

  it("rejects a schedule with no language, before any permission question", async () => {
    const { POST } = await import("@/app/api/admin/social/schedules/route");
    currentRole = "owner";
    const res = await POST(
      post("/api/admin/social/schedules", {
        name: "A schedule",
        brief: "Say one true thing about privacy, plainly, as a person would.",
        platforms: ["facebook"],
        contentType: "text",
        languages: [],
        days: [1],
        postAt: "09:30",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no default/i);
  });

  it("rejects short video, which is not built", async () => {
    const { POST } = await import("@/app/api/admin/social/schedules/route");
    currentRole = "owner";
    const res = await POST(
      post("/api/admin/social/schedules", {
        name: "A schedule",
        brief: "Say one true thing about privacy, plainly, as a person would.",
        platforms: ["facebook"],
        contentType: "short_video",
        languages: ["en"],
        days: [1],
        postAt: "09:30",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not built yet/i);
  });
});

describe("turning auto-publish on afterwards", () => {
  it("is refused for an admin", async () => {
    const { PATCH: patchSchedule } = await import("@/app/api/admin/social/schedules/[id]/route");
    currentRole = "admin";
    const res = await patchSchedule(patch("/api/admin/social/schedules/abc", { autoPublish: true }), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(403);
  });

  it("⛔ turning it OFF is NOT owner-only", async () => {
    /**
     * 🔑 THE DIRECTION MATTERS. If both directions were owner-only, an admin
     * who noticed something going wrong could not stop it — and the safe act
     * would be the harder one, which is how it gets skipped in a hurry.
     */
    const { PATCH: patchSchedule } = await import("@/app/api/admin/social/schedules/[id]/route");
    currentRole = "admin";
    // Reaching the database is the proof it was allowed through — see the note
    // in "creating a schedule" above.
    await expect(
      patchSchedule(patch("/api/admin/social/schedules/abc", { autoPublish: false }), {
        params: Promise.resolve({ id: "abc" }),
      }),
    ).rejects.toThrow(/reached the database/);
  });
});

describe("the cron's own door", () => {
  it("refuses a request with no credential", async () => {
    const { cronAuthorised } = await import("@/app/api/admin/social/_guard");
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "a-secret";
    try {
      const req = new NextRequest(new URL("/api/cron/social-queue", "https://www.imotara.com"));
      expect(cronAuthorised(req).ok).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });

  it("accepts the Bearer credential Vercel actually sends", async () => {
    const { cronAuthorised } = await import("@/app/api/admin/social/_guard");
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "a-secret";
    try {
      const req = new NextRequest(new URL("/api/cron/social-queue", "https://www.imotara.com"), {
        headers: { authorization: "Bearer a-secret" },
      });
      expect(cronAuthorised(req).ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });

  it("⛔ refuses when no secret is configured, rather than falling open", async () => {
    // An unauthenticated generator is worse than a dead one.
    const { cronAuthorised } = await import("@/app/api/admin/social/_guard");
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const req = new NextRequest(new URL("/api/cron/social-queue", "https://www.imotara.com"), {
        headers: { authorization: "Bearer anything" },
      });
      const verdict = cronAuthorised(req);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/not set/i);
    } finally {
      if (previous !== undefined) process.env.CRON_SECRET = previous;
    }
  });
});
