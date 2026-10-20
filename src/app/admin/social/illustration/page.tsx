"use client";

// /admin/social/illustration — choose the house style by LOOKING at it.
//
// 🔴 WHY THIS IS A SCREEN AND NOT A DECISION IN A DOCUMENT. The owner, 20 Oct
// 2026: *"all posts still looks very similar."* He was right, and the way it
// was established was by rendering nine queued cards and looking at them
// together — not by reading the recipe arithmetic, which said 25,344 and was
// visually overstated. Three defects this month were invisible from the desk.
//
// ⛔ NOTHING HERE PUBLISHES, STORES OR QUEUES. It draws samples. Wiring
// illustrations into the pipeline is a separate change, after a style is
// chosen and after the safety gate has been exercised on real output.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Explain } from "@/app/admin/social/_components/ui";

type Style = { id: string; label: string; note: string; family?: string; textZone?: string };
type Shot = { dataUrl?: string; ms?: number; error?: string; detail?: string };

export default function Illustration() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [model, setModel] = useState("");
  const [mood, setMood] = useState("");
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/illustration", { credentials: "same-origin" });
    if (res.status === 401 || res.status === 403) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const data = await res.json();
    setStyles(data.styles ?? []);
    setModels(data.models ?? []);
    setModelsError(data.modelsError ?? "");
    // ⚠️ No invented default. If the key lists nothing, the page says so
    // rather than offering a model id that will 404.
    if ((data.models ?? []).length > 0) setModel(data.models[0]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const draw = useCallback(
    async (styleId: string) => {
      setBusy(styleId);
      setShots((s) => ({ ...s, [styleId]: {} }));
      try {
        const res = await fetch("/api/admin/social/illustration", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ style: styleId, model, mood: mood.trim() || null }),
        });
        const data = await res.json();
        setShots((s) => ({
          ...s,
          [styleId]: res.ok
            ? { dataUrl: data.dataUrl, ms: data.ms }
            : // 🔑 The raw refusal, shown. This cannot be run locally, so the
              // first call IS the experiment and a tidy message wastes it.
              { error: data.error ?? `HTTP ${res.status}`, detail: data.detail },
        }));
      } catch (e) {
        setShots((s) => ({ ...s, [styleId]: { error: (e as Error).message } }));
      } finally {
        setBusy(null);
      }
    },
    [model, mood],
  );

  const drawAll = useCallback(async () => {
    // ⚠️ One at a time, deliberately. A dozen concurrent image calls is the
    // shape that trips a rate limit and reads as "the feature is broken".
    for (const s of styles) await draw(s.id);
  }, [styles, draw]);

  return (
    <SocialPage
      here="/admin/social/illustration"
      title="A picture behind the words"
      lede="Backgrounds for the posts, varied by medium — pastel, watercolour, pen and ink, pencil, vector, 3D, photography. Draw them and look. Nothing here is published or saved."
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <div className="space-y-6">
          <Explain q="What this costs, and what it does not fix">
            <p>
              A drawing is roughly one to four cents, so three a day is a few dollars a month —
              against Canva Enterprise, whose Autofill API is the only way to automate Canva and is
              priced for far larger organisations.
            </p>
            <p className="mt-2">
              It does <strong>not</strong> solve Bengali or Hindi on a card. Image models cannot
              draw those scripts; the picture is the background and the words are still drawn by us.
            </p>
            <p className="mt-2">
              Each style reserves a quiet area for the words — sky, bare paper, flat colour. Where
              that area sits is printed under each one.
            </p>
          </Explain>

          {modelsError && (
            <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200">
              Could not ask which models are available: {modelsError}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-zinc-300">
              <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100"
              >
                {models.length === 0 && <option value="">(none available)</option>}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-300">
              <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                Feeling (optional)
              </span>
              <input
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="the quiet after everyone is asleep"
                className="w-80 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100"
              />
            </label>

            <button
              onClick={() => void drawAll()}
              disabled={!model || busy !== null}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
            >
              {busy ? `Drawing ${busy}…` : `Draw all ${styles.length}`}
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {styles.map((s) => {
              const shot = shots[s.id];
              return (
                <figure key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-black/30">
                    {shot?.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.dataUrl} alt={s.label} className="h-full w-full object-cover" />
                    ) : shot?.error ? (
                      <div className="max-h-full overflow-auto p-3 text-left">
                        <p className="text-xs font-medium text-rose-300">{shot.error}</p>
                        {shot.detail && (
                          <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] leading-relaxed text-rose-200/70">
                            {shot.detail}
                          </pre>
                        )}
                      </div>
                    ) : busy === s.id ? (
                      <span className="text-xs text-zinc-500">drawing…</span>
                    ) : (
                      <span className="text-xs text-zinc-600">not drawn yet</span>
                    )}
                  </div>
                  <figcaption className="mt-3">
                    <p className="text-sm font-medium text-zinc-100">{s.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.note}</p>
                    {s.family && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                        {s.family} · words go {s.textZone}
                      </p>
                    )}
                    <button
                      onClick={() => void draw(s.id)}
                      disabled={!model || busy !== null}
                      className="mt-2 text-xs text-zinc-300 underline underline-offset-4 disabled:opacity-40"
                    >
                      {shot?.dataUrl ? "Draw another" : "Draw this one"}
                    </button>
                    {shot?.ms != null && <span className="ml-2 text-xs text-zinc-600">{shot.ms}ms</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      )}
    </SocialPage>
  );
}
