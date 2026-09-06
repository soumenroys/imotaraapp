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
// So the admin writes a markup and this file renders it. The vocabulary is
// wide — bold, italic, underline, strike, colour, font, size, alignment,
// images with width and placement — but every one of those becomes HTML that
// is GENERATED HERE, from values checked against a whitelist. Nothing the
// admin types can become a tag: the text is escaped before any formatting is
// applied, and a colour or font that is not recognised is dropped rather than
// passed through. The same source also renders to plain text, so the two
// parts of a multipart message cannot drift apart the way hand-maintained
// copies always do.
//
// The limits that remain are the medium's, not this file's. Custom web fonts
// do not load in Gmail or Outlook, so the font list is the families that are
// actually present on the machines people read mail on. Video does not play
// in Gmail. Both are stated in the composer rather than silently accepted and
// then quietly lost.

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

// ── Value whitelists ───────────────────────────────────────────────────────
// A colour and a font are the two places where the admin supplies something
// that lands inside a style attribute. Both are checked, not escaped: a value
// that is not recognised is dropped. Escaping would be enough to prevent an
// attribute break, but not enough to prevent `red;background:url(http://…)`
// from turning every message into a tracking beacon.

/** Email-safe families: what is installed on the machines people read mail on. */
export const FONTS: Record<string, string> = {
  sans:      "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  serif:     "Georgia,'Times New Roman',Times,serif",
  mono:      "'SF Mono',Menlo,Consolas,'Courier New',monospace",
  arial:     "Arial,Helvetica,sans-serif",
  georgia:   "Georgia,serif",
  times:     "'Times New Roman',Times,serif",
  verdana:   "Verdana,Geneva,sans-serif",
  tahoma:    "Tahoma,Geneva,sans-serif",
  trebuchet: "'Trebuchet MS',Helvetica,sans-serif",
  courier:   "'Courier New',Courier,monospace",
};

export const SIZES: Record<string, string> = {
  small: "13px", normal: "15px", large: "18px", huge: "24px",
};

/** #rgb, #rrggbb, or one of a small set of names. Nothing else. */
export function safeColor(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return v;
  const NAMED = ["black", "white", "red", "green", "blue", "grey", "gray", "orange", "purple"];
  return NAMED.includes(v) ? v : null;
}

const ALIGN = new Set(["left", "center", "right"]);

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

/**
 * Spans, emphasis and links, applied to text that is ALREADY escaped.
 *
 * `{{c=#c0392b|text}}` colour, `{{f=georgia|text}}` font, `{{s=large|text}}`
 * size. The inner pattern refuses braces, so the loop always rewrites the
 * innermost span first and nesting works outwards — colour inside a font
 * inside a size — without a parser.
 */
const RE_SPAN = /\{\{([cfs])=([^|{}]{1,40})\|([^{}]*)\}\}/;

function spans(escaped: string): string {
  let s = escaped;
  for (let guard = 0; guard < 20; guard++) {
    const m = RE_SPAN.exec(s);
    if (!m) break;
    const [whole, kind, rawValue, inner] = m;
    let style: string | null = null;
    if (kind === "c") { const c = safeColor(rawValue); if (c) style = `color:${c}`; }
    if (kind === "f") { const f = FONTS[rawValue.trim().toLowerCase()]; if (f) style = `font-family:${f}`; }
    if (kind === "s") { const z = SIZES[rawValue.trim().toLowerCase()]; if (z) style = `font-size:${z}`; }
    // An unrecognised value keeps the TEXT and drops the styling. Losing a
    // colour is a visible disappointment; passing an unchecked one into a
    // style attribute is a hole.
    s = s.slice(0, m.index) + (style ? `<span style="${style}">${inner}</span>` : inner) + s.slice(m.index + whole.length);
  }
  return s;
}

function inline(escaped: string): string {
  let s = escaped;
  // Links first: a URL can contain characters the emphasis rules would eat.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
    const url = safeUrl(href);
    return url ? `<a href="${url}" style="${S.a}">${label}</a>` : whole;
  });
  s = spans(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_\n]+)__/g, "<u>$1</u>");
  s = s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return s;
}

function inlineText(s: string): string {
  let out = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
    const url = safeUrl(href);
    return url ? `${label} (${url})` : whole;
  });
  // Styling has no plain-text equivalent, so the markers come off and the
  // words stay. A text part full of {{c=#fff|…}} would read as broken.
  for (let guard = 0; guard < 20; guard++) {
    const m = RE_SPAN.exec(out);
    if (!m) break;
    out = out.slice(0, m.index) + m[3] + out.slice(m.index + m[0].length);
  }
  return out
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
}

type Align = "left" | "center" | "right";

type Block =
  | { k: "h1" | "h2" | "quote" | "p"; lines: string[]; align?: Align }
  | { k: "ul"; lines: string[]; align?: Align }
  | { k: "hr" }
  // A line that LOOKS like an image or button but carries a URL we refuse.
  // It is kept verbatim, with no inline formatting applied, so the admin sees
  // exactly what they typed sitting in the message instead of a half-rendered
  // link with a stray "!" in front of it.
  | { k: "literal"; text: string }
  | { k: "img"; alt: string; src: string; width?: number; align?: Align }
  | { k: "button"; label: string; href: string; align?: Align };

// An image may carry {width=320,align=center}; a leading :center: / :right:
// aligns any block. Both are written by the toolbar, so the syntax only has
// to be unambiguous, not memorable.
const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?$/;
const RE_BTN = /^\[\[([^\]]+)\]\]\(([^)\s]+)\)$/;
const RE_ALIGN = /^:(left|center|right):\s*/;

function imgAttrs(raw: string | undefined): { width?: number; align?: Align } {
  const out: { width?: number; align?: Align } = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [k, v] = part.split("=").map((x) => x?.trim().toLowerCase());
    if (k === "width") {
      const n = parseInt(v ?? "", 10);
      // Bounded, because a width larger than the container silently overflows
      // in some clients rather than scaling down.
      if (Number.isInteger(n) && n >= 40 && n <= 560) out.width = n;
    }
    if (k === "align" && ALIGN.has(v ?? "")) out.align = v as Align;
  }
  return out;
}

/** One pass over the source, producing the block list both renderers use. */
export function parse(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];

  const flush = () => { if (para.length) { out.push({ k: "p", lines: para }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let t = line.trim();

    if (!t) { flush(); continue; }

    // Alignment is stripped first so every block type below sees a clean line.
    let align: Align | undefined;
    const am = RE_ALIGN.exec(t);
    if (am) { align = am[1] as Align; t = t.slice(am[0].length); }
    if (!t) { flush(); continue; }

    if (/^---+$/.test(t)) { flush(); out.push({ k: "hr" }); continue; }

    const img = RE_IMG.exec(t);
    if (img) {
      const src2 = safeImage(img[2]);
      const attrs = imgAttrs(img[3]);
      flush();
      out.push(src2
        ? { k: "img", alt: img[1], src: src2, ...attrs, align: attrs.align ?? align }
        : { k: "literal", text: t });
      continue;
    }

    const btn = RE_BTN.exec(t);
    if (btn) {
      const href = safeUrl(btn[2]);
      flush();
      out.push(href ? { k: "button", label: btn[1], href, align } : { k: "literal", text: t });
      continue;
    }

    if (t.startsWith("## ")) { flush(); out.push({ k: "h2", lines: [t.slice(3)], align }); continue; }
    if (t.startsWith("# "))  { flush(); out.push({ k: "h1", lines: [t.slice(2)], align }); continue; }

    if (t.startsWith("- ")) {
      flush();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i++; }
      i--;
      out.push({ k: "ul", lines: items, align });
      continue;
    }

    if (t.startsWith("> ")) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) { q.push(lines[i].trim().slice(2)); i++; }
      i--;
      out.push({ k: "quote", lines: q, align });
      continue;
    }

    if (align) { flush(); out.push({ k: "p", lines: [t], align }); continue; }
    para.push(t);
  }
  flush();
  return out;
}

/** The message body. Inline styles only — Gmail strips <style> blocks. */
export function renderHtml(src: string): string {
  const al = (b: { align?: Align }) => (b.align ? `;text-align:${b.align}` : "");

  return parse(src).map((b) => {
    switch (b.k) {
      case "hr":  return `<hr style="${S.hr}">`;
      case "literal": return `<p style="${S.p}">${esc(b.text)}</p>`;
      case "img": {
        // width lands in the ATTRIBUTE as well as the style: Outlook ignores
        // max-width and will otherwise print the image at its natural size.
        const w = b.width ? ` width="${b.width}"` : "";
        const style = S.img + (b.width ? `;width:${b.width}px` : "") +
          (b.align === "center" ? ";margin-left:auto;margin-right:auto"
            : b.align === "right" ? ";margin-left:auto" : "");
        return `<img src="${b.src}" alt="${esc(b.alt)}"${w} style="${style}">`;
      }
      case "button":
        return `<div style="${b.align ? `text-align:${b.align}` : ""}">` +
          `<a href="${b.href}" style="${S.btn}">${inline(esc(b.label))}</a></div>`;
      case "ul":
        return `<ul style="${S.ul}${al(b)}">` +
          b.lines.map((l) => `<li>${inline(esc(l))}</li>`).join("") + "</ul>";
      case "h1":  return `<h1 style="${S.h1}${al(b)}">${inline(esc(b.lines[0]))}</h1>`;
      case "h2":  return `<h2 style="${S.h2}${al(b)}">${inline(esc(b.lines[0]))}</h2>`;
      case "quote":
      case "p": {
        const html = b.lines.map((l) => inline(esc(l))).join("<br>");
        return b.k === "quote"
          ? `<div style="${S.quote}${al(b)}">${html}</div>`
          : `<p style="${S.p}${al(b)}">${html}</p>`;
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
 * Merge tags: {{name}} and {{email}}, with a fallback after a pipe.
 *
 *   Hi {{name|there}},
 *
 * The fallback is optional now. `{{name|there}}` still substitutes "there",
 * but `{{name}}` with nothing stored collapses to nothing AND takes one
 * preceding space with it, so `Hello {{name}},` reads "Hello Jane," for
 * someone named and "Hello," for someone not. That is what makes a bare
 * `{{name}}` safe to use: the old warning was that a message opening "Hi ,"
 * on half its recipients is worse than one that never tried, and this is the
 * fix for it rather than a reason to avoid the empty case. Substitution happens AFTER the HTML is rendered, on the
 * finished string, and the value is escaped — a recipient's own name is
 * attacker-controlled data as far as this is concerned.
 */
// The leading ` ?` is deliberate. With an empty fallback, `Hello {{name}},`
// would otherwise render as "Hello ," for anyone without a name — a stranded
// space in front of the comma, which reads as broken rather than as plain.
// The space is captured, then put back only when there is a value, so the same
// template gives "Hello Jane," with a name and "Hello," without one.
const RE_MERGE = /( ?)\{\{(name|email)(?:\|([^}]*))?\}\}( ?)/g;

export function mergeFields(
  content: string,
  fields: { name?: string | null; email: string },
  escapeValues: boolean,
): string {
  return content.replace(
    RE_MERGE,
    (_whole, lead: string, key: string, fallback = "", trail: string) => {
      const raw = key === "name" ? (fields.name ?? "").trim() : fields.email;
      const value = raw || fallback;

      // Put back exactly the spacing that was there when there is something to
      // show. When there is not, drop the field AND one of its spaces, keeping
      // a single space only if the field sat between two words — so
      // "Hello {{name}}," gives "Hello," and "Hello {{name}} welcome" gives
      // "Hello welcome" rather than a double gap.
      if (!value) return lead && trail ? " " : "";
      return lead + (escapeValues ? esc(value) : value) + trail;
    },
  );
}

/** Does this message personalise anything? Used to decide whether the sender
 *  needs to look up recipient names at all. */
export function usesMergeFields(content: string): boolean {
  RE_MERGE.lastIndex = 0;
  return RE_MERGE.test(content);
}

/**
 * The unsubscribe footer, defined once.
 *
 * It lived in two places — the sender and the composer's preview — which is
 * exactly the arrangement where a change lands in one copy and the preview
 * starts quietly describing an email nobody receives. The link is passed in
 * because only the sender can mint a per-recipient token; the preview passes
 * a dead one.
 *
 * The postal address was removed at the owner's request on 2026-09-04, then
 * made restorable on 2026-09-06 when the owner asked for the best possible
 * inbox placement. It is now driven by BROADCAST_POSTAL_ADDRESS rather than
 * hardcoded, so turning it back on is a config change and the address itself
 * never lives in the repo.
 *
 * Why it matters: CAN-SPAM requires a physical address in commercial mail and
 * applies to any message reaching a US recipient — which the senior-living
 * outreach list is entirely made of — and spam filters treat its absence as a
 * bulk-mail signal. Unset, the footer renders exactly as it did before, so
 * leaving it off changes nothing.
 */
/**
 * The sender's postal address, or "" when not configured.
 *
 * Read through a function rather than a module constant so a test can set the
 * variable without the module having already captured its value at import.
 */
export function postalAddress(): string {
  return (process.env.BROADCAST_POSTAL_ADDRESS ?? "").trim();
}

export function footerHtml(unsubscribeHref: string): string {
  const addr = postalAddress();
  return (
    `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #eef2f7;` +
    `font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#94a3b8">` +
    `<a href="${unsubscribeHref}" style="color:#4f46e5">Unsubscribe</a>` +
    ` &middot; Imotara` +
    // Escaped, not interpolated raw: this is operator-supplied config and the
    // rest of this file is careful never to put unchecked text into markup.
    (addr ? `<div style="margin-top:6px">${esc(addr)}</div>` : "") +
    `</div>`
  );
}

export function footerText(unsubscribeHref: string): string {
  const addr = postalAddress();
  return `\n\n—\nUnsubscribe: ${unsubscribeHref}\nImotara${addr ? `\n${addr}` : ""}`;
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
