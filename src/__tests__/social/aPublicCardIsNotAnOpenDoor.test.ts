/**
 * 🔴 THE ONE PUBLIC ROUTE IN THIS FEATURE.
 *
 * Facebook takes the card as bytes. Instagram does not: it is handed an
 * `image_url` and fetches the image itself, from Meta's servers, carrying
 * none of our credentials. So the card must be reachable by a stranger — and
 * everything these tests pin is what stops "reachable by a stranger" from
 * becoming "every draft we have ever written, readable by anybody who can
 * count".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";

process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 7).toString("base64");

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const route = read("src/app/api/social/card/[id]/route.ts");

/** ⚠️ The same file with every comment removed. A test that reads the prose
 *  explaining a rule passes just as happily when the rule itself is gone. */
const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ⚠️ Imported after the key is set: the module reads it on first use.
const { signCardId, cardSignatureValid, cardIsFetchable, cardUrlFor, FETCHABLE_STATUSES } =
  await import("@/lib/social/cardUrl");

const ID = "b1b9f1f6-0000-4000-8000-000000000001";
const OTHER = "b1b9f1f6-0000-4000-8000-000000000002";

describe("the signature is the only thing standing in front of this route", () => {
  it("is long enough that it cannot be guessed", () => {
    // 🔑 32 hex characters = 128 bits. ⛔ A public route is something anybody
    // may try as often as they like, so a shortened "it is only an image"
    // tag is not a smaller risk, it is the whole risk.
    expect(signCardId(ID)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is different for every post, so one valid link does not open another", () => {
    expect(signCardId(ID)).not.toBe(signCardId(OTHER));
    // ⛔ The failure this catches: a signature over a constant, which would
    // validate for every id in the table at once.
    expect(cardSignatureValid(OTHER, signCardId(ID))).toBe(false);
  });

  it("accepts the right one and nothing else", () => {
    const good = signCardId(ID);
    expect(cardSignatureValid(ID, good)).toBe(true);
    expect(cardSignatureValid(ID, good.slice(0, -1))).toBe(false);
    expect(cardSignatureValid(ID, good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(cardSignatureValid(ID, "")).toBe(false);
    expect(cardSignatureValid(ID, null)).toBe(false);
    expect(cardSignatureValid(ID, undefined)).toBe(false);
  });

  it("does not throw on a signature that is not even hex", () => {
    // ⚠️ timingSafeEqual throws on a length mismatch, and an uncaught throw
    // here is a 500 that tells an attacker their guess was the wrong SHAPE.
    expect(() => cardSignatureValid(ID, "🙂".repeat(40))).not.toThrow();
    expect(cardSignatureValid(ID, "🙂".repeat(40))).toBe(false);
  });

  it("signs with a derived subkey, not with the token key itself", () => {
    /**
     * 🔑 One secret must not do two unrelated jobs. This pins the derivation
     * rather than the comment describing it: signing straight with
     * SOCIAL_TOKEN_KEY would produce this value, and it must not.
     */
    const naive = createHmac("sha256", Buffer.from(process.env.SOCIAL_TOKEN_KEY!, "base64"))
      .update(`card:${ID}`)
      .digest("hex")
      .slice(0, 32);
    expect(signCardId(ID)).not.toBe(naive);
  });

  it("refuses to sign at all when there is no key", () => {
    // ⛔ The alternative — serving unsigned "for now" — is the open door.
    const saved = process.env.SOCIAL_TOKEN_KEY;
    delete process.env.SOCIAL_TOKEN_KEY;
    try {
      expect(() => signCardId(ID)).toThrow(/SOCIAL_TOKEN_KEY/);
    } finally {
      process.env.SOCIAL_TOKEN_KEY = saved;
    }
  });
});

describe("a signed link only ever opens words somebody approved", () => {
  it("opens the three states in which the words are cleared for publication", () => {
    // `publishing` is the state the row is in at the exact moment Instagram
    // arrives for the image — omitting it would make every publish fail.
    expect(cardIsFetchable("approved")).toBe(true);
    expect(cardIsFetchable("publishing")).toBe(true);
    expect(cardIsFetchable("published")).toBe(true);
  });

  it("refuses a draft and anything awaiting review, signature or no signature", () => {
    // ⛔ Confession posts are forced to needs_review by design ⇒ pipeline.ts.
    // A signed link to one could be forwarded.
    expect(cardIsFetchable("draft")).toBe(false);
    expect(cardIsFetchable("needs_review")).toBe(false);
    expect(cardIsFetchable("skipped")).toBe(false);
    expect(cardIsFetchable("failed")).toBe(false);
    expect(cardIsFetchable(null)).toBe(false);
    expect(cardIsFetchable(undefined)).toBe(false);
    expect([...FETCHABLE_STATUSES]).not.toContain("needs_review");
  });
});

describe("the URL is one a platform's fetcher can actually use", () => {
  it("is absolute, carries the id and the signature", () => {
    const url = cardUrlFor(ID, "https://example.test");
    expect(url).toBe(`https://example.test/api/social/card/${ID}?t=${signCardId(ID)}`);
  });

  it("never points at localhost by accident", () => {
    // ⚠️ Instagram fetches this from outside. A localhost or preview origin
    // fails at publish with an error about the image, not about the URL.
    expect(cardUrlFor(ID)).toMatch(/^https:\/\//);
    expect(cardUrlFor(ID)).not.toMatch(/localhost|127\.0\.0\.1/);
  });
});

describe("the route itself", () => {
  it("checks the signature before it touches the database", () => {
    /**
     * ⚠️ Order, not presence. Looking the post up first would answer "does a
     * post with this id exist?" to anybody who asks.
     * ⛔ Pinned with lastIndexOf for the signature check and indexOf for the
     * query, so deleting the check does not quietly make this pass
     * ⇒ trap_a_mirror_test_cannot_catch_a_refactor.
     */
    const check = route.indexOf("cardSignatureValid");
    const query = route.indexOf("from(\"social_posts\")");
    expect(check).toBeGreaterThan(-1);
    expect(query).toBeGreaterThan(-1);
    expect(check).toBeLessThan(query);
  });

  it("answers 404 rather than 403, so a real id is never confirmed", () => {
    expect(route).not.toMatch(/status:\s*403/);
    // Three refusals: bad signature, no such post, not fetchable.
    expect(route.match(/status:\s*404/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("serves JPEG, because Instagram takes nothing else", () => {
    /**
     * 🔴 The failure this catches is the one I shipped into this file and
     * caught on re-reading: the route rendered through `renderPostPicture`,
     * which is PNG. Instagram would have failed at the media-container call
     * with an error about the image — which reads like a broken card.
     */
    expect(route).toContain("renderPostPictureJpeg");
    expect(route).toContain('"content-type": "image/jpeg"');
    expect(route).not.toMatch(/\brenderPostPicture\(/);
  });

  it("never answers a render failure with a placeholder image", () => {
    /**
     * ⛔ Instagram would accept a placeholder and publish it, and the first
     * anybody knew would be a broken card on the timeline.
     *
     * 🔴 ASSERTED ON CODE WITH THE COMMENTS STRIPPED. The first version of
     * this test matched the word "placeholder" in the comment that explains
     * the rule — it would have passed with the rule deleted and the comment
     * left behind ⇒ trap_text_assertions_cannot_see_reachability.
     */
    const failure = code.slice(code.indexOf("if (!rendered.ok)"));
    expect(failure).toContain("rendered.failure.status");
    expect(failure).not.toMatch(/placeholder|fallback/i);
    // And the refusal is the FIRST thing the block does, not something
    // appended after an earlier return ⇒ trap_code_after_an_early_return_is_dead_code.
    expect(failure.slice(0, failure.indexOf("}") + 1)).toContain("return new NextResponse");
  });
});
