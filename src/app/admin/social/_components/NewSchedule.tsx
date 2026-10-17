"use client";

// The form that creates a schedule.
//
// 🔴 IT WAS MISSING, AND THAT MADE THE WHOLE FEATURE A DEAD END. The POST route
// existed, the screens existed, the cron existed — and there was no way to
// create the thing all of them operate on. The overview said "No schedules
// yet" next to no button. ⇒ Found by opening the page and trying to use it,
// which is the only way that kind of gap is ever found.
//
// ⚠️ It asks for the few things a schedule cannot be guessed from, and nothing
// else. Every field here is one the database would otherwise refuse, or one
// where a default would be a decision made on somebody's behalf.

import { useState } from "react";
import { PLATFORMS as CHANNELS, PLATFORM_IDS } from "@/lib/social/platforms";

type Language = { code: string; name: string; reviewed: boolean; mayPostUnattended: boolean; reason: string | null };

/**
 * ⚠️ From the shared list, so a channel added in one place appears here. ⛔ And
 * each one carries its OWN blocker rather than a blanket "coming soon": the
 * reasons differ, and only one of them is work that can be done from this side.
 */
const PLATFORMS = PLATFORM_IDS.map((id) => ({
  id,
  label: CHANNELS[id].label,
  blockedBy: CHANNELS[id].blockedBy,
}));

const SHAPES = [
  { id: "text", label: "Text" },
  { id: "text_graphic", label: "Text + graphic" },
  { id: "graphic", label: "Graphic" },
];

const POOLS = [
  { id: "languages", label: "The 22 languages" },
  { id: "privacy", label: "Privacy, and what stays on the device" },
  { id: "voice", label: "Talking rather than typing" },
  { id: "offline", label: "Working without signal" },
  { id: "limits", label: "What it is not" },
  { id: "organisations", label: "For organisations" },
  { id: "quiet-hours", label: "The hours nobody staffs" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NewSchedule({
  languages,
  isOwner,
  onCreated,
  onCancel,
}: {
  languages: Language[];
  isOwner: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState(
    "Take one capability of Imotara and say what it is for, in plain words, as a person would. No slogans, and no claim to be therapy.",
  );
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [contentType, setContentType] = useState("text_graphic");
  const [topicPool, setTopicPool] = useState<string[]>(["privacy", "quiet-hours"]);
  const [langs, setLangs] = useState<string[]>(["en"]);
  const [postAt, setPostAt] = useState("09:30");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tone, setTone] = useState("gentle_plain");
  const [lengthHint, setLengthHint] = useState("medium");
  const [autoPublish, setAutoPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ subject: string; body: string; characters: number; language: string; platform: string; houseStyle: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  /** The languages chosen that could never post unattended. ⚠️ Shown as a
   *  consequence, not as an error — queuing in them is perfectly fine. */
  const blocked = langs
    .map((c) => languages.find((l) => l.code === c))
    .filter((l): l is Language => !!l && !l.mayPostUnattended);

  /**
   * 🔑 SEE IT BEFORE YOU COMMIT TO IT. Previously you had to create the
   * schedule, generate a post, and go to another screen to look — so the first
   * time you saw the voice was after you had already committed to a brief.
   *
   * ⛔ Nothing is saved, and the subject is not claimed, so previewing three
   * times does not burn three subjects.
   */
  async function runPreview() {
    setPreviewing(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/social/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preview: { brief, platforms, contentType, topicPool, tone, lengthHint, languages: langs },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Nothing could be written.");
        return;
      }
      setPreview(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/social/schedules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, brief, platforms, contentType, topicPool,
          languages: langs, postAt, days, autoPublish, tone, lengthHint,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 🔑 The database's own refusal is the most useful message available —
        // it names the unqualified language and says what would qualify it.
        setError(json.error ?? "The schedule could not be saved.");
        return;
      }
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-xs font-semibold text-zinc-400";
  const field = "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";

  return (
    <section className="space-y-5 rounded-xl border border-indigo-900/60 bg-indigo-950/10 p-5">
      <h2 className="text-base font-semibold">A new schedule</h2>

      {error && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="ns-name" className={label}>Name</label>
          <input id="ns-name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="One thing it does" className={field} />
          <p className="text-[11px] text-zinc-500">For you, not for the post.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="ns-time" className={label}>Time</label>
          <input id="ns-time" type="time" value={postAt} onChange={(e) => setPostAt(e.target.value)} className={field} />
          <p className="text-[11px] text-zinc-500">Asia/Kolkata. Writing starts two hours earlier.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="ns-brief" className={label}>The brief</label>
        <textarea id="ns-brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm leading-relaxed" />
        <p className="text-[11px] text-zinc-500">
          The standing instruction behind every post on this schedule. The voice rules are fixed and
          not editable here.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Channels</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p.id} title={p.blockedBy}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                platforms.includes(p.id) ? "border-indigo-600 bg-indigo-950/40" : "border-zinc-800"}`}>
              <input type="checkbox" checked={platforms.includes(p.id)} className="h-4 w-4 accent-indigo-500"
                onChange={() => toggle(platforms, p.id, setPlatforms)} />
              {p.label}
            </label>
          ))}
        </div>
        {platforms.length > 0 && (
          <ul className="space-y-1 text-[11px] leading-relaxed text-amber-300/90">
            {platforms.map((id) => (
              <li key={id}>
                ⛔ {CHANNELS[id as keyof typeof CHANNELS].label} cannot publish yet —{" "}
                {CHANNELS[id as keyof typeof CHANNELS].blockedBy} Posts are still written, pictured
                and queued.
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>Shape</legend>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <label key={s.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
              contentType === s.id ? "border-indigo-600 bg-indigo-950/40" : "border-zinc-800"}`}>
              <input type="radio" name="ns-shape" checked={contentType === s.id} className="h-4 w-4 accent-indigo-500"
                onChange={() => setContentType(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>Languages — it writes one per post, rotating</legend>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <label key={l.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
              langs.includes(l.code)
                ? l.mayPostUnattended ? "border-emerald-800 bg-emerald-950/30" : "border-amber-800 bg-amber-950/20"
                : "border-zinc-800 text-zinc-400"}`}>
              <input type="checkbox" checked={langs.includes(l.code)} className="h-4 w-4 accent-indigo-500"
                onChange={() => toggle(langs, l.code, setLangs)} />
              {l.name}
            </label>
          ))}
        </div>
        {blocked.length > 0 && (
          <p className="text-[11px] leading-relaxed text-amber-300/90">
            ⚠️ {blocked.map((l) => l.name).join(", ")} can be written, pictured and queued — but never
            posted with nobody reading it. {blocked[0]?.reason}
          </p>
        )}
      </fieldset>

      {/* 🔴 Neither of these existed, so every schedule silently took the
          API's defaults — which is why every post came out at two sentences. */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="ns-tone" className={label}>Tone</label>
          <select id="ns-tone" value={tone} onChange={(e) => setTone(e.target.value)} className={field}>
            <option value="gentle_plain">Gentle and plain</option>
            <option value="thoughtful">Thoughtful — leaves a question standing</option>
            <option value="generous">Generous — gives something away</option>
            <option value="practical">Practical</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ns-len" className={label}>How long</label>
          <select id="ns-len" value={lengthHint} onChange={(e) => setLengthHint(e.target.value)} className={field}>
            <option value="short">Short — two or three sentences</option>
            <option value="medium">Medium — a short paragraph</option>
            <option value="longer">Longer — two short paragraphs</option>
          </select>
          <p className="text-[11px] text-zinc-500">
            X is capped at 280 characters whatever you pick here.
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className={`flex min-h-11 w-14 cursor-pointer items-center justify-center rounded-lg border text-sm ${
              days.includes(i) ? "border-indigo-600 bg-indigo-950/40" : "border-zinc-800 text-zinc-400"}`}>
              <input type="checkbox" checked={days.includes(i)} className="sr-only"
                onChange={() => toggle(days, i, setDays)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>What it writes about</legend>
        <div className="flex flex-wrap gap-2">
          {POOLS.map((p) => (
            <label key={p.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs ${
              topicPool.includes(p.id) ? "border-indigo-600 bg-indigo-950/40" : "border-zinc-800 text-zinc-400"}`}>
              <input type="checkbox" checked={topicPool.includes(p.id)} className="h-3.5 w-3.5 accent-indigo-500"
                onChange={() => toggle(topicPool, p.id, setTopicPool)} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <label className={`flex items-start gap-3 ${isOwner ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          <input type="checkbox" checked={autoPublish} disabled={!isOwner} className="mt-1 h-4 w-4 accent-indigo-500"
            onChange={(e) => setAutoPublish(e.target.checked)} />
          <span className="space-y-1">
            <span className="block text-sm font-semibold">
              Post it without asking me {!isOwner && <span className="font-normal text-zinc-500">· owner tier</span>}
            </span>
            <span className="block text-[11px] leading-relaxed text-zinc-500">
              Off, it writes and waits in the review queue. On, it writes and posts unattended. ⛔ The
              safety gate runs either way — this decides whether a person reads it, never whether it
              is checked.
            </span>
          </span>
        </label>
      </div>

      {preview && (
        <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">What it would write</h3>
            <span className="font-mono text-[11px] text-zinc-500">
              {preview.platform} · {preview.language} · {preview.characters} characters
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-400">{preview.subject}</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">{preview.body}</p>
          {preview.houseStyle.length > 0 && (
            <ul className="space-y-1 text-[11px] text-amber-300">
              {preview.houseStyle.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
          <p className="text-[11px] text-zinc-500">
            Nothing was saved. Change the brief, the tone or the length and try again — every
            preview writes something new.
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={previewing || brief.trim().length < 20 || langs.length === 0 || platforms.length === 0}
          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800 disabled:opacity-40"
        >
          {previewing ? "Writing a sample…" : "See what it would write"}
        </button>
        <button type="button" onClick={() => void submit()}
          disabled={busy || name.trim().length < 3 || brief.trim().length < 20 || langs.length === 0 || platforms.length === 0 || days.length === 0}
          className="min-h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40">
          {busy ? "Saving…" : "Create it"}
        </button>
        <button type="button" onClick={onCancel}
          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800">
          Cancel
        </button>
      </div>
    </section>
  );
}
