// src/__tests__/broadcast/markup.test.ts
// The renderer is the only thing standing between what an admin types and
// what lands in a stranger's inbox, so the tests that matter most here are
// the ones about what must NOT come out of it.

import { describe, it, expect } from "vitest";
import { renderHtml, renderText, safeUrl, esc, emailDocument } from "@/lib/broadcast/markup";

describe("safeUrl", () => {
  it("accepts http, https and mailto", () => {
    expect(safeUrl("https://imotara.com")).toBe("https://imotara.com");
    expect(safeUrl("http://imotara.com")).toBe("http://imotara.com");
    expect(safeUrl("mailto:hi@imotara.com")).toBe("mailto:hi@imotara.com");
  });

  it("refuses javascript: and data: however they are dressed up", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("  javascript:alert(1)")).toBeNull();
  });

  it("refuses a URL carrying characters that could end the attribute", () => {
    expect(safeUrl('https://x.com" onclick="alert(1)')).toBeNull();
    expect(safeUrl("https://x.com'>")).toBeNull();
    expect(safeUrl("https://x.com\nmore")).toBeNull();
  });
});

describe("escaping", () => {
  it("turns typed markup into text, never tags", () => {
    const html = renderHtml('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an image alt", () => {
    const html = renderHtml('![" onerror="alert(1)](https://i.test/a.png)');
    expect(html).toContain('src="https://i.test/a.png"');
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it("leaves a rejected link visible as text rather than shipping it", () => {
    const html = renderHtml("[click me](javascript:alert(1))");
    // It survives as visible text — which is the point. What must never
    // happen is it reaching an attribute.
    expect(html).not.toContain("href=");
    expect(html).toContain("[click me](javascript:alert(1))");
  });

  it("escapes ampersands so URLs survive the trip", () => {
    expect(esc("a & b")).toBe("a &amp; b");
  });
});

describe("blocks", () => {
  it("renders headings, bullets, quote and rule", () => {
    const html = renderHtml("# Title\n\n## Sub\n\n- one\n- two\n\n> quoted\n\n---");
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<li>one</li><li>two</li>");
    expect(html).toContain("quoted");
    expect(html).toContain("<hr");
  });

  it("keeps consecutive lines in one paragraph, broken by <br>", () => {
    expect(renderHtml("one\ntwo")).toContain("one<br>two");
  });

  it("starts a new paragraph after a blank line", () => {
    const html = renderHtml("one\n\ntwo");
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("renders bold, italic and links", () => {
    const html = renderHtml("**b** and *i* and [x](https://a.test)");
    expect(html).toContain("<strong>b</strong>");
    expect(html).toContain("<em>i</em>");
    expect(html).toContain('<a href="https://a.test"');
  });

  it("renders a button as an anchor, not a form control", () => {
    const html = renderHtml("[[Try Imotara]](https://imotara.com)");
    expect(html).toContain('<a href="https://imotara.com"');
    expect(html).toContain("Try Imotara");
    expect(html).not.toContain("<button");
  });

  it("refuses an http image — a downgrade nobody asked for", () => {
    const html = renderHtml("![x](http://i.test/a.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain("![x]");
  });

  it("only styles inline; a <style> block would be stripped by Gmail", () => {
    expect(renderHtml("# Hi")).not.toContain("<style");
    expect(renderHtml("# Hi")).toContain("style=");
  });
});

describe("plain text", () => {
  it("carries the same content, not stripped tags", () => {
    const text = renderText("# Title\n\n- one\n\n[x](https://a.test)\n\n[[Go]](https://b.test)");
    expect(text).toContain("TITLE");
    expect(text).toContain("- one");
    expect(text).toContain("x (https://a.test)");
    expect(text).toContain("Go: https://b.test");
    expect(text).not.toContain("<");
  });

  it("drops emphasis markers instead of printing them", () => {
    expect(renderText("**bold** and *italic*")).toBe("bold and italic");
  });

  it("is empty only when the source is empty", () => {
    expect(renderText("   \n\n  ")).toBe("");
    expect(renderText("hello").length).toBeGreaterThan(0);
  });
});

describe("emailDocument", () => {
  it("puts the footer inside the same container as the body", () => {
    const doc = emailDocument("<p>body</p>", "<div>footer</div>");
    expect(doc.indexOf("footer")).toBeGreaterThan(doc.indexOf("body"));
    // the footer must not sit after the container closes
    expect(doc.endsWith("</div></div>")).toBe(true);
    expect(doc.split("<div>footer</div>")[1]).toBe("</div></div>");
  });

  it("works with no footer, for operational mail", () => {
    expect(emailDocument("<p>x</p>")).toContain("<p>x</p>");
  });
});

// ── The wider formatting vocabulary ───────────────────────────────────────
// Colour and font are the two values an admin supplies that land inside a
// style attribute, so these are the tests that matter most in this file.

describe("colour, font, size", () => {
  it("renders a colour, a font and a size", () => {
    expect(renderHtml("{{c=#c0392b|red}}")).toContain('<span style="color:#c0392b">red</span>');
    expect(renderHtml("{{f=georgia|x}}")).toContain("font-family:Georgia,serif");
    expect(renderHtml("{{s=large|x}}")).toContain("font-size:18px");
  });

  it("drops an unrecognised value but keeps the words", () => {
    // `red;background:url(...)` would turn every message into a beacon. The
    // payload here is short enough to match the span pattern, so this proves
    // safeColor rejects it rather than the length limit doing the work.
    const html = renderHtml("{{c=red;background:red|hello}}");
    expect(html).not.toContain("<span");
    expect(html).not.toContain("background:red");
    expect(html).toContain("hello");
  });

  it("refuses a font that is not on the list", () => {
    const html = renderHtml("{{f=Comic Sans MS|x}}");
    expect(html).not.toContain("Comic");
    expect(html).toContain("x");
  });

  it("nests, innermost first", () => {
    const html = renderHtml("{{s=huge|{{c=blue|big and blue}}}}");
    expect(html).toContain("font-size:24px");
    expect(html).toContain("color:blue");
    expect(html).toContain("big and blue");
  });

  it("cannot break out of the style attribute", () => {
    const html = renderHtml('{{c=#fff" onmouseover="alert(1)|x}}');
    expect(html).not.toContain("onmouseover");
  });
});

describe("underline and strike", () => {
  it("renders both", () => {
    expect(renderHtml("__under__ and ~~gone~~")).toContain("<u>under</u>");
    expect(renderHtml("__under__ and ~~gone~~")).toContain("<s>gone</s>");
  });

  it("drops the markers in plain text", () => {
    expect(renderText("__under__ and ~~gone~~")).toBe("under and gone");
  });
});

describe("alignment and image width", () => {
  it("aligns a paragraph", () => {
    expect(renderHtml(":center: hello")).toContain("text-align:center");
  });

  it("does not align the paragraph above it", () => {
    const html = renderHtml("plain\n:center: centred");
    const [first, second] = html.split("\n");
    expect(first).not.toContain("text-align");
    expect(second).toContain("text-align:center");
  });

  it("sets an image width as an attribute as well as a style", () => {
    // Outlook ignores max-width and prints the image at natural size.
    const html = renderHtml("![x](https://i.test/a.png){width=320,align=center}");
    expect(html).toContain('width="320"');
    expect(html).toContain("width:320px");
    expect(html).toContain("margin-left:auto");
  });

  it("ignores a width outside the container", () => {
    expect(renderHtml("![x](https://i.test/a.png){width=9999}")).not.toContain("9999");
  });

  it("ignores an alignment that is not one of the three", () => {
    expect(renderHtml("![x](https://i.test/a.png){align=justify}")).not.toContain("justify");
  });

  it("keeps the alignment marker out of the visible text", () => {
    expect(renderText(":right: hello")).toBe("hello");
  });
});

describe("the unsubscribe footer", () => {
  it("carries a working unsubscribe link and names the sender", async () => {
    const { footerHtml, footerText } = await import("@/lib/broadcast/markup");
    const html = footerHtml("https://x.test/u?t=abc");
    expect(html).toContain('href="https://x.test/u?t=abc"');
    expect(html).toContain("Unsubscribe");
    // The unsubscribe link is the part that must never go missing: without a
    // working one, the next person who wants out presses "Report spam".
    expect(html).toContain("Imotara");

    const text = footerText("https://x.test/u?t=abc");
    expect(text).toContain("Unsubscribe: https://x.test/u?t=abc");
    expect(text).toContain("Imotara");
  });

  it("no longer explains why the message arrived", async () => {
    const { footerHtml, footerText } = await import("@/lib/broadcast/markup");
    expect(footerHtml("#")).not.toContain("You are receiving this");
    expect(footerText("#")).not.toContain("You are receiving this");
  });
});
