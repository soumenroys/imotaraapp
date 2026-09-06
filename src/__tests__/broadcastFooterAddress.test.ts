// The physical postal address in the broadcast footer.
//
// It was removed on request, then made configurable when the owner asked for
// the best possible inbox placement. Two things need to stay true: unset must
// render exactly what it rendered before (so leaving it off is genuinely a
// no-op), and a configured address must be escaped, because it is
// operator-supplied text going into markup.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { footerHtml, footerText, postalAddress } from "@/lib/broadcast/markup";

const HREF = "https://imotara.com/api/unsubscribe?t=tok";
const original = process.env.BROADCAST_POSTAL_ADDRESS;

beforeEach(() => { delete process.env.BROADCAST_POSTAL_ADDRESS; });
afterEach(() => {
    if (original === undefined) delete process.env.BROADCAST_POSTAL_ADDRESS;
    else process.env.BROADCAST_POSTAL_ADDRESS = original;
});

describe("unset — the footer must be what it always was", () => {
    it("html ends with the unsubscribe line and nothing more", () => {
        expect(footerHtml(HREF)).toContain(`<a href="${HREF}"`);
        expect(footerHtml(HREF)).toContain("&middot; Imotara</div>");
        expect(footerHtml(HREF)).not.toContain("margin-top:6px");
    });

    it("text ends at the sender name", () => {
        expect(footerText(HREF)).toBe(`\n\n—\nUnsubscribe: ${HREF}\nImotara`);
    });

    it("an empty or whitespace value counts as unset", () => {
        process.env.BROADCAST_POSTAL_ADDRESS = "   ";
        expect(postalAddress()).toBe("");
        expect(footerHtml(HREF)).not.toContain("margin-top:6px");
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
