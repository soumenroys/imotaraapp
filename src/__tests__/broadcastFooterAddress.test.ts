// The physical postal address in the broadcast footer.
//
// It was removed on request, then made configurable when the owner asked for
// the best possible inbox placement. Two things need to stay true: unset must
// render exactly what it rendered before (so leaving it off is genuinely a
// no-op), and a configured address must be escaped, because it is
// operator-supplied text going into markup.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { footerHtml, footerText, postalAddress, PLAY_URL, APPSTORE_URL, siteBase } from "@/lib/broadcast/markup";

const HREF = "https://imotara.com/api/unsubscribe?t=tok";
const original = process.env.BROADCAST_POSTAL_ADDRESS;

beforeEach(() => { delete process.env.BROADCAST_POSTAL_ADDRESS; });
afterEach(() => {
    if (original === undefined) delete process.env.BROADCAST_POSTAL_ADDRESS;
    else process.env.BROADCAST_POSTAL_ADDRESS = original;
});

describe("unset — the footer must be what it always was", () => {
    it("html carries the unsubscribe link and no address block", () => {
        expect(footerHtml(HREF)).toContain(`<a href="${HREF}"`);
        expect(footerHtml(HREF)).toContain("&middot; Imotara</div>");
        // Structural, not a style proxy. The old assertion was
        // not.toContain("margin-top:6px") and it broke as soon as unrelated
        // footer markup used the same margin — which says nothing about
        // whether an address is present.
        expect(footerHtml(HREF)).not.toContain('data-im="postal-address"');
    });

    it("text ends at the sender name", () => {
        // Store links were added at the owner's request on 2026-09-12; the
        // exact-equality discipline is kept, just against the new shape.
        expect(footerText(HREF)).toBe(
            `\n\n—\n` +
            `Google Play: ${PLAY_URL}\n` +
            `App Store: ${APPSTORE_URL}\n` +
            `Web: ${siteBase()}\n` +
            `Unsubscribe: ${HREF}\nImotara`
        );
    });

    it("an empty or whitespace value counts as unset", () => {
        process.env.BROADCAST_POSTAL_ADDRESS = "   ";
        expect(postalAddress()).toBe("");
        expect(footerHtml(HREF)).not.toContain('data-im="postal-address"');
    });
});

describe("configured — the address appears in both parts", () => {
    beforeEach(() => { process.env.BROADCAST_POSTAL_ADDRESS = "12 Example Road, Kolkata 700001, India"; });

    it("html carries it", () => {
        expect(footerHtml(HREF)).toContain("12 Example Road, Kolkata 700001, India");
    });

    it("plain text carries it too — filters read both parts", () => {
        expect(footerText(HREF)).toContain("12 Example Road, Kolkata 700001, India");
        expect(footerText(HREF).endsWith("India")).toBe(true);
    });
});

describe("the address is escaped, not interpolated raw", () => {
    it("cannot inject markup", () => {
        process.env.BROADCAST_POSTAL_ADDRESS = '</div><script>alert(1)</script>';
        const html = footerHtml(HREF);
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("escapes ampersands so the html stays valid", () => {
        process.env.BROADCAST_POSTAL_ADDRESS = "Smith & Co, Main St";
        expect(footerHtml(HREF)).toContain("Smith &amp; Co");
    });
});
