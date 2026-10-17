"use client";

// /admin/social/compose — write a post yourself.
//
// 🔑 THE OCCASIONS THAT MATTER ARE NEVER GENERATED. A launch, a thank-you, an
// apology, a response to something in the news — those need a person, and
// before this screen there was nowhere to write them.
//
// ⛔ AND IT IS NOT A BYPASS. The same gate runs on these words as on a
// generated draft. Eight claims this product must never make were found in copy
// written by people who knew the rules, so this is the path it matters most on.

import { useEffect, useMemo, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { PageTutorial, TUTORIALS } from "@/app/admin/social/_components/PageTutorial";
import { PLATFORMS as CHANNELS, PLATFORM_IDS } from "@/lib/social/platforms";
import { SocialPage, Explain } from "@/app/admin/social/_components/ui";

type LanguageRow = {
  code: string;
  name: string;
  reviewed: boolean;
  abuse_list_ready: boolean;
  mayPostUnattended: boolean;
  reason: string | null;
};

type Result = { platform: string; postId?: string; error?: string; notes?: string[] };

// ⛔ From contentTypes, not pipeline: this is a client component and pipeline
// reaches `crypto` through visualRecipe.
import { CONTENT_TYPES, SHAPE_LABELS, type ContentType } from "@/lib/social/contentTypes";

const PLATFORMS = PLATFORM_IDS.map((id) => ({ id, label: CHANNELS[id].label }));

/**
 * 🔴 THE SIXTH COPY OF THE SHAPE LIST, and the second one that was short two
 * entries. A post written by hand could not be a short video or an animated
 * GIF, although the compose route accepts both and the encoder has been there
 * since the animation work landed. ⇒ Derived, with a hint apiece; a shape
 * without a hint is a compile error.
 */
const SHAPE_HINTS: Record<ContentType, string> = {
  text: "Words only.",
  text_graphic: "A caption and a composed card.",
  graphic: "The card carries it.",
  short_video: "The card assembling itself. Moves on LinkedIn, Facebook, Instagram and X.",
  animated_gif: "The same six seconds as a GIF. ⚠️ Only X plays it — the rest show frame one.",
};

const SHAPES = CONTENT_TYPES.map((id) => ({ id, label: SHAPE_LABELS[id], hint: SHAPE_HINTS[id] }));

/** Mirrors `checkHouseStyle` closely enough to be useful while typing.
 *  ⚠️ The real check runs on the server; this is a hint, not the verdict. */
function localCounts(text: string) {
  return {
    characters: [...text].length,
    emoji: (text.match(/\p{Extended_Pictographic}/gu) ?? []).length,
    hashtags: (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length,
    links: (text.match(/https?:\/\/\S+/g) ?? []).length,
  };
}

export default function ComposePost() {
  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [language, setLanguage] = useState("en");
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [shape, setShape] = useState<string>("text_graphic");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [support, setSupport] = useState("");
  const [when, setWhen] = useState<"queue" | "now">("queue");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  /** null = not yet known. ⛔ Never assumed true. */
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/social/languages", { credentials: "same-origin" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load the languages.");
        return;
      }
      setLanguages(json.languages ?? []);
    })();
  }, []);

  const counts = useMemo(() => localCounts(body), [body]);
  const chosen = languages.find((l) => l.code === language);

  async function submit() {
    setBusy(true);
    setError("");
    setNote("");
    setResults([]);
    try {
      const res = await fetch("/api/admin/social/compose", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platforms, language, subject, body, support, contentType: shape, when }),
      });
      const json = await res.json();
      setResults(json.results ?? []);
      if (!res.ok) setError(json.error ?? json.note ?? "Nothing was saved.");
      else setNote(json.note ?? "Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SocialPage
      here="/admin/social/compose"
      title="Write a post"
      lede="Your words, the same checks. Every language is open here, because you are reading it."
    >

        {authed === false && <SignedOut />}

        {error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div>
        )}
        {note && (
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            {note}{" "}
            <a href="/admin/social" className="underline">
              Back to the queue
            </a>
          </div>
        )}

        {authed === null && (
          <p className="text-sm text-zinc-500">Checking the admin session…</p>
        )}

        {/* ⛔ `=== true`, not `!== false`. While the session check is in
            flight `authed` is null, and the earlier version rendered the whole
            body in that moment — master switch reading "Everything is held",
            counters reading 0 — none of it fetched. Brief on a fast connection,
            not brief on a slow one, and a reassuring lie either way. */}
        {authed === true && (
          <>
          <PageTutorial id="compose" {...TUTORIALS.compose} />

        <section className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-8">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="lang" className="block text-xs font-semibold text-zinc-400">
                Language
              </label>
              <select
                id="lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
              >
                <optgroup label="Read by someone here">
                  {languages
                    .filter((l) => l.reviewed)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Not yet read by anyone here">
                  {languages
                    .filter((l) => !l.reviewed)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              {chosen && !chosen.mayPostUnattended && (
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  A schedule could not post in {chosen.name} unattended — {chosen.reason} ⛔ That does
                  not restrict this screen: you are the check here.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-zinc-400">Channels</span>
              <div className="space-y-2">
                {PLATFORMS.map((p) => (
                  <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={platforms.includes(p.id)}
                      onChange={(e) =>
                        setPlatforms(
                          e.target.checked ? [...platforms, p.id] : platforms.filter((x) => x !== p.id),
                        )
                      }
                      className="h-4 w-4 accent-indigo-500"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-zinc-400">Shape</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {SHAPES.map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-lg border p-3 text-sm ${
                    shape === s.id ? "border-indigo-600 bg-indigo-950/40" : "border-zinc-800 hover:bg-zinc-900"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="shape"
                      checked={shape === s.id}
                      onChange={() => setShape(s.id)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    {s.label}
                  </span>
                  <span className="mt-1 block text-[11px] text-zinc-500">{s.hint}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">
              The picture is composed from an unused recipe, and its headline comes from your opening
              sentence — so nothing in it is unchecked.
            </p>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="subject" className="block text-xs font-semibold text-zinc-400">
              What this one is about
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A short phrase, for the register and the headline"
              className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
            />
            <p className="text-[11px] text-zinc-500">
              Kept in the register, so no generated post will use it either.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="body" className="block text-xs font-semibold text-zinc-400">
              The post
            </label>
            <textarea
              id="body"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm leading-7"
            />
            <div className="flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
              <span>{counts.characters} characters</span>
              <span className={counts.emoji > 0 ? "text-amber-400" : ""}>{counts.emoji} emoji</span>
              <span className={counts.hashtags > 2 ? "text-amber-400" : ""}>{counts.hashtags} hashtags</span>
              <span className={counts.links > 1 ? "text-amber-400" : ""}>{counts.links} links</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="support" className="block text-xs font-semibold text-zinc-400">
              A supporting line for the picture (optional)
            </label>
            <input
              id="support"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
            />
          </div>

          <fieldset className="space-y-2 border-t border-zinc-800 pt-4">
            <legend className="text-xs font-semibold text-zinc-400">When</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="when"
                checked={when === "queue"}
                onChange={() => setWhen("queue")}
                className="h-4 w-4 accent-indigo-500"
              />
              Leave it in the queue
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="when"
                checked={when === "now"}
                onChange={() => setWhen("now")}
                className="h-4 w-4 accent-indigo-500"
              />
              Approve it now
            </label>
            <p className="text-[11px] text-zinc-500">
              ⚠️ Approving does not publish it — there is no channel adapter yet. It means the post is
              ready and waiting for one.
            </p>
          </fieldset>

          <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !subject.trim() || !body.trim() || platforms.length === 0}
              className="min-h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? "Checking…" : when === "now" ? "Approve it" : "Save to the queue"}
            </button>
          </div>
        </section>

        {results.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-300">What happened</h2>
            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r.platform}
                  className={`rounded-lg border p-3 text-sm ${
                    r.postId
                      ? "border-emerald-900 bg-emerald-950/20 text-emerald-200"
                      : "border-rose-900 bg-rose-950/20 text-rose-200"
                  }`}
                >
                  <strong>{r.platform}</strong>: {r.postId ? "saved" : r.error}
                  {(r.notes ?? []).length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[11px] opacity-80">
                      {(r.notes ?? []).map((n, i) => (
                        <li key={i}>· {n}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ⚠️ These five stay OPEN, unlike most explanations here: somebody is
            about to write, and this is the moment the rules are useful. */}
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm">
          <h2 className="font-semibold text-zinc-300">How to write it</h2>
          <ul className="space-y-1.5 text-zinc-400">
            <li>Write to one person. “You”, never “users”.</li>
            <li>Say one true thing and stop.</li>
            <li>Leave room — but never “What do you think? 👇”.</li>
            <li>Be generous. Say what the product does not do.</li>
            <li>Assume nothing about who is reading.</li>
          </ul>
          <Explain q="What will be refused automatically?">
            <p>
              Clinical words — therapist, counsellor, diagnose, heal — because this product is not
              therapy and must never imply it is.
            </p>
            <p>Abuse and profanity.</p>
            <p>
              Careless language: <em>crazy</em>, <em>insane</em>, <em>psycho</em>, <em>triggered</em>{" "}
              used loosely. On a page about how people feel, that is the sentence that gets
              screenshot.
            </p>
            <p>
              ⛔ Whether it is gentle, insightful or generous is not something a check can read. That
              part is yours.
            </p>
          </Explain>
        </section>
          </>
        )}
    </SocialPage>
  );
}
