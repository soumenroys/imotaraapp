// The email masthead and the store links in the footer (owner request,
// 2026-09-12).
//
// The owner's overriding requirement for anything added here was: "those mail
// should not be marked as spam at any cost and preferably [land] in the
// primary mailbox instead of promotional." That constraint, not decoration,
// is what these tests are really protecting.
//
// It is why the footer carries TEXT LINKS and not the three QR images that
// were originally asked for: several images plus app-store badges is the
// textbook Promotions-tab signature, and a QR code cannot be scanned by the
// phone displaying it, so on mobile — where most mail is read — it would have
// been pure cost. The QRs belong on a landing page instead.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    headerHtml, headerText, footerHtml, footerText,
    emailDocument, siteBase, PLAY_URL, APPSTORE_URL,
} from "@/lib/broadcast/markup";

const HREF = "https://imotara.com/api/unsubscribe?t=tok";
const originalSite = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
    if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
});

describe("masthead", () => {
    it("carries the brand as TEXT, not only as an image", () => {
        // The point of the whole test file: most clients block remote images
        // by default. A masthead whose brand lives only in a logo renders as
        // an empty box for the majority of readers.
        const html = headerHtml();
        expect(html).toContain(">Imotara</span>");
        expect(html).toContain('alt="Imotara"');
    });

    it("uses an ABSOLUTE logo url — a relative one cannot resolve in email", () => {
        const html = headerHtml();
        expect(html).toMatch(/src="https?:\/\/[^"]+\/icon-192\.png"/);
    });

    it("follows NEXT_PUBLIC_SITE_URL when set, and strips a trailing slash", () => {
        process.env.NEXT_PUBLIC_SITE_URL = "https://staging.imotara.com/";
        expect(siteBase()).toBe("https://staging.imotara.com");
        expect(headerHtml()).toContain('src="https://staging.imotara.com/icon-192.png"');
    });

    it("adds the operator's line when given", () => {
        expect(headerHtml("A note for our partners")).toContain("A note for our partners");
    });

    it("renders logo and name only when no line is given", () => {
        const bare = headerHtml();
        expect(bare).toContain(">Imotara</span>");
        // no stray empty text div
        expect(bare).not.toContain("color:#475569");
    });

    it("ESCAPES the operator's line — it is typed text going into markup", () => {
        const html = headerHtml('</div><script>alert(1)</script>');
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("escapes ampersands so the html stays valid", () => {
        expect(headerHtml("Smith & Co")).toContain("Smith &amp; Co");
    });

    it("whitespace-only is the same as absent", () => {
        expect(headerHtml("   ")).toBe(headerHtml(""));
    });

    it("the plain-text part carries the same content", () => {
        expect(headerText("A note")).toBe("Imotara\nA note\n\n");
        expect(headerText()).toBe("Imotara\n\n");
    });
});

describe("footer store links", () => {
    it("links both stores and the site, as text", () => {
        const html = footerHtml(HREF);
        expect(html).toContain(PLAY_URL);
        expect(html).toContain(APPSTORE_URL);
        expect(html).toContain("Get it on Google Play");
        expect(html).toContain("Download on the App Store");
    });

    it("carries NO images — the deliverability decision, asserted", () => {
        // If someone later "improves" this by dropping the QR codes or badge
        // images back in, this fails and they have to read why.
        const html = footerHtml(HREF);
        expect(html).not.toContain("<img");
        expect(html).not.toMatch(/qr-(website|android|ios)\.png/);
    });

    it("still carries the unsubscribe link — required, not optional", () => {
        expect(footerHtml(HREF)).toContain(`href="${HREF}"`);
        expect(footerText(HREF)).toContain(HREF);
    });

    it("the plain-text part lists the same destinations", () => {
        const text = footerText(HREF);
        expect(text).toContain(PLAY_URL);
        expect(text).toContain(APPSTORE_URL);
        expect(text).toContain(siteBase());
    });
});

describe("emailDocument assembly", () => {
    it("puts the header ABOVE the body and the footer below", () => {
        const doc = emailDocument("<p>BODY</p>", footerHtml(HREF), headerHtml("HEAD"));
        expect(doc.indexOf("HEAD")).toBeLessThan(doc.indexOf("BODY"));
        expect(doc.indexOf("BODY")).toBeLessThan(doc.indexOf("Unsubscribe"));
    });

    it("header is a THIRD parameter, so old two-argument callers still work", () => {
        // Deliberate: a call site that has not been updated renders no header
        // rather than silently reordering the document.
        const doc = emailDocument("<p>BODY</p>", footerHtml(HREF));
        expect(doc).toContain("BODY");
        expect(doc).not.toContain("icon-192.png");
    });

    it("everything stays inside the one white card", () => {
        // The bug this guards: the footer used to be concatenated outside the
        // body container and rendered full-bleed under the card.
        const doc = emailDocument("<p>BODY</p>", footerHtml(HREF), headerHtml("HEAD"));
        expect(doc.endsWith("</div></div>")).toBe(true);
        const cardOpen = doc.indexOf("max-width:560px");
        expect(cardOpen).toBeGreaterThan(-1);
        expect(cardOpen).toBeLessThan(doc.indexOf("HEAD"));
    });
});
