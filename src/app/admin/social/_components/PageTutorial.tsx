"use client";

// A numbered walkthrough at the top of each social screen.
//
// 🔑 DIFFERENT FROM "HOW THIS WORKS", which explains the IDEA. This is the
// sequence: do this, then this, and here is what you will see. Somebody
// arriving on a screen for the first time wants the second one.
//
// ⚠️ OPEN THE FIRST TIME, SHUT AFTER THAT. A walkthrough that reappears every
// visit becomes the thing you close before you start working, and then nobody
// reads it on the one screen where they needed it.
//
// ⛔ The dismissal is a per-browser convenience, nothing more. It is wrapped in
// try/catch and the panel renders correctly when storage is unavailable — a
// private window, cleared site data, or a browser that throws on access. ⇒ The
// failure mode is "the tutorial shows again", which is harmless.

import { useEffect, useState } from "react";

export type Step = {
  /** What to do, as an instruction. */
  do: string;
  /** What happens, or what to look for. Optional. */
  then?: string;
};

const KEY = "imotara.social.tutorial.";

export function PageTutorial({
  id,
  title,
  steps,
  footnote,
}: {
  id: string;
  title: string;
  steps: Step[];
  footnote?: string;
}) {
  // ⚠️ Starts CLOSED and opens on mount if nothing is stored. Starting open
  // and closing would flash the panel on every visit for people who dismissed
  // it, which is worse than a beat's delay the first time.
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(KEY + id) === "done";
    } catch {
      // Storage unavailable: show it. Harmless, and better than hiding help.
    }
    setOpen(!dismissed);
    setReady(true);
  }, [id]);

  function remember(next: boolean) {
    setOpen(next);
    try {
      if (next) window.localStorage.removeItem(KEY + id);
      else window.localStorage.setItem(KEY + id, "done");
    } catch {
      // The panel still opens and closes; it just will not be remembered.
    }
  }

  if (!ready) return null;

  return (
    <section className="rounded-xl border border-sky-900/60 bg-sky-950/20">
      <button
        type="button"
        onClick={() => remember(!open)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold text-sky-100"
      >
        <span>{title}</span>
        <span className="text-xs font-normal text-sky-300/70">{open ? "Hide" : "Show the steps"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-sky-900/60 p-4">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.do} className="flex gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sky-900/70 text-[11px] font-semibold text-sky-100">
                  {i + 1}
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm text-zinc-100">{s.do}</span>
                  {s.then && <span className="block text-xs leading-relaxed text-zinc-400">{s.then}</span>}
                </span>
              </li>
            ))}
          </ol>
          {footnote && <p className="text-xs leading-relaxed text-sky-200/80">{footnote}</p>}
          <button
            type="button"
            onClick={() => remember(false)}
            className="min-h-11 text-xs text-sky-300 underline underline-offset-2 hover:text-sky-200"
          >
            Got it — do not show this again
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Every screen's steps, in one place.
 *
 * 🔑 Together they are the whole tool, in order: make a schedule → read what it
 * writes → connect somewhere to send it → widen the languages. ⇒ Each screen's
 * last step points at the next screen, so following them end to end is a tour
 * rather than five unconnected lists.
 */
export const TUTORIALS: Record<string, { title: string; steps: Step[]; footnote?: string }> = {
  today: {
    title: "First time here? Four steps",
    steps: [
      {
        do: "Look at the line under the tabs — it says whether anything is waiting for you.",
        then: "Drafts appear two hours before a schedule's time, so there is room to read them.",
      },
      {
        do: "Press “Read it” on a draft to open the words, the picture and the checks.",
        then: "You see what the word check ran, and the three questions no check can answer.",
      },
      {
        do: "Press Approve, or Change the words if something is off.",
        then: "Editing puts it back in the queue — approving belongs to the words, not the row.",
      },
      {
        do: "No drafts yet? Go to Schedules and make one.",
        then: "A schedule is what writes posts. Nothing is written until one exists.",
      },
    ],
    footnote:
      "⛔ Nothing you approve is published yet — no channel is connected. An approved post waits, and you can post it by hand in the meantime.",
  },

  schedules: {
    title: "How to set up a schedule",
    steps: [
      { do: "Press “New schedule”." },
      {
        do: "Name it, then write the brief — what every post on this schedule should be about.",
        then: "The brief is the standing instruction. The subject is chosen fresh each time and never repeats.",
      },
      {
        do: "Pick the channels, the shape, the languages, the time and the days.",
        then: "Shape is text, a picture, both, a short video or an animated GIF. It writes in one language per post, rotating through the ones you pick.",
      },
      {
        do: "Press “See what it would write” before you save.",
        then: "It writes a real sample from your brief. Nothing is saved, so you can try the brief three different ways.",
      },
      {
        do: "When the voice is right, press “Create it”.",
        then: "From then on it writes at the time you set, and the draft appears on Today.",
      },
      {
        do: "To see one immediately, press “Write one now” on the schedule.",
        then: "Same code as the real run — a test button that ran different code would prove nothing.",
      },
    ],
    footnote:
      "⚠️ “Post it without asking me” is off by default, and is the owner tier. Leave it off until you have read a few weeks of drafts.",
  },

  compose: {
    title: "Writing one yourself",
    steps: [
      {
        do: "Pick the language and the channels.",
        then: "Every language is open here, because you are the one reading it.",
      },
      { do: "Say what the post is about in a few words — that goes in the register so it is never reused." },
      {
        do: "Write the post. The counters under the box track characters, emoji, hashtags and links.",
        then: "The house style is no emoji, at most two hashtags, one link.",
      },
      {
        do: "Choose whether it waits in the queue or is approved now.",
        then: "Approving does not publish it — there is no channel adapter yet.",
      },
      { do: "Press Save. The same word check runs on your words as on a written one." },
    ],
    footnote:
      "🔑 Use this for the posts that matter: a launch, a thank-you, an apology, something in the news. Those should never be generated.",
  },

  channels: {
    title: "Connecting somewhere to post",
    steps: [
      {
        do: "Read the row for the channel you want — it says what is blocking it.",
        then: "The reasons differ. Facebook needs fifteen minutes from you; LinkedIn is waiting on LinkedIn.",
      },
      {
        do: "Get a token from the platform. The form tells you exactly where.",
        then: "For Facebook: Business settings → Users → System users → assign the Imotara Page → generate a token.",
      },
      {
        do: "Press “Connect a channel”, choose it, and paste the token.",
        then: "⛔ Never a password. A token only posts to one page, and it keeps working when you change your password.",
      },
      {
        do: "It will read “Not checked yet”.",
        then: "Saved is not the same as shown to work. A daily check emails social@imotara.com the hour one stops.",
      },
    ],
    footnote:
      "⛔ Connecting a channel does not make posting work yet — the code that sends to each platform is the next piece of work.",
  },

  languages: {
    title: "What the two ticks mean",
    steps: [
      {
        do: "Read the table: every language can be written and queued, in all 22.",
        then: "The columns only decide whether a schedule may post in it without you reading it first.",
      },
      {
        do: "“Someone reads it” means a person here could tell a good draft from a bad one.",
        then: "Without that, a post that sounded like a translation would go out unseen.",
      },
      {
        do: "“Word list” means there is a vocabulary to check abuse against.",
        then: "⛔ We do not invent lists for languages nobody here reads — a wrong list reports success while checking nothing.",
      },
      {
        do: "To widen one: get a dozen words from somebody who speaks it, and press “Add words”.",
        then: "Both the native spelling and the Latin one. Abuse is typed in Latin letters at least as often.",
      },
    ],
    footnote:
      "⚠️ Both ticks are needed, not either. Bengali and Hindi pass the first and fail the second today — that is why they are two columns.",
  },
};
