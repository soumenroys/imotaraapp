/**
 * ⛔ THREE PIECES OF INDIRECT EVIDENCE DO NOT ADD UP TO ONE DIRECT ANSWER.
 *
 * 🔴 THE EVENING THIS COST, 19 Oct 2026. Facebook refused every post's
 * figures: "requires the 'pages_read_engagement' permission". And:
 *
 *   • the permission WAS ticked when the token was generated
 *   • the app HOLDS it, with 74 recorded calls
 *   • the token's last four characters did NOT change when a new one was pasted
 *
 * ⚠️ Every one of those is evidence about something OTHER than the token's
 * actual scopes, and stacking them produced a confident wrong answer twice
 * ⇒ trap_a_model_invents_specifics_it_cannot_have.
 *
 * ⇒ `/debug_token` says it outright. One call, and the guessing stops.
 */

import { describe, it, expect } from "vitest";
import { describeToken } from "@/lib/social/adapters/facebook";

const answering = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("asking the token what it can do", () => {
  it("🔑 reports the scopes, the validity and the expiry", async () => {
    const r = await describeToken({
      token: "t",
      fetchImpl: answering({
        data: {
          scopes: ["pages_show_list", "pages_manage_posts", "read_insights"],
          app_id: "2707120403075565",
          is_valid: true,
          expires_at: 0,
          type: "PAGE",
        },
      }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scopes).toContain("pages_manage_posts");
    // 🔴 The question that started this: is it there or not?
    expect(r.scopes).not.toContain("pages_read_engagement");
    expect(r.valid).toBe(true);
    // ⚠️ 0 means NEVER, which is not the same as unknown.
    expect(r.expiresAt).toBeNull();
  });

  it("⛔ an empty scope list is an ANSWER, not a missing value", async () => {
    // 🔑 "This token carries nothing" is the most useful thing it could say,
    // and it must not be rendered as a blank.
    const r = await describeToken({ token: "t", fetchImpl: answering({ data: { scopes: [], is_valid: true } }) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scopes).toEqual([]);
  });

  it("reports a real expiry as a date", async () => {
    const r = await describeToken({
      token: "t",
      fetchImpl: answering({ data: { scopes: [], is_valid: true, expires_at: 1_800_000_000 } }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expiresAt).toMatch(/^20\d\d-/);
  });

  it("⚠️ a dead token is reported as invalid, not as an error", async () => {
    // ⛔ `is_valid: false` IS the answer. Treating it as a failure would hide
    // the one case somebody most needs to see.
    const r = await describeToken({ token: "t", fetchImpl: answering({ data: { scopes: [], is_valid: false } }) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valid).toBe(false);
  });

  it("passes a Graph error through the normal classifier", async () => {
    const r = await describeToken({
      token: "t",
      fetchImpl: answering({ error: { message: "Invalid OAuth access token", code: 190 } }),
    });
    expect(r.ok).toBe(false);
  });

  it("⛔ NEVER returns the token itself", async () => {
    /**
     * 🔴 THE LINE THIS MUST NOT CROSS. The result is rendered on an admin
     * screen. A describe-function that echoed its input would put a live
     * credential on a page, in a browser, in a screenshot.
     */
    const r = await describeToken({
      token: "SECRET-TOKEN-VALUE",
      fetchImpl: answering({ data: { scopes: ["pages_show_list"], is_valid: true } }),
    });
    expect(JSON.stringify(r)).not.toContain("SECRET-TOKEN-VALUE");
  });

  it("⚠️ does not put an app secret in this path at all", async () => {
    /**
     * 🔑 `/debug_token` normally wants an APP access token to ask about
     * somebody else's. Asking about your OWN with the same token is allowed —
     * and an app secret is a worse thing to hold than the token it inspects.
     */
    let url = "";
    await describeToken({
      token: "t",
      fetchImpl: (async (u: string) => {
        url = u;
        return new Response(JSON.stringify({ data: { scopes: [], is_valid: true } }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(url).toContain("debug_token");
    expect(url.toLowerCase(), "an app secret reached the query string").not.toMatch(/client_secret|app_secret/);
  });
});
