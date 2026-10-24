// A short walkthrough for every admin screen.
//
// 🔴 THE OWNER: "Add small step by step tutorial in all pages." The social
// screens had one and the rest of the panel did not, which is backwards —
// licences and organisations are where a wrong click costs somebody money or
// access, and they were the screens with no instructions at all.
//
// ⚠️ STEPS, NOT A DESCRIPTION. "This page manages licences" tells a reader
// what they can already see. "Search the email, open the row, change the tier,
// and the change is logged" tells them what to do and what will happen. Each
// one ends by saying where the consequence shows up.
//
// ⛔ Kept short on purpose. The channels screen in the social scheduler once
// ran to 1,800 words, of which 750 were the same paragraph nineteen times, and
// the result was that nobody read any of it.

import type { Step } from "@/app/admin/_components/PageTutorial";

export type Tutorial = { title: string; steps: Step[]; footnote?: string };

export const ADMIN_TUTORIALS: Record<string, Tutorial> = {
  todo: {
    title: "What is waiting for you",
    steps: [
      { do: "Start with Do now, then Today.", then: "Safety calls, broken channels and stopped sends come first." },
      { do: "Press the blue button on an item to go straight to where you act on it.", then: "Approve the draft, retry the post, review the application." },
      { do: "Come back: items the system can see finished leave the list by themselves.", then: "A draft approved or a post retried disappears on Refresh." },
      { do: "For work done outside the system — a call made, a meeting held — press Mark done.", then: "It moves to Done in the last 24 hours, with who and when. Undo is there if it was a mistake." },
    ],
    footnote: "If a part of the panel could not be checked, the page says so — an empty list never hides a failure.",
  },
  comments: {
    title: "Moderating blog comments",
    steps: [
      {
        do: "Press a tile — Pending, Approved or Total — to show that list.",
        then: "The tiles are the filter. Pending is what needs you.",
      },
      {
        do: "Read the comment, then Approve it or Delete it.",
        then: "Approving publishes it under the post. Nothing appears on the site until you do.",
      },
      {
        do: "Deleting is permanent and there is no undo.",
        then: "If you are unsure, leave it pending — an unapproved comment is already invisible to readers.",
      },
    ],
    footnote: "⚠️ A comment is a stranger writing in public under Imotara's name. Read it as a reader would.",
  },

  licenses: {
    title: "Changing what somebody has",
    steps: [
      { do: "Search the person's email address.", then: "Exact or partial — it matches on the address, not the name." },
      {
        do: "Open their row to see the tier they are on and how they got it.",
        then: "A tier can come from a purchase, an organisation's pool, or a grant made here.",
      },
      {
        do: "Change the tier only when you know why.",
        then: "A store purchase has its own expiry and the store is the authority on it — overriding a paid tier here does not refund anybody.",
      },
      { do: "Check the history below the row.", then: "Every change is recorded with who made it and when. That record is the reason the panel is trusted." },
    ],
    footnote: "🔑 Nothing here charges or refunds money. It changes what the app allows.",
  },

  organizations: {
    title: "Running an organisation's account",
    steps: [
      { do: "Pick the organisation from the list.", then: "Its status, billing type, seats and tier are at the top." },
      {
        do: "Members shows who is in it; Pools shows the licences it holds.",
        then: "A pool licence is one the organisation bought and can hand to a member. Issued minus assigned is what is left.",
      },
      {
        do: "Verification is where a new organisation is approved or refused.",
        then: "Until it passes, its members cannot use what the organisation paid for.",
      },
      { do: "The audit log lists every change anybody made to this organisation.", then: "Read it before you change something you did not set up yourself." },
    ],
    footnote: "⛔ The danger zone at the bottom suspends or removes an organisation. It affects every one of its members at once.",
  },

  connect: {
    title: "Reviewing Connect people",
    steps: [
      { do: "Open an application and read it in full before deciding.", then: "These are peer companions, never clinicians — the listing must not claim otherwise." },
      {
        do: "Check the languages, the rate and the written introduction.",
        then: "The introduction is what a person in a bad hour will read first.",
      },
      { do: "Approve or decline.", then: "Approving makes them visible and bookable. Declining does not delete the application." },
    ],
    footnote: "⚠️ A listing that reads as clinical is the single most expensive mistake this panel can make. If in doubt, decline and ask.",
  },

  superadmins: {
    title: "Who can get in here",
    steps: [
      { do: "Each row is a person with access to this panel.", then: "Owner sees and does everything. Admin is everything except the owner-only actions. Connect reviewer sees only Connect and Comments." },
      { do: "Add somebody by email, with a strong password.", then: "The strength meter has to be satisfied — a weak admin password is the whole panel." },
      { do: "Deactivate rather than delete when somebody leaves.", then: "Deactivating keeps their name on everything they did; deleting orphans the record." },
    ],
    footnote:
      "🔐 Adding an owner gives away everything, including the ability to remove you — there is no higher level to appeal to. " +
      "⚠️ Turn two-factor on and sign-in will ask you for a code. Save the eight backup codes somewhere that is not the phone holding the app.",
  },

  broadcast: {
    title: "Sending email to the list",
    steps: [
      { do: "Choose a template, then read it end to end as the recipient.", then: "The house style is deliberate: no images, no buttons, at most one link." },
      { do: "Send yourself a test first, every time.", then: "There is no recall. A broadcast is in somebody's inbox the moment it leaves." },
      { do: "On the review screen, read it and press Approve.", then: "Nothing is sent or scheduled unapproved; editing it later asks for approval again." },
      { do: "Send now or pick a time, then watch the delivery figures.", then: "Bounces matter more than opens — a rising bounce rate costs the domain its reputation." },
    ],
    footnote: "⛔ Owner only. The Automatic tab writes a monthly newsletter for your approval. Outreach emails appear here too.",
  },

  stats: {
    title: "Reading the dashboard",
    steps: [
      { do: "The four tiles are the organisation side of the business.", then: "Pool licences are what organisations bought; assigned is what their members are actually using." },
      {
        do: "Issued minus assigned is money already paid for and not yet used.",
        then: "A large gap is worth a conversation with that organisation, not a worry.",
      },
      { do: "The per-organisation table breaks the same numbers down.", then: "Seats purchased against members tells you who is about to run out." },
      { do: "For people rather than organisations, go to Activity.", then: "This screen counts accounts and licences; Activity counts usage." },
    ],
  },

  analytics: {
    title: "Reading Activity",
    steps: [
      { do: "Pick a window — 7, 30 or 90 days.", then: "Everything below changes with it, including the insights." },
      {
        do: "Read the insights first; they say what the numbers mean and what to do.",
        then: "Each one shows the figure it came from, so you can disagree with it.",
      },
      { do: "Then the charts: daily activity, where it happened, what people did.", then: "Shape matters more than any single day — one quiet Sunday is not a trend." },
      {
        do: "“Do they come back?” is the question that matters most.",
        then: "Each row is the people who first appeared on that day. A dash means that group is not old enough to answer yet.",
      },
    ],
    footnote:
      "⚠️ usage_events records costly things — a cloud reply, a spoken reply, a transcription. It is not a clickstream: it cannot tell you where somebody came from or what they tapped.",
  },

  crisis: {
    title: "What this screen is for",
    steps: [
      { do: "Each row is a moment the crisis card was shown to somebody.", then: "It records that it happened and where — never what was written." },
      { do: "Check that the right country's helpline was offered.", then: "A wrong or missing number is the most urgent bug in the product, and this is where it shows." },
      { do: "A rising count is not necessarily bad.", then: "It can mean detection improved. Compare it with Activity before reading anything into it." },
    ],
    footnote: "🔑 No message text is stored or shown here, ever. That is a deliberate limit, not a gap.",
  },

  voice: {
    title: "Calling contacts — now, on schedule, and reading every call back",
    steps: [
      { do: "Settings tab: switch Calling ON when you are ready.", then: "While it is OFF nothing rings — not by hand, not on schedule, not automatically. Individuals stay paused until you allow them." },
      { do: "Contacts tab: deal with 'Needs a person' first.", then: "Safety calls, failed dials, meetings, send-info and missed schedules wait for you there." },
      { do: "Find people with search and filters, or + Add a contact (a consent note is required).", then: "Only a green OK can be called; anything else says what to fix." },
      { do: "Press 📞 on a row, or tick several and press Call now.", then: "What fits in a free line rings at once, the rest is queued — always inside 10:00–18:00 their time." },
      { do: "Or tick contacts, pick a time (yours) and press Schedule.", then: "A time outside their hours is refused; one missed by over 2 hours is not called." },
      { do: "Call records tab: open any call.", then: "Summary, next action, the recording and the full transcript. Safety flags are pinned in red — call those people back yourself today." },
      { do: "Reports tab: pick 7, 30 or 90 days.", then: "Calls, connection rate, outcomes, safety flags, cost, and breakdowns." },
    ],
    footnote: "⛔ Every call is the same rule set: consent note, do-not-call list, language started, calling hours, the daily cap. Results are written back into the sheet, and safety/meeting/send-info alerts are emailed at once.",
  },
  outreach: {
    title: "Emailing contacts from the sheet — automatically",
    steps: [
      { do: "Type each person's email in the sheet's email column, with a consent note.", then: "Only rows with a consent note are emailed — the same rule as calls." },
      { do: "Emails tab: read each draft, edit if needed, press Approve.", then: "Drafts are written for you per audience. Nothing unapproved is sent." },
      { do: "Press “Send me a test” to see it in your own inbox first.", then: "It goes only to you." },
      { do: "Settings tab: switch Outreach email ON and set emails per day.", then: "Every 10 minutes it sends what is due, in their daytime: intro, day 7, day 21." },
      { do: "Contacts tab: see who got what and who is next.", then: "Unsubscribe, bounce, 'not interested' or a meeting stops the sequence." },
    ],
    footnote: "⛔ The daily limit protects imotara.com's mail reputation, which app mail and receipts depend on.",
  },
};
