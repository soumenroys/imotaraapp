// src/lib/broadcast/templates/ngos.ts
// ⚠️ SALES OUTREACH, not a newsletter. Send one-to-one to a named person —
// see the ORGANISATIONAL note in ./types.ts for the measured reason why.

import { SITE, type Template } from "./types";

export const NGOS: Template[] = [
    {
        id: "ngos-staff-burnout",
        audience: "ngos",
        title: "The staff burnout nobody budgets for",
        note: "Strong opener. Leads with the team, not the beneficiaries.",
        subject: "A question about your team, not your beneficiaries",
        body: `Hello {{name|there}},

Most conversations about wellbeing in an NGO are about the people you serve. I wanted to ask about the people doing the serving.

Field staff and counsellors absorb a great deal and are usually the last to be offered anything themselves. The budget line for beneficiary support exists; the one for staff rarely does.

Imotara is a private, emotion-aware companion — someone to think out loud with, in 22 Indian and international languages, at whatever hour the day finally ends. Not therapy, and we are careful never to claim otherwise.

Some organisations give it to their field teams precisely because it asks nothing of an already-stretched supervisor.

A little more: ${SITE}

Would it be useful if I sent one page on how other organisations have set this up — or is staff wellbeing already covered for you?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-beneficiary-language",
        audience: "ngos",
        title: "Supporting people in their own language",
        note: "For organisations working across linguistic regions.",
        subject: "Support in the language people actually think in",
        body: `Hello {{name|there}},

Organisations working across several states run into the same wall: the counselling capacity sits in one or two languages, and the need does not.

Imotara understands 22 languages — Bengali, Hindi, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu and others — and replies in the one the person wrote in, including Roman script.

It is not a substitute for your counsellors. It is something that exists in the gaps between them: late evenings, waiting periods, and the places where a trained person simply isn't within reach.

More detail: ${SITE}

Which languages does your work reach that your support capacity doesn't?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-between-sessions",
        audience: "ngos",
        title: "The gap between sessions",
        note: "For organisations that already run counselling.",
        subject: "What happens between the sessions you already run",
        body: `Hello {{name|there}},

If your organisation already provides counselling, the weakness is rarely the sessions. It is the fortnight between them.

A difficult Tuesday doesn't wait for the appointment. By the time it comes round, the person has either moved past it or buried it, and the session is spent on reconstruction.

Imotara gives people somewhere to put the Tuesday down when it happens — in their own language, privately — so the next session starts from something real rather than a half-remembered summary.

It does not diagnose, and it never replaces the counsellor.

More: ${SITE}

How long is the typical gap between sessions in your programme?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-pricing",
        audience: "ngos",
        title: "What it costs",
        note: "Send when asked, or as a follow-up to interest.",
        subject: "The costs, plainly",
        body: `Hello {{name|there}},

You asked what this costs, so here it is without the sales layer.

- Licences are bought by the seat, a year at a time
- Conversations are never metered — nobody is cut off mid-sentence because a quota ran out
- Non-profit pricing is genuinely different from our corporate rate, and we will say so in writing
- A pilot for one team, rather than the whole organisation, is normal and we encourage it

What we won't do is quote a figure before understanding the size and shape of your team, because the honest answer depends on it.

Background: ${SITE}

Roughly how many people would be in scope — a team, a region, or everyone?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-lone-field-staff",
        audience: "ngos",
        title: "Staff who work alone",
        note: "For field-heavy organisations.",
        subject: "The people on your team who work alone",
        body: `Hello {{name|there}},

Office-based staff decompress without noticing — a conversation at a desk, a shared complaint over tea. Field staff posted alone get none of that, and they are usually the ones seeing the hardest things.

By the time someone asks for help they've often been struggling for months.

Imotara is available on a phone, works in the language they speak at home, and doesn't require them to declare to a supervisor that they're finding it hard. For a lot of field workers, that last point is the whole barrier.

More: ${SITE}

How many of your team are posted somewhere without colleagues nearby?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-measuring-without-surveillance",
        audience: "ngos",
        title: "Knowing it helps, without surveillance",
        note: "Addresses the reporting-vs-privacy tension head on.",
        subject: "Reporting on wellbeing without reading anyone's words",
        body: `Hello {{name|there}},

Funders ask whether wellbeing support worked. Staff will only use something they're certain their manager cannot read. Both are reasonable, and most tools resolve it by quietly siding with the funder.

Our position: an organisation sees that its licences are being used. It does not see who said what, and it never sees anyone's conversations. Individual content is not an administrative view we offer at all.

That makes some reporting impossible. We think it is the right trade, and we would rather tell you now than after your team stops trusting it.

More: ${SITE}

What does your funder actually require you to evidence?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-volunteers",
        audience: "ngos",
        title: "Volunteers who quietly stop coming",
        note: "For volunteer-led organisations.",
        subject: "Volunteers rarely resign — they just stop coming",
        body: `Hello {{name|there}},

Volunteer attrition is usually invisible until it has happened. Few people announce they're stopping. They miss one week, then another, and the reason — that it had begun to weigh on them — never gets said out loud.

Part of it is that a volunteer feels less entitled to support than paid staff. They weren't being paid, so what is there to complain about?

Giving volunteers something private to use costs little and removes that calculation entirely.

More: ${SITE}

Do you have a sense of why volunteers drift away from your programme?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-after-deployment",
        audience: "ngos",
        title: "After a difficult deployment",
        note: "For disaster-response and crisis-facing organisations.",
        subject: "The weeks after the deployment ends",
        body: `Hello {{name|there}},

Teams returning from a difficult deployment are usually given a debrief and then, quite quickly, the next piece of work. The difficulty tends not to arrive on schedule — it surfaces weeks later, at home, often to someone who wasn't there.

A structured debrief can't be available at 11pm three weeks afterwards. Something private can.

Imotara won't do what a trained trauma specialist does, and if someone needs that, it points them towards it rather than holding on to them.

More: ${SITE}

What does your organisation currently offer teams in the weeks after they return?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-pilot",
        audience: "ngos",
        title: "Proposing a small pilot",
        note: "Use after a positive first exchange.",
        subject: "A small pilot rather than a decision",
        body: `Hello {{name|there}},

Rather than ask your organisation to evaluate a platform, could we try something smaller?

One team. A fixed period. We set it up, your people use it or they don't, and at the end you have evidence instead of a brochure.

If it isn't useful, that is a genuinely acceptable outcome and we'd rather find out on a small scale. If it is, you'll know from your own staff rather than from me.

Background, if useful: ${SITE}

Is there one team where this would be worth trying — and who should I be talking to about it?

— Suchismita Sen, Imotara`,
    },
    {
        id: "ngos-follow-up",
        audience: "ngos",
        title: "Follow-up when there's been no reply",
        note: "⚠️ Once only. If there's no answer to this, stop.",
        subject: "Closing the loop",
        body: `Hello {{name|there}},

I wrote a little while ago about wellbeing support for your team and haven't heard back — which is a perfectly reasonable answer, and usually means the timing is wrong rather than the idea.

I won't keep writing. If it becomes relevant later, we're easy to find.

One thing worth leaving behind regardless: whatever you use, make sure your field staff can reach it in the language they speak at home. That single detail changes uptake more than anything else we've seen.

If it's ever useful: ${SITE}

Is there someone better placed for this that I should be writing to instead?

— Suchismita Sen, Imotara`,
    },
];
