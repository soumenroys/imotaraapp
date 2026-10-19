/**
 * ⛔ LINKEDIN'S `commentary` IS NOT PLAIN TEXT, AND NOTHING SAYS SO AT RUNTIME.
 *
 * 🔴 THE TRAP, and it is one no amount of reasoning would have produced — it
 * came from reading the docs on 19 Oct 2026:
 *
 *     "All reserved characters need to be escaped with a backslash, EVEN IF
 *      those characters are not used in one of the supported elements or
 *      templates."
 *
 * ⚠️ The reserved set is wide and entirely ordinary: `| { } @ [ ] ( ) < > # \
 * * _ ~`. Our posts carry parentheses constantly and this channel allows
 * three hashtags. A body sent raw would have rendered wrong, or been refused,
 * on every single post ⇒ trap_a_model_invents_specifics_it_cannot_have, which
 * is why this was looked up rather than assumed.
 */

import { describe, it, expect } from "vitest";
import {
  littleText,
  linkedinVersion,
  DEFAULT_LINKEDIN_VERSION,
  classifyLinkedInError,
  publishToLinkedIn,
} from "@/lib/social/adapters/linkedin";

describe("little text", () => {
  it("leaves ordinary prose alone", () => {
    const plain = "There is a stretch of the night when nobody answers. Imotara is awake then.";
    expect(littleText(plain)).toBe(plain);
  });

  it("⛔ escapes the parentheses our posts are full of", () => {
    expect(littleText("a thing (like this) happens")).toBe("a thing \\(like this\\) happens");
  });

  it("escapes every reserved character, even in isolation", () => {
    for (const ch of ["|", "{", "}", "@", "[", "]", "(", ")", "<", ">", "*", "_", "~"]) {
      expect(littleText(`x${ch}y`), `${ch} was not escaped`).toBe(`x\\${ch}y`);
    }
  });

  it("⛔ escapes a backslash FIRST, or it escapes its own escapes", () => {
    /**
     * 🔴 THE ORDERING BUG THIS PINS. Escape `(` first and you have `\(`; then
     * escaping `\` turns it into `\\(` — a literal backslash followed by an
     * unescaped bracket, which is the opposite of what was wanted.
     */
    expect(littleText("a \\ b")).toBe("a \\\\ b");
    expect(littleText("a \\( b")).toBe("a \\\\\\( b");
  });

  it("🔑 a real hashtag survives as a hashtag, in the documented template", () => {
    // ⚠️ `#` is reserved, so a tag sent raw would be escaped into literal text
    // and the post would show "#theunsaid" as words rather than a tag.
    expect(littleText("the thing nobody said #theunsaid")).toBe(
      "the thing nobody said {hashtag|\\#|theunsaid}",
    );
  });

  it("⛔ a tag containing an underscore keeps it escaped INSIDE the template", () => {
    // 🔑 `_` is reserved too, and it is legal in a hashtag.
    expect(littleText("x #my_tag")).toBe("x {hashtag|\\#|my\\_tag}");
  });

  it("⚠️ a bare `#` that is NOT a tag stays literal", () => {
    // ⛔ "number #1" must not become a hashtag, and must not break the parse.
    expect(littleText("number # 1")).toBe("number \\# 1");
  });

  it("handles several tags, and tags at the very start", () => {
    expect(littleText("#one and #two")).toBe("{hashtag|\\#|one} and {hashtag|\\#|two}");
  });

  it("⛔ does not invent a tag out of a mid-word hash", () => {
    // 🔑 The pattern requires start-of-string or whitespace before the `#`,
    // the SAME rule the gate counts by ⇒ voiceGate. If the two disagreed, a
    // post judged to carry three tags could publish carrying two.
    expect(littleText("a#b")).toBe("a\\#b");
  });

  it("escapes a non-Latin body's punctuation without touching its letters", () => {
    // ⚠️ Bengali text is not reserved; the brackets around it are.
    expect(littleText("অভিমান (the hurt)")).toBe("অভিমান \\(the hurt\\)");
  });
});

describe("the version header", () => {
  it("⛔ is not a constant in the file, because LinkedIn SUNSETS versions", () => {
    /**
     * 🔴 The docs read 19 Oct 2026 carry "Marketing Version 202511 will be
     * sunset on November 16, 2026". A hardcoded version is a channel that
     * dies on a date nobody wrote down, and the symptom is a quiet feed.
     */
    expect(linkedinVersion({} as NodeJS.ProcessEnv)).toBe(DEFAULT_LINKEDIN_VERSION);
    expect(linkedinVersion({ LINKEDIN_API_VERSION: "202701" } as unknown as NodeJS.ProcessEnv)).toBe("202701");
  });

  it("⛔ refuses a malformed override rather than sending it", () => {
    // ⚠️ LinkedIn answers a bad version with an error that says nothing about
    // the version ⇒ the Graph version that was read as a node id.
    for (const bad of ["2026-10", "v2", "20261", "2026100", "latest"]) {
      expect(() => linkedinVersion({ LINKEDIN_API_VERSION: bad } as unknown as NodeJS.ProcessEnv), bad).toThrow(/YYYYMM/);
    }
  });

  it("DEFAULT is itself well formed", () => {
    expect(DEFAULT_LINKEDIN_VERSION).toMatch(/^\d{6}$/);
  });
});

describe("what a failure means", () => {
  it("🔑 separates the two different problems hiding behind 403", () => {
    /**
     * ⛔ The docs say ACCESS_DENIED covers BOTH a missing scope and a missing
     * company page role. Saying only "permission denied" sends somebody to
     * regenerate a token that was never the problem ⇒ the 18 Oct lesson about
     * a generic remedy shouted over a correct diagnosis.
     */
    const { kind, message } = classifyLinkedInError(403, '{"message":"Not enough permissions"}');
    expect(kind).toBe("permission");
    expect(message).toMatch(/w_organization_social/);
    expect(message).toMatch(/ADMINISTRATOR/);
    expect(message, "does not say which to check first").toMatch(/role first/i);
  });

  it("tells a bad token from a refused post from LinkedIn's own trouble", () => {
    expect(classifyLinkedInError(401, "{}").kind).toBe("auth");
    expect(classifyLinkedInError(422, "{}").kind).toBe("content");
    expect(classifyLinkedInError(429, "{}").kind).toBe("rate");
    expect(classifyLinkedInError(503, "{}").kind).toBe("transient");
  });
});

describe("publishing", () => {
  const ok201 = (id: string) =>
    new Response(null, { status: 201, headers: { "x-restli-id": id } });

  it("🔴 reads the post id from the HEADER, which is where LinkedIn puts it", async () => {
    /**
     * ⛔ THE DOCS ARE EXPLICIT: "the response header x-restli-id contains the
     * Post ID". Reading the BODY gets nothing — and the post is live, with no
     * id stored, so our own statistics can never find it again. The same
     * class of mistake as Instagram's first call returning an id that is not
     * the post's ⇒ trap_instagram_takes_a_url_not_an_image.
     */
    let sent: { url: string; init: RequestInit } | null = null;
    const r = await publishToLinkedIn({
      token: "t",
      organizationId: "1234567",
      text: "Awake at an hour with no queue",
      fetchImpl: (async (url: string, init: RequestInit) => {
        sent = { url, init };
        return ok201("urn:li:share:6844785523593134080");
      }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.postId).toBe("urn:li:share:6844785523593134080");
    expect(r.url).toContain("urn:li:share:6844785523593134080");

    const body = JSON.parse(String(sent!.init.body));
    expect(body.author).toBe("urn:li:organization:1234567");
    expect(body.lifecycleState).toBe("PUBLISHED");
    expect(body.visibility).toBe("PUBLIC");
    expect(body.distribution.feedDistribution).toBe("MAIN_FEED");
    const headers = sent!.init.headers as Record<string, string>;
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(headers["Linkedin-Version"]).toMatch(/^\d{6}$/);
  });

  it("⛔ says so rather than claiming success when the id header is absent", async () => {
    // ⚠️ The post may be live. Reporting failure without that caveat invites
    // a second attempt and a duplicate on the feed.
    const r = await publishToLinkedIn({
      token: "t",
      organizationId: "1234567",
      text: "x",
      fetchImpl: (async () => new Response(null, { status: 201 })) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/may well be live/i);
  });

  it("🔑 refuses the vanity name, which is what a human would paste", async () => {
    /**
     * ⛔ The Page is /company/imotara to a person and
     * urn:li:organization:{numeric} to the API. Sending the vanity name gets
     * INVALID_URN_ID, which reads like a bug in the post.
     */
    const r = await publishToLinkedIn({ token: "t", organizationId: "imotara", text: "x" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("content");
    expect(r.message).toMatch(/NUMERIC id/);
    expect(r.message).toMatch(/vanity name/);
  });

  it("⛔ does not call LinkedIn at all without a token", async () => {
    let called = false;
    const r = await publishToLinkedIn({
      token: "   ",
      organizationId: "1234567",
      text: "x",
      fetchImpl: (async () => { called = true; return ok201("x"); }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(called, "it tried to post with no token").toBe(false);
  });

  it("escapes the body on the way out", async () => {
    let body = "";
    await publishToLinkedIn({
      token: "t",
      organizationId: "1234567",
      text: "a thing (like this) #theunsaid",
      fetchImpl: (async (_u: string, init: RequestInit) => {
        body = String(init.body);
        return ok201("urn:li:share:1");
      }) as unknown as typeof fetch,
    });
    const sent = JSON.parse(body).commentary;
    expect(sent).toContain("\\(");
    expect(sent).toContain("{hashtag|\\#|theunsaid}");
  });

  it("attaches an image URN when there is one, and omits content when there is not", async () => {
    const grab = async (imageUrn?: string) => {
      let body = "";
      await publishToLinkedIn({
        token: "t", organizationId: "1234567", text: "x", imageUrn,
        fetchImpl: (async (_u: string, init: RequestInit) => {
          body = String(init.body);
          return ok201("urn:li:share:1");
        }) as unknown as typeof fetch,
      });
      return JSON.parse(body);
    };
    expect((await grab("urn:li:image:abc")).content).toEqual({ media: { id: "urn:li:image:abc" } });
    expect((await grab()).content).toBeUndefined();
  });

  it("⛔ never retries inside the adapter", async () => {
    // 🔑 A retry around a call that MAY have succeeded is how a post gets
    // published twice, and a duplicate on a feed cannot be un-seen. The same
    // rule as the Facebook adapter.
    let calls = 0;
    await publishToLinkedIn({
      token: "t", organizationId: "1234567", text: "x",
      fetchImpl: (async () => { calls += 1; return new Response("{}", { status: 503 }); }) as unknown as typeof fetch,
    });
    expect(calls).toBe(1);
  });
});
