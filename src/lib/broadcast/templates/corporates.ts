// src/lib/broadcast/templates/corporates.ts
// ⚠️ SALES OUTREACH, not a newsletter — see ORGANISATIONAL in ./types.ts

import { SITE, type Template } from "./types";

export const CORPORATES: Template[] = [
    {
        id: "corporates-unused-eap",
        audience: "corporates",
        title: "The EAP nobody uses",
        note: "Strongest opener. Names the thing HR already knows.",
        subject: "A question about your EAP utilisation",
        body: `Hello {{name|there}},

Most organisations with an Employee Assistance Programme have a number they don't put on slides: utilisation. It is frequently in low single digits.

The programme isn't usually bad. The barrier is that using it means ringing a number, giving your name, and booking something during working hours — three visible acts for a problem you're not sure qualifies yet.

Imotara sits before that step. It's a private companion on someone's own phone, in 22 languages, with nothing to book and nobody to tell. Not therapy, and we're careful never to say otherwise.

More: ${SITE}

What is your current EAP utilisation, if you track it?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-manager-checkins",
        audience: "corporates",
        title: "Check-ins that aren't surveillance",
        note: "For organisations considering wellbeing analytics.",
        subject: "Wellbeing data your people won't resent",
        body: `Hello {{name|there}},

A good deal of workplace wellbeing technology is really monitoring with a kinder name, and employees work this out quickly. Once they do, the data becomes worthless — people answer the pulse survey the way they think they should.

Our position: the employer sees that licences are used. It does not see who said what, and conversations are not an administrative view we offer.

That makes some dashboards impossible. We think it's the right trade, and we'd rather say so before a procurement conversation than after.

More: ${SITE}

What does your leadership currently expect to see from a wellbeing programme?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-shift-and-remote",
        audience: "corporates",
        title: "Night shifts and distributed teams",
        note: "For BPOs, support centres, manufacturing, remote-first firms.",
        subject: "Support for the people working at 3am",
        body: `Hello {{name|there}},

Workplace wellbeing provision tends to run roughly nine to six. A large part of many workforces does not.

Night shift staff, support teams covering other time zones, and remote employees several hours from head office all share a problem: the help exists, but not when they're awake, and not in a form they can use quietly.

Imotara is available at 3am, on their own phone, in their own language.

More: ${SITE}

What proportion of your workforce works outside standard hours?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-return-from-leave",
        audience: "corporates",
        title: "Returning from leave",
        note: "Specific, human, converts well.",
        subject: "The first fortnight back",
        body: `Hello {{name|there}},

Someone returning from extended leave — bereavement, illness, a new child — is usually met with a well-meant conversation on the first morning and then nothing.

The difficulty rarely lands in week one. It lands in week three, when everyone else has moved on and asking for help feels like admitting the leave didn't work.

Something private, needing no appointment and no explanation, fits that fortnight well.

More: ${SITE}

What does your organisation currently do for people in their first month back?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-cost",
        audience: "corporates",
        title: "What it costs",
        note: "Send when asked. Does not pretend to replace counselling.",
        subject: "What a seat actually costs",
        body: `Hello {{name|there}},

Plainly, since you asked.

- Licences are per seat, bought a year at a time
- Conversations are never metered — nobody is cut off mid-sentence
- A pilot for one team is normal, and we'd rather start there

One thing we won't claim: that this replaces counselling sessions, or that you can bank the difference. It doesn't do the same job. What it does is make the support you already fund more likely to be reached, and give people something on the days where a session isn't warranted.

More: ${SITE}

How many people would be in scope — a team, a site, or the whole organisation?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-privacy",
        audience: "corporates",
        title: "What the employer never sees",
        note: "Send to the people who must sign off.",
        subject: "What you would never be able to see",
        body: `Hello {{name|there}},

Worth stating early, because it's the question your employees will ask each other.

An employer never sees an individual's conversations. Not in a report, not on request, not for an investigation — it is not a view that exists on the administrative side.

If your organisation needs individual-level visibility for a legitimate reason, we are the wrong supplier and I'd rather say so now than three meetings in.

More: ${SITE}

Does your organisation have any requirement that would conflict with that?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-multilingual-workforce",
        audience: "corporates",
        title: "A workforce that doesn't share one language",
        note: "For organisations with factory, field or multi-state staff.",
        subject: "Support in the language people go home in",
        body: `Hello {{name|there}},

Wellbeing provision in most Indian organisations is delivered in English. A sizeable part of the workforce operates in English professionally and in another language emotionally.

Asking someone to describe something painful in their second language, to a stranger, during work hours, is asking a lot. Most decline politely.

Imotara works in 22 languages and replies in the one the person wrote in, including Roman script.

More: ${SITE}

How many languages are spoken across your sites?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-pilot",
        audience: "corporates",
        title: "Proposing a pilot with one team",
        note: "Use after a positive exchange.",
        subject: "One team, one quarter",
        body: `Hello {{name|there}},

Rather than an organisation-wide decision, could we try one team for a quarter?

We set it up, people use it or they don't, and at the end you have your own numbers rather than our claims. Low uptake is a real result and better discovered at small scale.

Background: ${SITE}

Is there a team where this would be worth trying — and who else would need to be in that conversation?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-attrition",
        audience: "corporates",
        title: "The conversation before the resignation",
        note: "For HR leaders focused on retention.",
        subject: "The months before someone resigns",
        body: `Hello {{name|there}},

By the time someone resigns, the decision is usually months old. The exit interview captures the reasons after they've hardened into a story, which is why exit interviews so rarely change anything.

The useful period is earlier — when someone is still working out whether the problem is the job, the manager, or something in their life that has nothing to do with work.

That is exactly the period in which people talk to nobody at work.

More: ${SITE}

What does your organisation learn in exit interviews that it wishes it had known six months earlier?

— Suchismita Sen, Imotara`,
    },
    {
        id: "corporates-follow-up",
        audience: "corporates",
        title: "Follow-up when there's been no reply",
        note: "⚠️ Once only. No answer means stop.",
        subject: "A last note, then I will stop",
        body: `Hello {{name|there}},

I wrote a while back about wellbeing support for your teams and haven't heard back, which I take to mean the timing is wrong rather than the idea.

I won't keep writing.

One thing worth leaving behind: whatever you use, check whether an employee can reach it without anyone at work knowing. That single property predicts utilisation better than any feature comparison we've seen — and it's usually what the low numbers are really telling you.

If it becomes relevant: ${SITE}

Does this sit with someone else I should be approaching?

— Suchismita Sen, Imotara`,
    },
];
