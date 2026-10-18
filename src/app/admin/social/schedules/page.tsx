"use client";

// /admin/social/schedules — what gets written, and when.
//
// ⚠️ Split off the overview, which had become the queue AND the schedules AND
// the creation form on one scroll. Two different jobs: "what needs me today"
// and "what should happen every week" are not the same visit.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { PageTutorial, TUTORIALS } from "@/app/admin/social/_components/PageTutorial";
import { NewSchedule } from "@/app/admin/social/_components/NewSchedule";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";

type Schedule = {
  id: string;
  name: string;
  brief: string;
  platforms: string[];
  content_type: string;
  languages: string[];
  post_at: string;
  timezone: string;
  days: number[];
  active: boolean;
  auto_publish: boolean;
  // ⚠️ Needed to EDIT one, not to list one. The API has always returned them.
  topic_pool: string[];
  tone: string;
  length_hint: string;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHAPE: Record<string, string> = {
  text: "Words only",
  graphic: "A picture",
  text_graphic: "Words and a picture",
  short_video: "Short video",
};

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string; reviewed: boolean; mayPostUnattended: boolean; reason: string | null }[]>([]);
  const [role, setRole] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  /** 🔑 The schedule being edited, or null. ⚠️ Keyed on in the form below, so
   *  switching from one schedule to another re-reads its values. */
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([
      fetch("/api/admin/social/schedules", { credentials: "same-origin" }),
      fetch("/api/admin/social/languages", { credentials: "same-origin" }),
    ]);
    if (s.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const sj = await s.json();
    setSchedules(sj.schedules ?? []);
    setRole(sj.actorRole ?? "");
    setLanguages((await l.json()).languages ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function writeNow(id: string) {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch("/api/admin/social/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduleId: id }),
      });
      const json = await res.json();
      setMessage(
        res.ok
          ? `Written: “${json.subject}”. It is waiting for you on Today.`
          : json.error ?? "Nothing was written.",
      );
    } finally {
      setBusy("");
    }
  }

  async function setActive(id: string, active: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/social/schedules/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) setMessage((await res.json()).error ?? "That did not work.");
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <SocialPage
      here="/admin/social/schedules"
      title="Schedules"
      lede="Each one writes a post at a set time, on the days you choose."
      actions={
        authed === true ? (
          <button
            type="button"
            onClick={() => {
              // ⚠️ Closes an open EDIT too. Otherwise "New schedule" leaves the
              // edit form on screen and the new one never appears.
              setEditing(null);
              setCreating((c) => !c);
            }}
            className="flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500"
          >
            {creating ? "Close" : "New schedule"}
          </button>
        ) : undefined
      }
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>
          <PageTutorial id="schedules" {...TUTORIALS.schedules} />

          {message && (
            <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
              {message}
            </div>
          )}

          {(creating || editing) && (
            <NewSchedule
              /* ⚠️ Keyed, so opening a DIFFERENT schedule re-reads its values.
                 Without this React keeps the first one's state and the form
                 silently edits one schedule with another's words in it. */
              key={editing?.id ?? "new"}
              languages={languages}
              isOwner={role === "owner"}
              editing={editing}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSaved={() => {
                const wasEditing = editing;
                setCreating(false);
                setEditing(null);
                setMessage(
                  wasEditing
                    ? `“${wasEditing.name}” saved. ⚠️ Posts already written keep the words they were written with — press “Write one now” to see the change.`
                    : "Schedule created. Press “Write one now” to see what it writes.",
                );
                void load();
              }}
            />
          )}

          {schedules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-zinc-500">
              No schedules yet. Press <strong>New schedule</strong> to make one.
            </p>
          ) : (
            <ul className="space-y-3">
              {schedules.map((s) => (
                <li key={s.id} className="space-y-3 rounded-xl border border-white/8 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {!s.active && <Chip>Paused</Chip>}
                        {s.auto_publish ? (
                          <Chip tone="amber" title="It posts without you reading it first.">
                            Posts on its own
                          </Chip>
                        ) : (
                          <Chip tone="indigo" title="Every post waits for you to approve it.">
                            Waits for you
                          </Chip>
                        )}
                      </div>
                      {/* 🔑 One readable line instead of six raw fields. */}
                      <p className="text-sm text-zinc-400">
                        <strong className="tabular-nums text-zinc-300">{String(s.post_at).slice(0, 5)}</strong>{" "}
                        on {s.days.length === 7 ? "every day" : s.days.map((d) => DAY[d]).join(", ")} ·{" "}
                        {SHAPE[s.content_type] ?? s.content_type} · {s.platforms.join(" and ")} ·{" "}
                        {s.languages.length === 1
                          ? s.languages[0]
                          : `${s.languages.length} languages, in turn`}
                      </p>
                    </div>
                    <div className="flex flex-none gap-2">
                      <button
                        type="button"
                        onClick={() => void writeNow(s.id)}
                        disabled={busy === s.id}
                        className="min-h-11 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        {busy === s.id ? "Writing…" : "Write one now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(false);
                          setEditing(s);
                          // ⚠️ The form renders above the list, so without this
                          // the button appears to do nothing on a long page.
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="min-h-11 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void setActive(s.id, !s.active)}
                        disabled={busy === s.id}
                        className="min-h-11 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        {s.active ? "Pause" : "Resume"}
                      </button>
                    </div>
                  </div>

                  <Explain q="What does it write about?">
                    <p>{s.brief}</p>
                    <p>
                      The subject is chosen fresh each time and checked against everything already
                      posted, so it never repeats.
                    </p>
                  </Explain>
                </li>
              ))}
            </ul>
          )}

          <Explain q="When exactly does a schedule run?">
            <p>
              Two hours before its time, so a draft is ready with room to read it. A 09:30 schedule
              writes at 07:30.
            </p>
            <p>
              If you have not approved it by 09:30 it simply waits — it is not lost, and the schedule
              tries again the next day.
            </p>
          </Explain>
        </>
      )}
    </SocialPage>
  );
}
