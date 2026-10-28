"use client";

// The five social screens' walkthroughs.
//
// ⚠️ The PANEL lives in src/app/admin/_components/PageTutorial.tsx — every
// admin screen uses it now. Only the steps are social's own. Re-exported here
// so the five pages' existing imports keep working.

import { PageTutorial, type Step } from "@/app/admin/_components/PageTutorial";

export { PageTutorial };
export type { Step };

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
        then: "Drafts appear up to ten days before a schedule's time, so there is room to read them.",
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
      // ⚠️ Phrased so it stays TRUE as channels come online. The version
      // that named the state ("no channel is connected") was false within a
      // day ⇒ publishingSentence, which the live screens derive instead.
      "Approving is not posting. An approved post goes out at its scheduled time, on a channel that is connected and checked — and nothing goes out at all while posting is paused.",
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
        then: "Approving marks it ready. It goes out at its scheduled time, on a connected channel.",
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
        then: "The reasons differ — an expired token, a missing permission, a Page not assigned. The row names the one that applies.",
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
      "⚠️ Connecting a channel is not the same as it working. The row says “Not checked yet” until something has asked the platform — press “Check it now” and it will tell you.",
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
