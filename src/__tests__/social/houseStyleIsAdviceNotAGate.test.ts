/**
 * ⛔ THE COUNTABLE RULES MUST BE COUNTED — AND MUST STAY ADVICE, NOT A GATE.
 *
 * 🔑 THE DISTINCTION THIS FILE PROTECTS. `checkVoice` returns findings that
 * REJECT a draft: a clinical claim or an abusive word is not a matter of taste
 * and a person may not wave it through. `checkHouseStyle` returns problems that
 * a person may knowingly overrule — a post three characters over LinkedIn's
 * fold is a judgement call, not a violation.
 *
 * ⚠️ Collapsing the two in either direction is a real failure. Make house style
 * blocking and a reviewer fights the tool over a hashtag; fold the gate into
 * advice and a regulated title becomes a suggestion.
 *
 * 🔴 THIS FILE EXISTS BECAUSE A MUTATION RUN FOUND NOTHING TESTING IT. Deleting
 * the emoji check broke no test, so every rule here was decorative.
 */

import { describe, it, expect } from "vitest";
import { checkHouseStyle, checkVoice, PLATFORM_LIMITS } from "@/lib/social/voiceGate";
import { PLATFORM_IDS } from "@/lib/social/platforms";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("what it counts", () => {
    /**
     * 🔑 THE RULES BECAME PER-CHANNEL ON 18 OCT. The owner asked for anything
     * that costs reach and is not there for safety to come out, and the global
     * values were costing it: no emoji anywhere, two hashtags everywhere (too
     * few for Instagram, pointless on Facebook), one link allowed in a body
     * where Meta and LinkedIn both demote it.
     *
     * ⛔ NOTHING IN `checkVoice` MOVED. The clinical vocabulary, the crisis
     * language and the abuse lists are not style, and reach is not a reason to
     * relax one of them — the last describe block in this file is what keeps
     * that true.
     */
    it("allows the one emoji a person would type, and objects to decoration", () => {
        const one = checkHouseStyle("Somewhere to say how you actually feel 🙂", "facebook");
        expect(one.emoji).toBe(1);
        expect(one.problems.join(" ")).not.toMatch(/emoji/i);

        const several = checkHouseStyle("Somewhere to say how you feel 🙂✨💛", "facebook");
        expect(several.emoji).toBe(3);
        expect(several.problems.join(" ")).toMatch(/emoji/i);
    });

    /**
     * 🔴 THE OLD VERSION OF THIS TEST DID NOT TEST ITS OWN TITLE. It was called
     * "counts a multi-codepoint emoji as one" and asserted only
     * `toBeGreaterThan(0)` — which is true of three. It passed for weeks over
     * a counter that reported 👩‍👩‍👧 as three joined people.
     *
     * ⛔ Harmless while the rule was "none", and a live defect the moment the
     * rule became "at most one": the only posts it would have rejected are the
     * ones using an emoji that names a family or a country.
     */
    it("counts a joined emoji as the one thing a reader sees", () => {
        expect(checkHouseStyle("Hello 👩‍👩‍👧", "facebook").emoji, "ZWJ family").toBe(1);
        expect(checkHouseStyle("Hello 👋🏽", "facebook").emoji, "skin tone modifier").toBe(1);
        expect(checkHouseStyle("Hello 🇮🇳", "facebook").emoji, "regional indicator pair").toBe(1);
        expect(checkHouseStyle("Hello 👩‍👩‍👧", "facebook").problems.join(" ")).not.toMatch(/emoji/i);
        // ⚠️ And still counts three separate ones as three.
        expect(checkHouseStyle("🙂✨💛", "facebook").emoji).toBe(3);
    });

    it("counts hashtags against THIS channel's number, not one global number", () => {
        // LinkedIn: three is normal, four is not.
        expect(checkHouseStyle("A post #one #two #three", "linkedin").problems.join(" ")).not.toMatch(/hashtag/i);
        expect(checkHouseStyle("A post #one #two #three #four", "linkedin").problems.join(" ")).toMatch(/hashtag/i);
        // Instagram: five, because it is the one channel where tags still reach.
        expect(checkHouseStyle("A post #a #b #c #d #e", "instagram").problems.join(" ")).not.toMatch(/hashtag/i);
        // Facebook: none. ⚠️ Two hashtags used to pass here and did nothing but
        // make the post look like an advert.
        expect(checkHouseStyle("A post #one", "facebook").problems.join(" ")).toMatch(/hashtag/i);
    });

    it("counts a hashtag in a non-Latin script", () => {
        // A Bengali or Tamil hashtag is still a hashtag. A `[A-Za-z0-9]` class
        // would have counted zero on a post in 19 of the 22 languages.
        const r = checkHouseStyle("কথা #বাংলা #ভাষা #মন", "facebook");
        expect(r.hashtags).toBe(3);
        expect(r.ok).toBe(false);
    });

    /**
     * 🔴 A LINK IN THE BODY IS A REACH DECISION, NOT A TIDINESS ONE. Facebook
     * and LinkedIn demote a post that sends people off-platform, and Instagram
     * does not make a caption link clickable at all — so the old "one link is
     * fine" rule was quietly paying for nothing on three of the five channels.
     */
    it("refuses a body link on four channels, and tells each one its OWN reason", () => {
        /**
         * 🔴 X JOINED THIS LIST ON 19 Oct, and for a reason the others do not
         * share: the owner moved to pay-per-use, where a post containing a URL
         * is charged **$0.200 instead of $0.015**. The cost is no longer reach
         * — it is money.
         *
         * ⛔ AND THE MESSAGE USED TO SAY THE WRONG THING. It told every channel
         * "it costs the post most of its reach", which is Facebook's reason;
         * on Instagram the link is not even clickable. A gate that gives the
         * wrong reason teaches the wrong lesson, however right its verdict.
         */
        for (const p of ["facebook", "linkedin", "instagram", "x"]) {
            const r = checkHouseStyle("Read https://www.imotara.com today", p);
            expect(r.links, p).toBe(1);
            expect(r.problems.join(" "), p).toMatch(/link/i);
            // ⚠️ Every refusal points at where the destination actually lives.
            expect(r.problems.join(" "), p).toMatch(/QR codes/);
        }
        expect(checkHouseStyle("Read https://www.imotara.com", "instagram").problems.join(" ")).toMatch(/not make it clickable/);
        expect(checkHouseStyle("Read https://www.imotara.com", "x").problems.join(" ")).toMatch(/thirteen times/);
        expect(checkHouseStyle("Read https://www.imotara.com", "facebook").problems.join(" ")).toMatch(/most of its reach/);
        // 🔑 YouTube is the one channel where a link is a service, not a leak.
        expect(checkHouseStyle("Read https://www.imotara.com today", "youtube").problems.join(" ")).not.toMatch(/link/i);

        const two = checkHouseStyle("https://www.imotara.com and https://www.imotara.com/help", "x");
        expect(two.links).toBe(2);
        expect(two.problems.join(" ")).toMatch(/link/i);
    });

    it("says that Instagram would not even make the link clickable", () => {
        // ⚠️ The reason belongs in the message. "No links here" invites somebody
        // to overrule it; "it is not clickable anyway" does not.
        expect(checkHouseStyle("https://www.imotara.com", "instagram").problems.join(" ")).toMatch(/clickable/i);
    });

    it("counts characters by code point, not by UTF-16 unit", () => {
        // ⚠️ `.length` counts UTF-16 units, so text outside the basic plane is
        // over-counted and a post could be reported as over a limit it is
        // nowhere near — on exactly the channels this feature exists to serve.
        // ⛔ Code points are not graphemes either, and no platform counts the
        // same way (X weights its own); these numbers are for the reviewer's
        // judgement, which is why length is advice and not a gate.
        const r = checkHouseStyle("ইমোতারা", "x");
        expect(r.characters).toBeLessThan(10);
        /**
         * ⚠️ PINNED ON THE CONSEQUENCE OF OVER-COUNTING, not on `ok`.
         *
         * The bug would report a short post as OVER a limit. `ok` used to
         * stand in for that and stopped being able to on 19 Oct, when a
         * too-SHORT note was added and this seven-character fixture started
         * drawing one — correctly, and for a reason that has nothing to do
         * with counting. ⛔ A test whose assertion is only incidentally
         * related to its subject breaks on changes that do not concern it.
         */
        expect(r.problems.join(" ")).not.toMatch(/will not accept|behind "see more"/);

        /**
         * ⚠️ THE ASSERTION ABOVE CANNOT CATCH THE BUG, which a mutation run
         * showed: Bengali lives in the basic plane, so [...text].length and
         * text.length agree and swapping one for the other breaks nothing. The
         * difference only appears OUTSIDE that plane — so the case has to use
         * a surrogate pair to assert anything at all.
         */
        const astral = "\u{1F469}\u{1F3FD}";       // one person, two code points
        expect(astral.length, "the fixture is not a surrogate pair").toBe(4);
        expect(checkHouseStyle(astral, "x").characters).toBe(2);
    });
});

describe("the platform limits", () => {
    /**
     * 🔴 THIS LIST USED TO BE A SECOND COPY and it had already drifted: it
     * carried no `youtube` row, so a YouTube post was the one kind that fell
     * through `Object.hasOwn` and was never measured — which looks exactly
     * like passing. It is now a view of PLATFORMS, and this test walks EVERY
     * platform rather than a hand-written four.
     */
    it("knows a hard ceiling and a fold point for every platform it may post to", () => {
        for (const platform of PLATFORM_IDS) {
            const limit = PLATFORM_LIMITS[platform];
            expect(limit, `no limits for ${platform}`).toBeTruthy();
            expect(limit.soft).toBeLessThanOrEqual(limit.hard);
        }
        expect(Object.keys(PLATFORM_LIMITS).sort()).toEqual([...PLATFORM_IDS].sort());
    });

    /**
     * 🔴 LINKEDIN'S FOLD WAS RECORDED AS 1300 AND IT IS ABOUT 210. The number
     * was not merely wrong in a table — it was handed to the writer as a fact
     * ("that is where this channel folds it"), so posts were written past the
     * fold with the instruction's blessing and the only words most people ever
     * saw were two lines nobody had been asked to make count.
     */
    it("puts LinkedIn's fold where LinkedIn actually folds", () => {
        expect(PLATFORM_LIMITS.linkedin.soft).toBeLessThan(400);
        const pastTheFold = checkHouseStyle("a".repeat(600), "linkedin");
        expect(pastTheFold.problems.join(" ")).toMatch(/see more/i);
    });

    it("distinguishes 'the platform will refuse this' from 'the reader sees see-more'", () => {
        const folded = checkHouseStyle("a".repeat(1500), "linkedin");
        expect(folded.problems.join(" ")).toMatch(/see more/i);
        expect(folded.problems.join(" ")).not.toMatch(/will not accept/i);

        const refused = checkHouseStyle("a".repeat(4000), "linkedin");
        expect(refused.problems.join(" ")).toMatch(/will not accept/i);
    });

    /**
     * ⛔ CHANGED DELIBERATELY ON 18 OCT. Silence used to be the answer for an
     * unknown channel, on the reasoning that a made-up ceiling is worse than
     * none. But silence here is indistinguishable from a clean post, and that
     * is precisely how the missing `youtube` row hid: the honest answer is to
     * say that nothing could be checked.
     */
    it("refuses to wave through a channel it does not know", () => {
        const r = checkHouseStyle("a".repeat(5000), "mastodon");
        expect(r.ok).toBe(false);
        expect(r.problems.join(" ")).toMatch(/not a channel this product knows/i);
        // ⛔ And still invents no ceiling for it.
        expect(r.problems.join(" ")).not.toMatch(/will not accept more than/i);
    });
});

/**
 * 🔑 "try to be more humanized than AI generated content" — the owner, 18 Oct.
 *
 * ⛔ A PROMPT CANNOT CARRY THAT ALONE. A model asked to sound human still
 * reaches for these phrases, because they are the median of what it read. So
 * the instruction is in the prompt AND the result is counted here, which is
 * this codebase's standing division of labour ⇒ src/lib/social/writer.ts.
 */
describe("the phrases that announce a machine wrote it", () => {
    it("catches the throat-clearing opener", () => {
        const r = checkHouseStyle("In today's fast-paced world, everybody needs a moment.", "facebook");
        expect(r.aiTells).toContain("in today's fast-paced world");
        expect(r.problems.join(" ")).toMatch(/machine-written/i);
    });

    it("catches a curly apostrophe, which is what a model actually emits", () => {
        // ⚠️ Without normalising, `it's` would never match `it’s` and the whole
        // list would silently match nothing — worse than having no list.
        expect(checkHouseStyle("Let’s be honest about this.", "facebook").aiTells).toContain("let's be honest");
    });

    it("catches engagement bait, which the platforms demote by policy", () => {
        // 🔑 A reach rule, not a matter of taste.
        expect(checkHouseStyle("Tag a friend who needs this.", "facebook").aiTells).toContain("tag a friend");
    });

    /**
     * ⛔ NOT A LIST OF "AI WORDS". `delve`, `realm`, `tapestry` and the rest of
     * that folklore are ordinary English. Banning real words makes the writing
     * worse, which is the opposite of the point.
     */
    it("leaves ordinary English alone", () => {
        const human =
            "Most of the hard hours are not office hours. We delve into whatever you bring, in " +
            "whichever of 22 languages you think in.";
        expect(checkHouseStyle(human, "facebook").aiTells).toEqual([]);
    });

    it("is advice, not a gate — the voice check is untouched by it", () => {
        const r = checkVoice("In today's world, here's the thing: at the end of the day, tag a friend.", "en");
        expect(r.ok, "an AI-sounding post was REJECTED rather than flagged").toBe(true);
    });
});

describe("advice and the gate stay separate", () => {
    it("a post that is only over-long is clean by the gate", () => {
        const long = "A plain sentence about nothing in particular. ".repeat(60);
        expect(checkVoice(long, "en").ok, "the gate rejected a post for being long").toBe(true);
        expect(checkHouseStyle(long, "linkedin").ok).toBe(false);
    });

    it("a post that is tidy but makes a claim is rejected by the gate", () => {
        /**
         * ⚠️ A REAL POST'S LENGTH, because the fixture used to be one line.
         * Since 19 Oct the house style also notes a post that is too SHORT
         * for its channel, and a four-word fixture drew that note — which
         * would have made this read as "house style objected to a claim",
         * the exact confusion the test exists to prevent.
         *
         * 🔑 The point is unchanged and is the whole reason these are two
         * functions: the writing here is tidy, and it still must not publish.
         */
        const copy =
            "Our therapist is here whenever you want to talk, at any hour, in whichever of the " +
            "twenty-two languages you happen to think in. Nothing is stored unless you ask for it.";
        expect(checkHouseStyle(copy, "linkedin").ok, "house style objected to a tidy post").toBe(true);
        expect(checkVoice(copy, "en").ok).toBe(false);
    });

    it("house style returns problems, never findings", () => {
        // 🔑 Structural. If these two ever return the same shape, the admin can
        // render a matter of taste with the same weight as a regulated title.
        const style = checkHouseStyle("Hello 🙂", "facebook");
        expect(Array.isArray(style.problems)).toBe(true);
        expect("findings" in style).toBe(false);
        expect("problems" in checkVoice("Hello", "en")).toBe(false);
    });

    it("a clean, plain post passes both", () => {
        const copy =
            "Most of the hard hours are not office hours. Imotara is awake then, in whichever " +
            "of 22 languages you think in. It is not therapy and does not pretend to be.";
        expect(checkVoice(copy, "en").ok).toBe(true);
        expect(checkHouseStyle(copy, "linkedin").ok).toBe(true);
    });
});

/**
 * 🔴 A HASHTAG IN A SCRIPT THAT USES COMBINING MARKS.
 *
 * Imotara writes in 22 languages. `[\p{L}\p{N}_]` excludes `\p{M}`, so the
 * Bengali vowel signs in অভিমান are not matched: `#অভিমান` came out as `#অভ`.
 *
 * ⚠️ AND IT HAS NO BEHAVIOURAL CONSEQUENCE TODAY, which is said here rather
 * than hidden behind a test that looks like proof. The only caller takes
 * `.length`, and a truncated match still counts as one tag — so every
 * behavioural assertion I tried passed just as happily with the bug in place.
 * My first attempt at this test "passed" by rebuilding the regex in the test
 * file ⇒ trap_a_mirror_test_cannot_catch_a_refactor: it was checking its own
 * copy, not the code.
 *
 * ⛔ So this pins the SOURCE, and says why. The fix is worth keeping because
 * the next caller to read the matched text instead of counting it would get a
 * truncated Bengali word with nothing to warn them.
 */
describe("hashtags in scripts that use combining marks", () => {
  const gate = readFileSync(join(process.cwd(), "src/lib/social/voiceGate.ts"), "utf8");

  it("the hashtag pattern accepts combining marks", () => {
    const line = gate.split("\n").find((l) => l.includes("const hashtags ="));
    expect(line).toBeDefined();
    expect(line).toContain("\\p{M}");
  });

  it("the pattern it pins actually matches a whole Bengali tag", () => {
    // ⚠️ Built FROM the source line, not retyped, so this cannot drift into a
    // mirror of a regex nobody uses.
    const line = gate.split("\n").find((l) => l.includes("const hashtags ="))!;
    const source = line.match(/\/(\(\^\|.*?)\/gu/)![1];
    const re = new RegExp(source, "gu");
    expect("#অভিমান".match(re)?.[0]).toBe("#অভিমান");
    expect("#बहुत".match(re)?.[0]).toBe("#बहुत");
  });

  it("still counts one tag as one tag, in any script", () => {
    const six = "words #a #b #c #d #e #অভিমান";
    expect(checkHouseStyle(six, "instagram").problems.join(" ")).toMatch(/hashtag/i);
  });
});
