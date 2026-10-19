"use client";

// /admin/social/scripts — may the card renderer draw this script?
//
// 🔴 THE BLOCKER THIS UNBLOCKS. `fonts.ts` gates every complex script behind
// `shapingVerified`: *"a person who READS this script has looked at a rendered
// picture and said it is right"*. Twelve of thirteen are false — and for
// eleven of them that is because **nobody has ever looked**, not because
// anything was proven. There was no picture to look at. Now there is.
//
// 🔑 THE DESIGN IS THE COMPARISON. The same sentence appears twice: once as
// ordinary HTML, which the browser shapes correctly, and once as the card
// renderer draws it. ⛔ A render on its own is unjudgeable — you cannot tell a
// correct conjunct from a broken one without the correct one beside it. Side
// by side, the difference is visible even to somebody who does not read the
// script, which is the whole point.
//
// ⚠️ WHAT THIS PAGE CANNOT DO is decide. It shows; a reader decides, and the
// decision is one flag in fonts.ts ⇒ that flag unlocks the wordmark AND the
// card's words together.

import { useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";
import { SCRIPT_SAMPLES, SCRIPT_STRESS_WORDS } from "@/lib/social/scriptSamples";
import { SCRIPT_FONTS } from "@/lib/social/fonts";

export default function ScriptCheck() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/admin/social/channels", { credentials: "same-origin" }).then((r) =>
      setAuthed(r.status !== 401),
    );
  }, []);

  const scripts = Object.keys(SCRIPT_SAMPLES);

  return (
    <SocialPage
      here="/admin/social/scripts"
      title="Which scripts can a card draw?"
      lede="The same sentence twice — as your browser draws it, and as the card renderer draws it. If they differ, the card is wrong."
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>
          <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200">
            ⚠️ <strong>Only somebody who reads the script can answer this.</strong> One script has a
            known fault: Bengali published <span className="font-mono">অভিমান</span> as{" "}
            <span className="font-mono">অভমিান</span> on 18 Oct. The rest are blocked because nobody
            has looked — which is not the same as knowing they are broken.
          </div>

          {scripts.map((key) => {
            const sample = SCRIPT_SAMPLES[key];
            const font = SCRIPT_FONTS[key];
            const stress = SCRIPT_STRESS_WORDS[key];
            const verified = font?.shapingVerified === true;

            return (
              <section key={key} className="space-y-3 rounded-xl border border-white/8 bg-white/5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold capitalize">{key}</h2>
                  <Chip tone={verified ? "green" : "amber"}>
                    {verified ? "Verified — cards may use it" : "Not checked — cards use Latin"}
                  </Chip>
                  <span className="text-xs text-zinc-500">sample in {sample.language}</span>
                </div>

                {/* 🔑 The correct rendering, by the browser, which does full shaping. */}
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    How it should look — your browser
                  </p>
                  <p className="rounded-lg border border-white/8 bg-black/30 p-4 text-2xl leading-relaxed text-zinc-100">
                    {sample.text}
                  </p>
                  {stress && (
                    <p className="rounded-lg border border-white/8 bg-black/30 p-4 text-4xl text-zinc-100">
                      {stress.word}
                    </p>
                  )}
                </div>

                {/* ⚠️ The same words through the real card machinery. */}
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    How the card draws it
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/social/script-sample/${key}`}
                    alt={`The card renderer drawing ${key}`}
                    className="w-full rounded-lg border border-white/8"
                  />
                </div>

                {stress && (
                  <p className="rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-zinc-400">
                    ⚠️ {stress.why}
                  </p>
                )}

                {!verified && (
                  <p className="text-xs leading-relaxed text-zinc-500">
                    ▶️ If the two match, this script can be unblocked — one flag,{" "}
                    <span className="font-mono">shapingVerified</span> in{" "}
                    <span className="font-mono">src/lib/social/fonts.ts</span>, which unlocks the
                    wordmark and the card&rsquo;s words together. ⛔ Say so only if you read{" "}
                    {sample.language}.
                  </p>
                )}
              </section>
            );
          })}

          <Explain q="Why not just fix the renderer so every script works?">
            <p>
              Because it may not be broken for every script. The card is drawn by Satori, which does
              not do full complex-script shaping — but &ldquo;not full&rdquo; is not
              &ldquo;none&rdquo;, and which scripts survive it is an empirical question nobody here
              had asked. Bengali demonstrably fails. Devanagari, Tamil, Telugu and the rest are
              simply unknown.
            </p>
            <p>
              ⛔ The honest order is to look first. Replacing the renderer is a large piece of work,
              and doing it for scripts that already render correctly would be expensive and would
              still need a reader to confirm the result.
            </p>
          </Explain>
        </>
      )}
    </SocialPage>
  );
}
