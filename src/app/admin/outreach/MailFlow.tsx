"use client";

// Outreach email as a picture — the same kind of diagram the calling and
// social pages have (owner, 24 Oct 2026).
//
// ⚠️ EVERY BOX STATES A RULE THE CODE ENFORCES ⇒ lib/outreach/sequence.ts
// (consent, stop conditions, day 0 / 7 / 21, daytime window) and run.ts (the
// 10-minute job, approved drafts only, the daily cap and the domain budget).
// Change a rule there and this picture is wrong until it is changed here too.

import { Arrow, Box, FlowFrame, Lane, ToneKey } from "@/app/admin/_components/flow";

export function MailFlow({ on, auto, cap }: { on: boolean; auto: boolean; cap: number }) {
  return (
    <FlowFrame title="How an outreach email goes out — the whole path">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <Box tone="step" title="1 · The sheet: one row per person">
          Name, organisation, the tab (NGO, Education, Eldercare, Corporate, Individual), an <b>email</b> and a{" "}
          <b>consent note</b>. No consent note, no email — the same rule as calls.
        </Box>
        <Arrow side />
        <Box tone="person" title="2 · Emails tab: approve the drafts">
          One draft per audience and email, written for you from checked facts only. Read it, edit it, “Send me a test”,
          then Approve. {auto ? "Send-without-asking is ON: a draft that passes every check goes without you." : "Nothing unapproved is ever sent."}
        </Box>
      </div>

      <Arrow label="3 · every 10 minutes, at the date and time set in the sheet" />

      <Box tone="gate" title="Outreach email ON, and within today's limit?">
        <b className={on ? "text-emerald-300" : "text-red-300"}>Right now it is {on ? "ON" : "OFF"}.</b> At most {cap} a day
        here, and never more than the domain&rsquo;s warm-up allows — so imotara.com stays out of spam folders. Only rows with
        yes in “Send emails?” and a “First email date” + “First email time” — at that time, any hour, in the row&rsquo;s “Time zone”.
      </Box>

      <Arrow label="what each person gets" />

      <div className="flex flex-col gap-3 md:flex-row">
        <Lane title="The sequence">
          <div className="grid grid-cols-3 gap-2">
            <Box tone="good" title="Your date · Introduction" />
            <Box tone="good" title="+7 days · Follow-up">Same time of day</Box>
            <Box tone="good" title="+21 days · Last note">Same time of day</Box>
          </div>
        </Lane>
        <Lane title="Linked to calls">
          <Box tone="good" title="A call ends “send me details”">The details email goes next, then the sequence stops.</Box>
        </Lane>
      </div>

      <Arrow label="4 · it stops by itself when" />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Box tone="stop" title="Unsubscribed">One click in every email; never emailed again.</Box>
        <Box tone="stop" title="Bounced or marked spam">The address goes on the do-not-email list.</Box>
        <Box tone="stop" title="A call said no">Not interested, do not call, wrong number.</Box>
        <Box tone="person" title="Meeting booked · safety">A person takes over; no automatic email.</Box>
      </div>

      <ToneKey />
    </FlowFrame>
  );
}
