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
// ⛔ From animationFacts, not animate: the latter pulls ffmpeg into the bundle.
import { animationWarning } from "@/lib/social/animationFacts";
// ⛔ From contentTypes, not pipeline: pipeline reaches `crypto` through
// visualRecipe, and this is a client component.
import { CONTENT_TYPES, SHAPE_LABELS } from "@/lib/social/contentTypes";
import { TOPIC_POOLS } from "@/lib/social/topicPools";

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

/**
 * 🔴 THIS LIST HELD THREE OF THE FIVE SHAPES AND NOBODY COULD SEE THE OTHER TWO.
 *
 * `short_video` and `animated_gif` were built end to end — the storyboard, the
 * encoder, the route, the database constraint, the tests, the knowledgebase,
 * and the warning a few lines below that tells you a GIF only animates on X.
 * They were never added here, so the warning was unreachable and the page's own
 * walkthrough told the reader to choose an option that was not on the screen.
 *
 * ⇒ Derived from the shared list now, with a label for each. A shape without a
 * label stops the build; a shape nobody can pick cannot happen again.
 */

const SHAPES = CONTENT_TYPES.map((id) => ({ id, label: SHAPE_LABELS[id] }));

/**
 * 🔴 THIS WAS HAND-WRITTEN, one line below the comment explaining why the
 * SHAPES list beside it is not. Adding a pool to the writer would have left it
 * invisible here — the same defect as `short_video`, in the same file, with
 * its own post-mortem directly above it.
 * ⇒ src/lib/social/topicPools.ts now has no dependencies, so this can simply
 * read it.
 */
const POOLS = TOPIC_POOLS.map((p) => ({ id: p.id, label: p.label }));

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * 🔴 A SCHEDULE USED TO BE CREATE-ONLY, and nothing said so.
 *
 * The PATCH route has always accepted the name, the brief, the channels, the
 * languages, the days, the hour, the tone, the length AND the topic pools —
 * and this screen only ever sent `active`. So the only way to change what a
 * schedule writes about was to delete it and make another one, which throws
 * away the record of what it had already published ⇒ the delete note in
 * src/app/api/admin/social/schedules/[id]/route.ts.
 *
 * ⚠️ Found while trying to add a topic pool to a live schedule on 18 Oct.
 * There was no way to do it from the product at all.
 */
export type EditableSchedule = {
  id: string;
  name: string;
  brief: string;
  platforms: string[];
  content_type: string;
  topic_pool: string[];
  languages: string[];
  post_at: string;
  days: number[];
  /** 🔑 Per-channel overrides of post_at/days ⇒ docs/sql/social_platform_times.sql. */
  platform_times?: Record<string, { post_at?: string; days?: number[] }> | null;
  tone: string;
  length_hint: string;
  auto_publish: boolean;
};

export function NewSchedule({
  languages,
  isOwner,
  editing,
  onSaved,
  onCancel,
}: {
  languages: Language[];
  isOwner: boolean;
  /** ⚠️ Present = edit that schedule. Absent = make a new one. */
  editing?: EditableSchedule | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [brief, setBrief] = useState(
    editing?.brief ??
      "Take one capability of Imotara and say what it is for, in plain words, as a person would. No slogans, and no claim to be therapy.",
  );
  const [platforms, setPlatforms] = useState<string[]>(editing?.platforms ?? ["facebook"]);

  /**
   * 🔴 A SCHEDULE IS ONE CHANNEL. The owner, 19 Oct: "Ensure Scheduler is
   * working for every social media separately, not as one schedule for all
   * social medias."
   *
   * ⚠️ AND THE REASON IS NOT TIDINESS. A shared schedule shares its BRIEF,
   * its content type, its pools and its languages — only the clock could
   * differ. So "a carousel on Instagram, drawing on an angle written for a
   * list" was unaskable: picking it would have changed Facebook too
   * ⇒ src/lib/social/topicPools.ts, where the measurement is recorded.
   *
   * ⛔ LEGACY ROWS ARE NOT SILENTLY HALVED. A schedule saved with two channels
   * keeps its picker, with a notice — turning it into a radio would quietly
   * drop a channel the moment somebody opened it to change the time, and the
   * only symptom would be a feed that stopped.
   */
  const legacyMultiChannel = (editing?.platforms?.length ?? 0) > 1;
  const [contentType, setContentType] = useState(editing?.content_type ?? "text_graphic");
  const [topicPool, setTopicPool] = useState<string[]>(editing?.topic_pool ?? ["privacy", "quiet-hours"]);
  const [langs, setLangs] = useState<string[]>(editing?.languages ?? ["en"]);
  // ⚠️ `post_at` comes back as "09:30:00"; the input needs "09:30".
  const [postAt, setPostAt] = useState(String(editing?.post_at ?? "09:30").slice(0, 5));
  const [days, setDays] = useState<number[]>(editing?.days ?? [1, 2, 3, 4, 5]);
  /**
   * 🔑 PER-CHANNEL TIMES. Only the channels that DIFFER are held here; an
   * empty box means "the schedule's own time", which is both the common case
   * and the one that must not need a decision.
   * ⚠️ "09:30:00" from the database, "09:30" in the input.
   */
  const [channelTimes, setChannelTimes] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [id, v] of Object.entries(editing?.platform_times ?? {})) {
      if (v?.post_at) out[id] = String(v.post_at).slice(0, 5);
    }
    return out;
  });
  const [channelDays, setChannelDays] = useState<Record<string, number[]>>(() => {
    const out: Record<string, number[]> = {};
    for (const [id, v] of Object.entries(editing?.platform_times ?? {})) {
      if (Array.isArray(v?.days)) out[id] = v.days;
    }
    return out;
  });
  const [tone, setTone] = useState(editing?.tone ?? "gentle_plain");
  const [lengthHint, setLengthHint] = useState(editing?.length_hint ?? "medium");
  const [autoPublish, setAutoPublish] = useState(editing?.auto_publish ?? false);
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
      const res = await fetch(
        editing ? `/api/admin/social/schedules/${editing.id}` : "/api/admin/social/schedules",
        {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, brief, platforms, contentType, topicPool,
          languages: langs, postAt, days, autoPublish, tone, lengthHint,
          /**
           * ⛔ Only the channels that actually differ are sent. An entry equal
           * to the schedule's own time is not an override — storing it would
           * make the row claim a decision nobody made, and quietly pin that
           * channel if the schedule's time later changed.
           */
          platformTimes: Object.fromEntries(
            platforms
              .map((id) => {
                const entry: { post_at?: string; days?: number[] } = {};
                if (channelTimes[id] && channelTimes[id] !== postAt) entry.post_at = channelTimes[id];
                // ⚠️ Days too: identical to the schedule's is not an
                // override. Storing it would pin this channel silently if the
                // schedule's own days later changed.
                const same =
                  JSON.stringify([...(channelDays[id] ?? [])].sort()) === JSON.stringify([...days].sort());
                if (channelDays[id]?.length && !same) entry.days = channelDays[id];
                return [id, entry] as const;
              })
              .filter(([, entry]) => Object.keys(entry).length > 0),
          ),
        }),
      },
      );
      const json = await res.json();
      if (!res.ok) {
        // 🔑 The database's own refusal is the most useful message available —
        // it names the unqualified language and says what would qualify it.
        setError(json.error ?? "The schedule could not be saved.");
        return;
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-xs font-semibold text-zinc-400";
  const field = "min-h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm";

  return (
    <section className="space-y-5 rounded-xl border border-indigo-900/60 bg-indigo-950/10 p-5">
      <h2 className="text-base font-semibold">{editing ? `Editing “${editing.name}”` : "A new schedule"}</h2>

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
          className="w-full rounded-lg border border-white/15 bg-black/30 p-3 text-sm leading-relaxed" />
        <p className="text-[11px] text-zinc-500">
          The standing instruction behind every post on this schedule. The voice rules are fixed and
          not editable here.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>{legacyMultiChannel ? "Channels" : "Channel"}</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p.id} title={p.blockedBy}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                platforms.includes(p.id) ? "border-indigo-600 bg-indigo-950/40" : "border-white/8"}`}>
              <input
                type={legacyMultiChannel ? "checkbox" : "radio"}
                name={legacyMultiChannel ? undefined : "ns-channel"}
                checked={platforms.includes(p.id)}
                className="h-4 w-4 accent-indigo-500"
                onChange={() =>
                  legacyMultiChannel ? toggle(platforms, p.id, setPlatforms) : setPlatforms([p.id])
                }
              />
              {p.label}
            </label>
          ))}
        </div>

        {!legacyMultiChannel && (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            One channel per schedule. ⚠️ Not tidiness — a shared schedule shares its brief, its
            shape and its angles, so a carousel on Instagram could not be asked for without
            changing Facebook too. Give each channel its own and they can differ in what they say,
            not only when.
          </p>
        )}

        {legacyMultiChannel && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] leading-relaxed text-amber-300/90">
            ⚠️ <strong>This is the old shape:</strong> one schedule driving{" "}
            {platforms.length} channels, which must therefore share a brief, a content type and a
            set of angles. It still works and nothing here will change it behind your back. ▶️ To
            let the channels differ in what they say, make one schedule per channel and switch this
            one off.
          </p>
        )}
        {/* ⚠️ Only channels that actually cannot publish. This listed EVERY
            selected channel, so Facebook — live since this morning — was
            still being announced as blocked, with an empty reason. */}
        {platforms.some((id) => !CHANNELS[id as keyof typeof CHANNELS].canPublish) && (
          <ul className="space-y-1 text-[11px] leading-relaxed text-amber-300/90">
            {platforms
              .filter((id) => !CHANNELS[id as keyof typeof CHANNELS].canPublish)
              .map((id) => (
                <li key={id}>
                  ⛔ {CHANNELS[id as keyof typeof CHANNELS].label} cannot publish yet —{" "}
                  {CHANNELS[id as keyof typeof CHANNELS].blockedBy} Posts are still written,
                  pictured and queued.
                </li>
              ))}
          </ul>
        )}

        {/**
          * 🔑 PER-CHANNEL TIMES. The owner, 18 Oct: "I want every social media
          * schedule can be customized in different date and time."
          *
          * ⚠️ Blank means the schedule's own time, and blank is the default —
          * so the common case (one time for everything) needs no decision and
          * reads as before.
          */}
        {legacyMultiChannel && (
          <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              <strong className="text-zinc-300">A different time for a channel?</strong> Leave a box
              empty and that channel uses the schedule&rsquo;s own time ({postAt}). ⚠️ Channels
              differ in when their readers are there as much as in how they read.
            </p>
            {platforms.map((id) => (
              <div key={id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-32 text-sm text-zinc-300">
                  {CHANNELS[id as keyof typeof CHANNELS].label}
                </span>
                <input
                  type="time"
                  aria-label={`Time for ${CHANNELS[id as keyof typeof CHANNELS].label}`}
                  value={channelTimes[id] ?? ""}
                  onChange={(e) =>
                    setChannelTimes((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  className={`${field} max-w-36`}
                />
                <span className="text-[11px] text-zinc-500">
                  {channelTimes[id] && channelTimes[id] !== postAt
                    ? `its own time`
                    : `same as the schedule`}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-500"
                    checked={Boolean(channelDays[id]?.length)}
                    onChange={() =>
                      setChannelDays((prev) => {
                        const next = { ...prev };
                        if (next[id]?.length) delete next[id];
                        else next[id] = days;
                        return next;
                      })
                    }
                  />
                  different days too
                </label>
                {channelDays[id]?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <label
                        key={d}
                        className={`min-h-9 cursor-pointer rounded-md border px-2 py-1 text-[11px] ${
                          channelDays[id].includes(i)
                            ? "border-indigo-600 bg-indigo-950/40"
                            : "border-white/8 text-zinc-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={channelDays[id].includes(i)}
                          onChange={() =>
                            setChannelDays((prev) => {
                              const have = prev[id] ?? [];
                              const next = have.includes(i)
                                ? have.filter((x) => x !== i)
                                : [...have, i].sort();
                              return { ...prev, [id]: next };
                            })
                          }
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>Shape</legend>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <label key={s.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
              contentType === s.id ? "border-indigo-600 bg-indigo-950/40" : "border-white/8"}`}>
              <input type="radio" name="ns-shape" checked={contentType === s.id} className="h-4 w-4 accent-indigo-500"
                onChange={() => setContentType(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
        {/* ⚠️ Said BEFORE the schedule is saved, not discovered after posting.
            A GIF animates on X and nowhere else — LinkedIn strips it and
            Facebook converts it — and that is the one thing somebody choosing
            it needs to know. */}
        {(contentType === "animated_gif" || contentType === "short_video") && (
          <p className="text-[11px] leading-relaxed text-amber-300/90">
            {animationWarning(contentType === "animated_gif" ? "gif" : "mp4", platforms) ??
              "This will animate on every channel you have chosen."}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={label}>Languages — it writes one per post, rotating</legend>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <label key={l.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
              langs.includes(l.code)
                ? l.mayPostUnattended ? "border-emerald-800 bg-emerald-950/30" : "border-amber-800 bg-amber-950/20"
                : "border-white/8 text-zinc-400"}`}>
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
              days.includes(i) ? "border-indigo-600 bg-indigo-950/40" : "border-white/8 text-zinc-400"}`}>
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
              topicPool.includes(p.id) ? "border-indigo-600 bg-indigo-950/40" : "border-white/8 text-zinc-400"}`}>
              <input type="checkbox" checked={topicPool.includes(p.id)} className="h-3.5 w-3.5 accent-indigo-500"
                onChange={() => toggle(topicPool, p.id, setTopicPool)} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-white/8 pt-4">
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
        <section className="space-y-3 rounded-xl border border-white/15 bg-black/30 p-4">
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

      <div className="flex flex-wrap gap-2 border-t border-white/8 pt-4">
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={previewing || brief.trim().length < 20 || langs.length === 0 || platforms.length === 0}
          className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10 disabled:opacity-40"
        >
          {previewing ? "Writing a sample…" : "See what it would write"}
        </button>
        <button type="button" onClick={() => void submit()}
          disabled={busy || name.trim().length < 3 || brief.trim().length < 20 || langs.length === 0 || platforms.length === 0 || days.length === 0}
          className="min-h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40">
          {busy ? "Saving…" : editing ? "Save the changes" : "Create it"}
        </button>
        <button type="button" onClick={onCancel}
          className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10">
          Cancel
        </button>
      </div>
    </section>
  );
}
