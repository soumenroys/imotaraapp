"use client";

// Social posting as a picture: from a schedule, through the automatic writer and
// your review, to the post going out and its numbers coming back.
//
// 🔑 The owner asked (24 Oct 2026) for the same kind of diagram the calling
// console has, so an admin sees where a post can wait, where it can be stopped,
// and what they must do.
//
// ⚠️ EVERY BOX STATES A RULE THE CODE ENFORCES — the 10-day horizon and 2 posts
// per run (lib/social/horizon.ts), the review-or-auto decision
// (pipeline.decideStatus), the pause switch, 3 publish attempts
// (cron/social-publish), the refusal email to social@ (lib/social/alert.ts),
// stats at 19:30 IST (vercel.json social-stats). Change a rule there and this
// picture is wrong until it is changed here too.
//
// Reads the pause switch and the connected channels itself, from the same
// endpoint the Channels screen uses, so the picture says what is true NOW.

import { useEffect, useState } from "react";
import { Arrow, Box, FlowFrame, Lane, ToneKey } from "@/app/admin/_components/flow";

type Live = { paused: boolean; connected: string[] } | null;

function useLive(): Live {
  const [live, setLive] = useState<Live>(null);
  useEffect(() => {
    let gone = false;
    fetch("/api/admin/social/channels", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (gone || !j) return;
        const connected = ((j.accounts ?? []) as { platform: string; status: string }[])
          .filter((a) => a.status === "ok" || a.status === "expiring")
          .map((a) => a.platform);
        setLive({ paused: Boolean(j.settings?.posting_paused), connected });
      })
      .catch(() => {});
    return () => { gone = true; };
  }, []);
  return live;
}

const NAMES: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", x: "X", linkedin: "LinkedIn" };

export function PostFlow({ waiting }: { waiting: number }) {
  const live = useLive();
  return (
    <FlowFrame title="How a post goes out — the whole path">
      {/* 1–2 — the schedule and the writer */}
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <Box tone="gate" title="1 · Schedules: one schedule per kind of post">
          A brief (what the posts are about), the channels, the shape (text, picture, video…), the languages, the time
          and the days. Nothing is written until a schedule exists.
        </Box>
        <Arrow side />
        <Box tone="step" title="2 · The writer fills the next 10 days by itself">
          Checked every minute, 2 posts at a time. The subject is fresh each time and never repeats; every draft passes
          the word and safety checks. If a slot cannot be written, social@imotara.com gets an email.
        </Box>
      </div>

      <Arrow label="each draft then lands in one of two places" />

      {/* 3 — review or automatic */}
      <div className="flex flex-col gap-3 md:flex-row">
        <Lane title="3 · Waiting for you (the usual way)">
          <Box tone="wait" title="On Today, as a draft">
            <b className={waiting > 0 ? "text-amber-300" : "text-emerald-300"}>
              {waiting > 0 ? `${waiting} waiting for you now.` : "Nothing waiting right now."}
            </b>{" "}
            Up to 10 days ahead, so there is time to read it.
          </Box>
          <div className="grid grid-cols-3 gap-2">
            <Box tone="good" title="Approve">Ready to go out at its time.</Box>
            <Box tone="person" title="Change the words">Edited, then back in the queue to approve.</Box>
            <Box tone="stop" title="Skip it">Never goes out.</Box>
          </div>
        </Lane>

        <Lane title="3 · Or approved without asking">
          <Box tone="step" title="Only if BOTH are true">
            The schedule says “Post it without asking me” (off by default), AND the language has both ticks on the
            Languages screen. Otherwise it waits for you anyway.
          </Box>
          <Box tone="step" title="✍️ Or write one yourself">
            “Write a post” — the same checks run, then it waits or is approved, as you choose.
          </Box>
        </Lane>
      </div>

      <Arrow label="at its scheduled time (checked every minute)" />

      {/* 4 — the publish gates */}
      <div className="grid gap-2 md:grid-cols-3">
        <Box tone="gate" title="4a · Is posting paused?">
          The switch on the Channels screen. While paused, approved posts wait.{" "}
          {live && (
            <b className={live.paused ? "text-red-300" : "text-emerald-300"}>Right now: {live.paused ? "PAUSED" : "posting"}.</b>
          )}
        </Box>
        <Box tone="gate" title="4b · Is the channel connected and working?">
          If not, the post waits and is tried again each minute.{" "}
          {live && (
            <b className="text-zinc-200">
              Working now: {live.connected.length ? live.connected.map((p) => NAMES[p] ?? p).join(", ") : "none"}.
            </b>
          )}
        </Box>
        <Box tone="good" title="4c · Posted publicly">
          Under the brand’s name, on that channel. ⛔ It cannot be un-posted from here — that is why reading comes
          first.
        </Box>
      </div>

      <Arrow label="5 · afterwards" />

      <div className="grid gap-2 sm:grid-cols-3">
        <Box tone="good" title="Published">The link appears on Today.</Box>
        <Box tone="stop" title="The platform refused">Tried up to 3 times in all, then marked failed — read why on Today.</Box>
        <Box tone="step" title="Numbers come back">Reach, likes and saves on the Stats screen, refreshed daily at 19:30 IST.</Box>
      </div>

      <ToneKey />
    </FlowFrame>
  );
}
