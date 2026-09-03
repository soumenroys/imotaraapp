"use client";

// src/components/admin/BroadcastComposer.tsx
// Write the message (BC-19).
//
// The preview is rendered by the SAME function the cron uses to build the
// outgoing mail — src/lib/broadcast/markup.ts — so what is on the right of
// this screen is not an approximation of the email. It is the email.
//
// It is shown in a sandboxed iframe rather than a div. Email HTML carries its
// own colours and fonts and expects to own the document; dropping it into the
// admin page would let the two sets of styles bleed into each other and make
// the preview quietly lie about spacing and colour.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import { renderHtml, emailDocument } from "@/lib/broadcast/markup";
import type { ListRow } from "./BroadcastLists";

export type Draft = {
  id: string | null;
  subject: string;
  body_source: string;
  message_type: "broadcast" | "operational";
  list_id: string | null;
  status?: string;
  from_email?: string;
  from_name?: string | null;
};

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; msg: string };

// What the toolbar writes. Every button is a text edit — there is no hidden
// document model, so what the admin sees in the box is exactly what is stored.
const TOOLS: { label: string; title: string; wrap?: [string, string]; line?: string; block?: string }[] = [
  { label: "H",  title: "Heading",     line: "# " },
  { label: "H₂", title: "Subheading",  line: "## " },
  { label: "B",  title: "Bold",        wrap: ["**", "**"] },
  { label: "I",  title: "Italic",      wrap: ["*", "*"] },
  { label: "🔗", title: "Link",        wrap: ["[", "](https://)"] },
  { label: "•",  title: "Bullet",      line: "- " },
  { label: "❝",  title: "Quote",       line: "> " },
  { label: "🖼", title: "Image",       block: "![description](https://)" },
  { label: "▭",  title: "Button",      block: "[[Read more]](https://imotara.com)" },
  { label: "―",  title: "Divider",     block: "---" },
];

const FOOTER_PREVIEW =
  `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #eef2f7;` +
  `font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#94a3b8">` +
  `You are receiving this because you gave us your address. ` +
  `<a href="#" style="color:#4f46e5">Unsubscribe</a> &middot; Imotara, Kolkata, India</div>`;

export default function BroadcastComposer({
  token, initial, lists, onSaved, onReview, onBack,
}: {
  token: string;
  initial: Draft;
  lists: ListRow[];
  onSaved: (id: string) => void;
  onReview: (id: string) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [wide, setWide] = useState(true);
  const box = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);

  const locked = Boolean(draft.status && draft.status !== "draft");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // ── Saving ────────────────────────────────────────────────────────────────
  const persist = useCallback(async (d: Draft): Promise<string | null> => {
    if (!d.subject.trim()) return null;   // the API requires one; don't spam it
    setSave({ kind: "saving" });
    const payload = {
      subject: d.subject,
      body_source: d.body_source,
      message_type: d.message_type,
      list_id: d.list_id,
    };
    try {
      const res = await fetch(
        d.id ? `/api/admin/broadcast/broadcasts/${d.id}` : "/api/admin/broadcast/broadcasts",
        adminFetchOpts(token, {
          method: d.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 means it left draft while this screen was open — most likely the
        // send was started in another tab. Saying so beats "save failed".
        setSave({ kind: "error", msg: j.hint ? `${j.error} — ${j.hint}` : (j.error ?? `HTTP ${res.status}`) });
        if (res.status === 409 && j.status) setDraft((cur) => ({ ...cur, status: j.status }));
        return null;
      }
      const id: string = j.broadcast?.id ?? d.id;
      dirty.current = false;
      setSave({ kind: "saved", at: Date.now() });
      if (!d.id && id) { setDraft((cur) => ({ ...cur, id })); onSaved(id); }
      return id;
    } catch {
      setSave({ kind: "error", msg: "Network error — nothing was saved" });
      return null;
    }
  }, [token, onSaved]);

  // Autosave. A composer that loses a half-written message because the tab was
  // closed is a composer nobody trusts twice.
  useEffect(() => {
    if (locked || !dirty.current) return;
    const t = setTimeout(() => { void persist(draft); }, 1500);
    return () => clearTimeout(t);
  }, [draft, persist, locked]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ── Toolbar ───────────────────────────────────────────────────────────────
  function apply(tool: (typeof TOOLS)[number]) {
    const el = box.current;
    if (!el || locked) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const src = draft.body_source;
    let next: string, caret: number;

    if (tool.wrap) {
      const [open, close] = tool.wrap;
      next = src.slice(0, a) + open + src.slice(a, b) + close + src.slice(b);
      caret = b + open.length + (a === b ? 0 : close.length);
    } else if (tool.line) {
      // Prefix the line the cursor is on, rather than the selection — a
      // heading marker in the middle of a line does nothing.
      const start = src.lastIndexOf("\n", a - 1) + 1;
      next = src.slice(0, start) + tool.line + src.slice(start);
      caret = a + tool.line.length;
    } else {
      const pad = a === 0 || src.slice(0, a).endsWith("\n\n") ? "" : "\n\n";
      next = src.slice(0, a) + pad + tool.block + "\n\n" + src.slice(a);
      caret = a + pad.length + tool.block!.length;
    }

    set("body_source", next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  const preview = useMemo(() => emailDocument(
    renderHtml(draft.body_source),
    draft.message_type === "broadcast" ? FOOTER_PREVIEW : "",
  ), [draft.body_source, draft.message_type]);

  const list = lists.find((l) => l.id === draft.list_id);
  const canReview = Boolean(draft.id && draft.subject.trim() && draft.body_source.trim() && draft.list_id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >← All broadcasts</button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600">
            {save.kind === "saving" ? "Saving…"
              : save.kind === "saved" ? `Saved ${new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : save.kind === "error" ? <span className="text-rose-300">{save.msg}</span>
              : draft.id ? "Draft" : "Not saved yet"}
          </span>
          <button
            onClick={() => { void persist(draft).then((id) => id && onReview(id)); }}
            disabled={!canReview || locked}
            title={
              !draft.subject.trim() ? "Add a subject"
                : !draft.body_source.trim() ? "Write the message"
                : !draft.list_id ? "Choose who it goes to"
                : undefined
            }
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
          >Review &amp; send →</button>
        </div>
      </div>

      {locked && (
        <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-200">
          This broadcast is <span className="font-semibold">{draft.status}</span> and can no
          longer be edited. What people received has to stay on record — duplicate it to send
          a revised version.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Left: the message ────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Subject</label>
            <input
              value={draft.subject}
              onChange={(e) => set("subject", e.target.value)}
              disabled={locked}
              maxLength={200}
              placeholder="What this message is about"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40 disabled:opacity-50"
            />
            <p className="mt-1.5 text-[10px] text-zinc-600">
              {draft.subject.length}/200 · shown in the inbox before anything else
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
            <div className="flex flex-wrap gap-1 border-b border-white/6 p-2">
              {TOOLS.map((t) => (
                <button
                  key={t.title}
                  onClick={() => apply(t)}
                  disabled={locked}
                  title={t.title}
                  className="h-7 min-w-7 rounded-md border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-400 transition hover:text-zinc-100 disabled:opacity-40"
                >{t.label}</button>
              ))}
            </div>
            <textarea
              ref={box}
              value={draft.body_source}
              onChange={(e) => set("body_source", e.target.value)}
              disabled={locked}
              rows={18}
              placeholder={"# A short, plain headline\n\nWrite the way you would to one person.\n\n- what it does\n- who it is for\n\n[[See Imotara]](https://imotara.com)"}
              className="w-full resize-y bg-zinc-900 px-3 py-3 font-mono text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            <p className="border-t border-white/6 px-3 py-2 text-[10px] leading-relaxed text-zinc-600">
              Formatting is deliberately small. Custom fonts do not survive Gmail and
              video does not play in it, so what is here is what actually renders
              everywhere. GIFs work — add one as an image.
            </p>
          </div>
        </div>

        {/* ── Right: what it will look like ────────────────────────────── */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Send to</label>
            <select
              value={draft.list_id ?? ""}
              onChange={(e) => set("list_id", e.target.value || null)}
              disabled={locked}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/40 disabled:opacity-50"
            >
              <option value="">Choose a recipient list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.recipientCount === null ? "" : ` — ${l.recipientCount}`}
                </option>
              ))}
            </select>
            {list && list.recipientCount === 0 && (
              <p className="mt-1.5 text-[10px] text-amber-300">That list is empty.</p>
            )}

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Kind of message</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {([
                  { v: "broadcast", t: "Broadcast", d: "News, offers, anything promotional. Carries an unsubscribe link — required by law and by Gmail." },
                  { v: "operational", t: "Operational notice", d: "Something the recipient needs regardless: a policy change, an outage. No unsubscribe link." },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => set("message_type", o.v)}
                    disabled={locked}
                    className={`rounded-lg border p-2.5 text-left transition disabled:opacity-50 ${
                      draft.message_type === o.v
                        ? "border-indigo-400/40 bg-indigo-500/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${draft.message_type === o.v ? "text-indigo-200" : "text-zinc-300"}`}>{o.t}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{o.d}</p>
                  </button>
                ))}
              </div>
              {draft.message_type === "operational" && (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-300">
                  Only use this for messages people cannot opt out of. Sending
                  promotion this way is what gets a domain blocked, and the domain
                  is shared with password resets.
                </p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
            <div className="flex items-center justify-between border-b border-white/6 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Preview</p>
              <div className="flex gap-1">
                {([[true, "Desktop"], [false, "Phone"]] as const).map(([w, label]) => (
                  <button
                    key={label}
                    onClick={() => setWide(w)}
                    className={`rounded-md px-2 py-1 text-[10px] transition ${
                      wide === w ? "bg-white/10 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-center bg-zinc-950/40 p-3">
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview}
                className="h-[480px] rounded-lg border border-white/8 bg-white transition-all"
                style={{ width: wide ? "100%" : 380 }}
              />
            </div>
            <p className="border-t border-white/6 px-3 py-2 text-[10px] leading-relaxed text-zinc-600">
              From {draft.from_name ? `${draft.from_name} <${draft.from_email}>` : draft.from_email ?? "your admin address"}.
              {draft.message_type === "broadcast" && " The unsubscribe line is added automatically — each recipient gets their own link."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
