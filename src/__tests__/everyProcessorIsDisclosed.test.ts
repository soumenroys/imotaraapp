/**
 * Every third party that receives personal data must be named in the privacy policy.
 *
 * 🔴 WHY THIS EXISTS. On 2026-10-16 the policy's "Data Sharing & Processors"
 * list named three companies — Supabase, OpenAI, Resend — plus an unnamed
 * "our hosting providers". What the code actually did at that moment:
 *
 *   - sent message text to Google (Gemini) whenever OpenAI was slow or failed
 *   - sent reply text to Microsoft Azure Speech in four regions
 *   - sent recorded audio to OpenAI to be transcribed
 *   - sent Connect messages to Google Cloud Translation, and to MyMemory
 *   - sent billing details to Razorpay
 *   - sent push tokens to Expo
 *
 * and the word "voice" appeared nowhere in the document at all.
 *
 * ⚠️ The worst part was not the omission. The policy made a POSITIVE claim —
 * that your message goes to OpenAI and "is not used to train OpenAI models" —
 * which a reader would reasonably take to mean OpenAI is the only company that
 * sees it. It wasn't.
 *
 * 🔑 This is also a STORE problem, not only a legal one. The Play Data Safety
 * form and the Apple privacy label both have to agree with this page, and the
 * mobile declarations were already more honest than the website.
 *
 * ⛔ WHY THE TEST IS SHAPED THIS WAY. A test that simply asserted "the policy
 * mentions Razorpay" would be a mirror: it passes forever and catches nothing,
 * because it only fails if someone deletes a line. The failure we actually need
 * to catch is the opposite one — a NEW outbound call added months from now and
 * never disclosed. So the source of truth is the CODE: every https host in
 * src/ must be classified, either as a processor that is named in the policy,
 * or as benign. An unclassified host fails the build and makes a human decide.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

/**
 * 🔴 COMMENTS MUST BE STRIPPED BEFORE ANYTHING IS ASSERTED.
 *
 * The first version of this test read the raw file, and two of its three
 * mutations passed when they should have failed. The reason was this test's
 * OWN documentation: the comments added to the policy explaining what the
 * section is for contain the words "Razorpay", "Voice" and "microphone". So
 * `processorList()` matched the comment, not the disclosure, and deleting
 * Razorpay from the user-visible list changed nothing.
 *
 * A privacy test that reads developer comments is testing nothing a reader
 * will ever see. Strip them first, every time.
 */
function stripComments(src: string): string {
    return src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const POLICY = stripComments(
    fs.readFileSync(path.join(ROOT, "src/app/privacy/page.tsx"), "utf8"),
);

/**
 * The processors list only — NOT the whole policy file.
 *
 * ⚠️ Scoping matters. A whole-file `toContain("Razorpay")` would pass on the
 * word appearing in an unrelated sentence, or in a code comment, and would have
 * passed on the very bug this test exists to prevent.
 */
function processorList(): string {
    const start = POLICY.indexOf("Data Sharing &amp; Processors");
    expect(start, "the processors section heading has been renamed").toBeGreaterThan(-1);
    const end = POLICY.indexOf("</section>", start);
    expect(end, "the processors section is not closed").toBeGreaterThan(start);
    return POLICY.slice(start, end);
}

/**
 * Hosts that carry user data. The value is the name that must appear in the
 * processors list — the name a reader would recognise, not the hostname.
 */
const PROCESSOR_HOSTS: Record<string, string> = {
    "api.openai.com": "OpenAI",
    "generativelanguage.googleapis.com": "Google",
    "tts.speech.microsoft.com": "Microsoft Azure Speech",
    "translation.googleapis.com": "Google Cloud Translation",
    "api.mymemory.translated.net": "MyMemory",
    "api.razorpay.com": "Razorpay",
    "checkout.razorpay.com": "Razorpay",
    "exp.host": "Expo",
    "androidpublisher.googleapis.com": "Google Play",
    "api.storekit.apple.com": "Apple",
    "api.storekit-sandbox.apple.com": "Apple",
};

/**
 * Hosts that DO carry personal data but are not yet named in the policy, by the
 * owner's explicit decision ("do not change any privacy policy", 21 Oct 2026).
 *
 * ⚠️ NOT benign. Each one is a disclosure still owed; when the owner approves
 * the wording, move it into PROCESSOR_HOSTS and name it in the policy.
 */
const PROCESSORS_NOT_YET_DISCLOSED: Record<string, string> = {
    // Voice calls to warm contacts ⇒ src/lib/voice. Names, phone numbers and
    // the call itself (recorded for notes) reach Bolna and its telephony
    // partner Vobiz; the contact list and call outcomes live in a Google Sheet.
    "api.bolna.ai": "Bolna",
    "sheets.googleapis.com": "Google Sheets",
};

/**
 * Hosts that are NOT processors: our own domains, outbound links we render,
 * documentation examples, test fixtures, and services that receive no personal
 * data. Analytics is disclosed in its own paragraph rather than this list.
 *
 * ⛔ Do not add a host here to make the build pass. Add it only when you have
 * checked that no personal data reaches it.
 */
const BENIGN_HOSTS = new Set([
    // ours
    "imotara.com", "www.imotara.com", "staging.imotara.com", "soumenroy.com",
    // markup + store/social links we render
    "schema.org", "play.google.com", "apps.apple.com", "findahelpline.com",
    "x.com", "twitter.com", "www.linkedin.com", "www.instagram.com",
    "instagram.com", "www.youtube.com", "www.facebook.com",
    // The Wikidata item, named in schema markup so assistants can resolve what
    // Imotara is. Outbound link only — nothing is sent to it at runtime.
    "www.wikidata.org",
    // A link to the Call Directory sheet on the staff-only /admin/voice page.
    // A link only — the browser of a signed-in admin opens it; nothing is sent.
    "docs.google.com",
    /**
     * The font CDN the picture composer fetches from, SERVER-SIDE, at render
     * time ⇒ src/lib/social/fonts.ts.
     *
     * ✅ Benign, and the reasoning matters rather than the verdict: the fetch
     * is made by the Vercel function, not by a reader's browser, so no visitor
     * IP, cookie or user agent ever reaches jsdelivr. The request body is a
     * font URL. Nothing about a person is in it.
     *
     * ⚠️ IT WOULD NOT BE BENIGN IF A PAGE LINKED IT. A stylesheet or font
     * loaded by the browser sends the reader's IP to a third party, which on
     * this product is a disclosure. ⛔ So if this host ever appears in a
     * `<link>` or an `@font-face` served to a visitor, it stops being benign
     * and belongs in the policy.
     *
     * ▶️ The alternative is bundling the font, which `next/og`'s 500 KB budget
     * makes impractical once more than one script is verified.
     */
    "cdn.jsdelivr.net",
    /**
     * Facebook's Graph API, called SERVER-SIDE by the social scheduler
     * ⇒ src/lib/social/adapters/facebook.ts.
     *
     * ✅ Benign, and again the reasoning is the point rather than the verdict:
     * what travels to it is MARKETING COPY WE WROTE and a token belonging to
     * Imotara's own business portfolio. No visitor IP, no reader's browser, no
     * account holder's words, nothing from a conversation. It is the same
     * relationship as a person posting to their own Page by hand.
     *
     * ⛔ IT STOPS BEING BENIGN THE MOMENT A POST CARRIES SOMETHING A USER
     * WROTE. If the scheduler is ever asked to publish a quote from a
     * conversation, a testimonial, a name, or anything a person typed into the
     * product, that is a disclosure and this entry is wrong — move it to
     * PROCESSOR_HOSTS and name it in the policy. The writer is forbidden from
     * inventing a testimonial today, which is what keeps this line true.
     *
     * ⚠️ This test is also the thing that caught the host arriving at all: the
     * adapter was written and pushed before anybody asked this question.
     */
    "graph.facebook.com",
    /**
     * Google's public daily-trends RSS, read SERVER-SIDE once a morning by
     * src/lib/social/trends.ts (added 24 Oct 2026).
     *
     * ✅ Benign: an anonymous GET of a public feed from the Vercel function.
     * Nothing about any person is sent — no visitor, no user, no content of ours.
     * ⛔ It stops being benign if anything user-derived is ever added to the request.
     */
    "trends.google.com",
    /**
     * LinkedIn's REST API, called SERVER-SIDE by the same scheduler
     * ⇒ src/lib/social/adapters/linkedin.ts.
     *
     * ✅ Benign for EXACTLY the reasons set out for graph.facebook.com above,
     * and that entry's condition applies here word for word: what travels is
     * marketing copy we wrote, plus a token held by Imotara. No visitor IP, no
     * reader's browser, nothing anybody typed into the product.
     *
     * ⛔ AND IT STOPS BEING BENIGN ON THE SAME DAY — the moment a post carries
     * something a user wrote, this entry is wrong and LinkedIn belongs in
     * PROCESSOR_HOSTS and in the policy.
     *
     * ⚠️ 19 Oct: this test caught the host BEFORE the adapter was pushed,
     * which is an improvement on the Facebook entry above, where the same
     * question was asked only after it had shipped.
     */
    /**
     * YouTube's upload host, called SERVER-SIDE to put a Short on the Imotara
     * channel ⇒ src/lib/social/adapters/youtube.ts.
     *
     * 🔴 IT WAS ALREADY IN THIS LIST, AND FOR THE WRONG REASON — grouped under
     * "Google sign-in and the help docs' cloud-storage examples", i.e. a host
     * we LINK to. On 19 Oct it became a host we POST VIDEO BYTES to, and the
     * paragraph a few lines up says exactly what that means: "if any of these
     * ever appears in a `fetch(`, it stops being benign and this entry is
     * wrong." ⇒ Moved here, with the reasoning that actually applies.
     *
     * ✅ Still benign, on the same argument as graph.facebook.com and
     * api.linkedin.com: what travels is a video WE rendered from marketing
     * copy WE wrote, plus a token belonging to Imotara. No visitor IP, no
     * reader's browser, nothing anybody typed into the product.
     *
     * ⛔ AND IT STOPS BEING BENIGN ON THE SAME DAY AS THOSE TWO — the moment a
     * post carries something a user wrote, all three entries are wrong and
     * these hosts belong in PROCESSOR_HOSTS and in the policy.
     *
     * ⚠️ The classification did not change. The STATED REASON did, which is
     * the part a future reader relies on ⇒ a sentence that states the world
     * goes stale.
     */
    "www.googleapis.com",
    /**
     * X's API, called SERVER-SIDE by the scheduler ⇒ src/lib/social/adapters/x.ts.
     *
     * ✅ Benign on the same argument as graph.facebook.com, api.linkedin.com
     * and www.googleapis.com: what travels is marketing copy we wrote, a card
     * we rendered, and a token belonging to Imotara. No visitor IP, no
     * reader's browser, nothing anybody typed into the product.
     *
     * ⚠️ 19 Oct: this is now the FOURTH host in that group, and they all stop
     * being benign on the same day — the moment a post carries something a
     * user wrote, every one of these entries is wrong and the hosts belong in
     * PROCESSOR_HOSTS and in the policy. ⛔ The writer is forbidden from
     * inventing a testimonial, which is what keeps the group true.
     *
     * 💰 One thing that is NOT a disclosure question but is worth knowing
     * here: posting to this host COSTS MONEY per call under pay-per-use.
     */
    "api.x.com",
    "api.linkedin.com",
    /**
     * Microsoft Learn — LinkedIn's API DOCUMENTATION, cited in a comment and
     * never fetched by anything.
     *
     * ✅ It appears once, in the header of the LinkedIn adapter, recording
     * WHERE the request shapes came from. That provenance is worth keeping:
     * this project has published a confident, wrong API specific before
     * ⇒ trap_a_model_invents_specifics_it_cannot_have, and a URL is how the
     * next person checks rather than re-guesses.
     */
    "learn.microsoft.com",
    /**
     * Dictionary and lexicon pages CITED, never fetched.
     *
     * ✅ These appear only as `evidence[].source` strings in
     * src/lib/social/untranslatableWords.ts — the record of what was checked
     * before a word was proposed, so the person confirming it has something to
     * argue with. Nothing in the product requests them at build time or at
     * run time; they are footnotes in data.
     *
     * ⚠️ This test cannot tell a citation from a fetch, and SHOULD NOT try to:
     * the day somebody wires a live dictionary lookup, the host is already in
     * the file and the check would wave it through. ⛔ So if any of these ever
     * appears in a `fetch(`, it stops being benign and this entry is wrong.
     */
    "www.dictionary.com", "www.wiktionary.com", "amarkosh.tech",
    // consoles and status pages we link to in admin/docs
    "status.openai.com", "platform.openai.com", "aistudio.google.com",
    "console.cloud.google.com",
    // Google sign-in and the help docs' cloud-storage examples
    "accounts.google.com", "oauth2.googleapis.com",
    "drive.google.com", "photos.google.com", "mail.google.com",
    "www.dropbox.com", "1drv.ms", "contoso.sharepoint.com", "sso.okta.com",
    "www.paypal.com",
    // analytics — disclosed in its own paragraph, see "Website analytics"
    "www.googletagmanager.com", "www.google-analytics.com",
    // no personal data: public currency rates, webfont CSS
    "open.exchangerate-api.com", "fonts.googleapis.com",
    // documentation placeholders and test fixtures
    "example.com", "yourwebsite.com", "yourorg.com", "test.supabase.co",
    "a.test", "b.test", "i.test", "x.test", "cdn.test", "example.test",
]);

/**
 * Every https host referenced anywhere under src/.
 *
 * ⚠️ TESTS INCLUDED, whatever this comment used to claim. It said "excluding
 * tests" while the grep below scanned all of src — which is why the fixture
 * hosts above (a.test, b.test, cdn.test …) had to be listed one by one by
 * people who presumably read the comment first.
 *
 * 🔑 Left scanning tests on purpose. A fixture host is cheap to declare, and
 * narrowing the sweep to make one test quieter is how a guard stops guarding.
 */
function hostsInSource(): string[] {
    const out = execSync(
        `grep -rhoE 'https://[a-zA-Z0-9.-]+\\.[a-z]{2,}' src --include='*.ts' --include='*.tsx' || true`,
        { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return [...new Set(out.split("\n").filter(Boolean).map((u) => u.replace("https://", "")))];
}

describe("every processor the code talks to is named in the privacy policy", () => {
    for (const [host, name] of Object.entries(PROCESSOR_HOSTS)) {
        it(`names ${name} (for ${host})`, () => {
            expect(processorList()).toContain(name);
        });
    }

    it("does not present OpenAI as the only company that sees your message", () => {
        // The exact false reassurance that shipped. It named one company and
        // promised something about that company only, while a second one was
        // live in production behind it.
        const claim = /Data sent to OpenAI is processed solely to generate your reply/;
        expect(POLICY).not.toMatch(claim);
    });
});

describe("a new outbound host cannot be added without a disclosure decision", () => {
    it("every host in src/ is either a declared processor or explicitly benign", () => {
        const unknown = hostsInSource().filter(
            (h) => !(h in PROCESSOR_HOSTS) && !(h in PROCESSORS_NOT_YET_DISCLOSED) && !BENIGN_HOSTS.has(h),
        );
        expect(
            unknown,
            `Unclassified outbound host(s): ${unknown.join(", ")}.\n` +
                `If user data reaches it, add it to PROCESSOR_HOSTS *and* name it in the ` +
                `privacy policy's processors list. If it carries no personal data, add it ` +
                `to BENIGN_HOSTS with a comment saying why.`,
        ).toEqual([]);
    });
});

describe("voice is disclosed", () => {
    /** The "Information We Collect" section only. */
    function collectSection(): string {
        const start = POLICY.indexOf("Information We Collect");
        const end = POLICY.indexOf("Local-First Storage", start);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        return POLICY.slice(start, end);
    }

    it("tells the reader the microphone records them", () => {
        expect(collectSection()).toMatch(/microphone/i);
    });

    it("says the recording leaves the device to be transcribed", () => {
        expect(collectSection()).toMatch(/transcrib/i);
    });

    it("names who turns replies into speech", () => {
        expect(collectSection()).toContain("Microsoft Azure Speech");
    });

    it("does not list user content as text only", () => {
        // The original sentence enumerated five text types and stopped. If voice
        // is ever dropped back out of the collection section, this is the shape
        // the document falls back into.
        const s = collectSection();
        expect(s).toMatch(/Voice/);
    });
});
