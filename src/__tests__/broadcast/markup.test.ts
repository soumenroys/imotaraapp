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
