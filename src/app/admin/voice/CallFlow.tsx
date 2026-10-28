"use client";

// The calling console as a picture: from the master switch, through Call now or
// Schedule, to the call and what each result leads to.
//
// 🔑 WHY A DIAGRAM AS WELL AS THE TUTORIAL. The tutorial is the order of the
// clicks; this is the shape of the decisions — where a call can be refused, where
// it waits, and who acts afterwards. The owner asked for it (24 Oct 2026) so an
// admin can see the whole path before pressing anything.
//
// ⚠️ EVERY BOX STATES A RULE THE CODE ENFORCES ⇒ src/lib/voice/rules.ts and
// dispatch.ts (the sheet's call_date/call_time, any hour; contact_by_phone = yes;
// the 5-minute job; 2-hour grace for a schedule; 3 tries for no answer, inside
// the retry hours). Change a
// rule there and this picture is wrong until it is changed here too.

import { Arrow, Box, FlowFrame, Lane, ToneKey } from "@/app/admin/_components/flow";

export function CallFlow({ callingOn, autoOn }: { callingOn: boolean; autoOn: boolean }) {
  return (
    <FlowFrame title="How a call works — the whole path">
        {/* 1 — the gate */}
        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Box tone="gate" title="1 · Settings: Calling ON">
            The master switch. While it is OFF, nothing rings — by hand, on schedule, or automatically.{" "}
            <b className={callingOn ? "text-emerald-300" : "text-red-300"}>Right now it is {callingOn ? "ON" : "OFF"}.</b>
          </Box>
          <Arrow side />
          <Box tone="step" title="2 · The sheet: yes in contact_by_phone, and a call_date + call_time">
            Plus a consent note, not on do-not-call, their language started. In call_time_zone (or the row&rsquo;s time zone);
            the call service rings only 09:00–21:00 their time and holds anything else till 09:00. No date = no call.
          </Box>
        </div>

        <Arrow label="at that time it rings by itself — or, from this page, choose one" />

        {/* 3 — two ways */}
        <div className="flex flex-col gap-3 md:flex-row">
          <Lane title="3 · 📞 Call now">
            <Box tone="step" title="Is a line free?">Limits: lines at once, and calls per 24 hours. Any hour — you chose it.</Box>
            <div className="grid grid-cols-2 gap-2">
              <Box tone="good" title="Free → rings now" />
              <Box tone="wait" title="Busy → Queued">Rings at the next free line; checked every 5 minutes.</Box>
            </div>
          </Lane>

          <Lane title="3 · 🗓 Or schedule (a time in your time zone)">
            <Box tone="wait" title="Scheduled">Any hour. Listed on the Scheduled tab; Cancel takes it off.</Box>
            <div className="grid grid-cols-2 gap-2">
              <Box tone="good" title="At that time → rings">Within 5 minutes of the time, even with automatic calling off.</Box>
              <Box tone="stop" title="Over 2 hours late → missed">E.g. calling was OFF. Not called — schedule it again.</Box>
            </div>
          </Lane>
        </div>

        <Arrow label="the call" />

        {/* 4 — the call */}
        <Box tone="good" title="4 · The Imotara agent calls in their language">
          It says up front that it is a virtual assistant. When the call ends, the result is written into the sheet, and
          the recording, transcript and summary appear on the Call records tab.
        </Box>

        <Arrow label="5 · what happens next depends on the result" />

        {/* 5 — results */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Box tone="person" title="🔴 Safety · meeting · send info">
            Emailed to the team at once, and listed under <b>Needs a person</b>. Safety: call them yourself today — never
            auto-called again.
          </Box>
          <Box tone="person" title="Dial failed · needs review">
            The call service refused, or no result came back. Listed under <b>Needs a person</b>; nothing retries by itself.
          </Box>
          <Box tone="wait" title="No answer · callback · send-info follow-up">
            Called again later (no answer: up to 3 tries, a different time of day, inside the retry hours; send info: 3 days on) —{" "}
            <b className={autoOn ? "text-emerald-300" : "text-amber-300"}>
              only while Automatic is ON (now {autoOn ? "ON" : "OFF"})
            </b>
            . Otherwise call them again yourself.
          </Box>
          <Box tone="stop" title="Not interested · do not call · wrong number">
            Never called again. “Do not call” also goes on the Do-not-call tab.
          </Box>
        </div>

        <ToneKey />
    </FlowFrame>
  );
}
