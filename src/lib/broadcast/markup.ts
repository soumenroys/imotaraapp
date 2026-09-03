// src/lib/broadcast/markup.ts
// The composer's markup → email HTML and plain text (BC-19).
//
// WHY A MARKUP RATHER THAN A RICH-TEXT BOX
//
// A contenteditable box is the obvious choice and the wrong one here. What it
// produces is whatever the browser felt like emitting, plus whatever came in
// on a paste — Word's <o:p> tags, Google Docs' <b style="font-weight:normal">,
// class names pointing at stylesheets that will not exist inside Gmail, and,
// if someone pastes from a hostile page, script and event handlers. That HTML
// then goes out to thousands of strangers under the sender's own domain.
//
// So the admin writes a small, constrained markup and this file renders it.
// Everything that reaches an email is generated HERE, from a fixed set of
// blocks with inline styles. Nothing the admin types can become a tag: the
// text is escaped before any formatting is applied. The same source also
// renders to plain text, so the two parts of a multipart message cannot drift
// apart the way hand-maintained copies always do.

const ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Only http, https and mailto reach an href.
 *
 * `javascript:` is the reason, and it is not hypothetical — a link is the one
 * place in this markup where the admin supplies something that lands in an
 * attribute. Anything else returns null and the caller renders the link as
 * plain text, which fails visibly rather than silently shipping it.
 */
export function safeUrl(raw: string): string | null {
  const u = raw.trim();
  if (!/^(https?:|mailto:)/i.test(u)) return null;
  // A newline or quote inside the value would end the attribute early.
  if (/[\s"'<>]/.test(u)) return null;
  return u;
}

// Images are https-only. An http image in an https-hosted preview is blocked,
// and in mail it is a downgrade the recipient never asked for.
function safeImage(raw: string): string | null {
  const u = safeUrl(raw);
  return u && /^https:/i.test(u) ? u : null;
}

const S = {
  p:      "margin:0 0 14px;font-size:15px;line-height:1.65;color:#1f2937",
  h1:     "margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a",
  h2:     "margin:22px 0 10px;font-size:17px;line-height:1.4;font-weight:700;color:#0f172a",
  ul:     "margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.65;color:#1f2937",
  quote:  "margin:0 0 14px;padding:10px 14px;border-left:3px solid #c7d2fe;background:#f8fafc;font-size:15px;line-height:1.6;color:#334155",
  hr:     "margin:22px 0;border:0;border-top:1px solid #e5e7eb",
  img:    "display:block;max-width:100%;height:auto;margin:0 0 14px;border-radius:8px",
  btn:    "display:inline-block;margin:4px 0 18px;padding:11px 22px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600",
  a:      "color:#4f46e5",
};

/** Bold, italic and links, applied to text that is ALREADY escaped. */
function inline(escaped: string): string {
  let s = escaped;
  // Links first: a URL can contain characters the emphasis rules would eat.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
    const url = safeUrl(href);
    return url ? `<a href="${url}" style="${S.a}">${label}</a>` : whole;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return s;
}

function inlineText(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
      const url = safeUrl(href);
      return url ? `${label} (${url})` : whole;
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
}

type Block =
  | { k: "h1" | "h2" | "quote" | "p"; lines: string[] }
  | { k: "ul"; lines: string[] }
  | { k: "hr" }
  // A line that LOOKS like an image or button but carries a URL we refuse.
  // It is kept verbatim, with no inline formatting applied, so the admin sees
  // exactly what they typed sitting in the message instead of a half-rendered
  // link with a stray "!" in front of it.
  | { k: "literal"; text: string }
  | { k: "img"; alt: string; src: string }
  | { k: "button"; label: string; href: string };

const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const RE_BTN = /^\[\[([^\]]+)\]\]\(([^)\s]+)\)$/;

/** One pass over the source, producing the block list both renderers use. */
export function parse(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];

  const flush = () => { if (para.length) { out.push({ k: "p", lines: para }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { flush(); continue; }

    if (/^---+$/.test(t)) { flush(); out.push({ k: "hr" }); continue; }

    const img = RE_IMG.exec(t);
    if (img) {
      const src2 = safeImage(img[2]);
      flush();
      out.push(src2 ? { k: "img", alt: img[1], src: src2 } : { k: "literal", text: t });
      continue;
    }

    const btn = RE_BTN.exec(t);
    if (btn) {
      const href = safeUrl(btn[2]);
      flush();
      out.push(href ? { k: "button", label: btn[1], href } : { k: "literal", text: t });
      continue;
    }

    if (t.startsWith("## ")) { flush(); out.push({ k: "h2", lines: [t.slice(3)] }); continue; }
    if (t.startsWith("# "))  { flush(); out.push({ k: "h1", lines: [t.slice(2)] }); continue; }

    if (t.startsWith("- ")) {
      flush();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i++; }
      i--;
      out.push({ k: "ul", lines: items });
      continue;
    }

    if (t.startsWith("> ")) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) { q.push(lines[i].trim().slice(2)); i++; }
      i--;
      out.push({ k: "quote", lines: q });
      continue;
    }

    para.push(t);
  }
  flush();
  return out;
}

/** The message body. Inline styles only — Gmail strips <style> blocks. */
export function renderHtml(src: string): string {
  return parse(src).map((b) => {
    switch (b.k) {
      case "hr":  return `<hr style="${S.hr}">`;
      case "literal": return `<p style="${S.p}">${esc(b.text)}</p>`;
      case "img": return `<img src="${b.src}" alt="${esc(b.alt)}" style="${S.img}">`;
      case "button":
        return `<div><a href="${b.href}" style="${S.btn}">${inline(esc(b.label))}</a></div>`;
      case "ul":
        return `<ul style="${S.ul}">` +
          b.lines.map((l) => `<li>${inline(esc(l))}</li>`).join("") + "</ul>";
      case "h1":  return `<h1 style="${S.h1}">${inline(esc(b.lines[0]))}</h1>`;
      case "h2":  return `<h2 style="${S.h2}">${inline(esc(b.lines[0]))}</h2>`;
      case "quote":
      case "p": {
        const html = b.lines.map((l) => inline(esc(l))).join("<br>");
        return b.k === "quote"
          ? `<div style="${S.quote}">${html}</div>`
          : `<p style="${S.p}">${html}</p>`;
      }
    }
  }).join("\n");
}

/**
 * The text/plain alternative — a real one, not a stripped-tags afterthought.
 *
 * Some recipients read plain text by choice, and spam filters compare the two
 * parts: a message whose text part is empty or nonsense scores worse than one
 * without a text part at all.
 */
export function renderText(src: string): string {
  const out: string[] = [];
  for (const b of parse(src)) {
    switch (b.k) {
      case "hr":     out.push("—"); break;
      case "literal": out.push(b.text); break;
      case "img":    out.push(b.alt ? `[image: ${b.alt}]` : "[image]"); break;
      case "button": out.push(`${b.label}: ${b.href}`); break;
      case "ul":     out.push(b.lines.map((l) => `- ${inlineText(l)}`).join("\n")); break;
      case "h1":     out.push(inlineText(b.lines[0]).toUpperCase()); break;
      case "h2":     out.push(inlineText(b.lines[0])); break;
      case "quote":  out.push(b.lines.map((l) => `> ${inlineText(l)}`).join("\n")); break;
      case "p":      out.push(b.lines.map(inlineText).join("\n")); break;
    }
  }
  return out.join("\n\n").trim();
}

/**
 * The finished document: body and unsubscribe footer inside one container.
 *
 * The cron used to concatenate `body_html + footer`, which put the footer
 * outside the body's container — full-bleed and misaligned. Assembling both
 * here keeps the preview and the sent mail literally the same function.
 */
export function emailDocument(bodyHtml: string, footerHtml = ""): string {
  return (
    `<div style="margin:0;padding:24px 16px;background:#f6f7f9">` +
    `<div style="max-width:560px;margin:0 auto;padding:28px 26px;background:#ffffff;` +
    `border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">` +
    bodyHtml + footerHtml +
    `</div></div>`
  );
}
