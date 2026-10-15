// src/lib/broadcast/templates/eldercare.ts
// ⚠️ SALES OUTREACH, not a newsletter — see ORGANISATIONAL in ./types.ts
//
// ⚠️ TONE NOTE. Residents are adults with full lives behind them. Nothing here
// may read as though they are a problem to be managed, and nothing may promise
// to replace human visiting — the offer is company in the hours between, not
// instead of.

import { SITE, type Template } from "./types";

export const ELDERCARE: Template[] = [
    {
        id: "eldercare-between-visits",
        audience: "eldercare",
        title: "The hours between visits",
        note: "Strongest opener. Careful not to promise to replace family.",
        subject: "The hours between visits",
        body: `Hello {{name|there}},

The difficult part of residential life is rarely the day itself. Days have structure — meals, medication, activities. It's the long stretch between a Sunday visit and the next one.

Nothing substitutes for family, and I wouldn't suggest otherwise. But the hours in between are real, and residents often fill them with television because the alternative is sitting with their own thoughts.

Imotara is something a resident can talk to — in their own language, including by voice if typing is difficult. Not a replacement for anyone. Company in the gaps.

More: ${SITE}

How do your residents usually spend the long afternoons?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-mother-tongue",
        audience: "eldercare",
        title: "Residents who speak only their mother tongue",
        note: "Very specific; resonates strongly with Indian homes.",
        subject: "Residents who are most themselves in their first language",
        body: `Hello {{name|there}},

Many older residents are entirely comfortable in Bengali, Tamil, Marathi or Hindi, and manage in English only with effort. As people age that effort grows, and English-language provision quietly stops reaching them.

Imotara understands 22 languages and replies in whichever one the person used. For a resident who hasn't had a long conversation in their own language since the last family visit, that is not a small thing.

More: ${SITE}

Which languages are spoken among your residents?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-staff",
        audience: "eldercare",
        title: "Staff who carry it home",
        note: "Leads with the carers rather than residents.",
        subject: "A question about your staff",
        body: `Hello {{name|there}},

Care staff form real attachments to residents and then, with some regularity, lose them. There is rarely space in a shift to feel that, and rarely anyone at home who fully understands it.

Grief that has nowhere to go is a large part of why good carers leave the profession.

Imotara is private, available after a shift ends, and works in the language a carer speaks at home. It asks nothing of a supervisor already short-staffed.

More: ${SITE}

What does your home currently offer staff after a resident dies?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-simple-to-use",
        audience: "eldercare",
        title: "Simple enough to actually be used",
        note: "Answers the obvious practical objection.",
        subject: "Whether residents could actually use it",
        body: `Hello {{name|there}},

The fair objection first: a lot of technology aimed at older adults is designed by people who have never watched an eighty-year-old use a phone.

What helps in practice:
- Speaking rather than typing, which removes the main barrier
- Replies read aloud
- No account required to begin
- Nothing to lose track of between sessions

It won't suit every resident. For those with the dexterity and inclination, it works without a member of staff sitting beside them.

More: ${SITE}

How comfortable are your residents with phones and tablets generally?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-distant-families",
        audience: "eldercare",
        title: "Families far away",
        note: "For homes with many NRI or out-of-state families.",
        subject: "When the family is in another country",
        body: `Hello {{name|there}},

Homes with residents whose children live abroad know the particular shape of it: a devoted weekly video call, timed across zones, in which the resident reports that everything is fine.

They're not lying. It's that a short call isn't where you raise the thing that's been bothering you for a fortnight, and they don't want to worry anyone.

Something available between calls, in their own language, gives that thought somewhere to go.

More: ${SITE}

How many of your residents have family outside the country?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-evenings",
        audience: "eldercare",
        title: "Evenings, when staffing is thinnest",
        note: "Operationally specific.",
        subject: "The hours when your staffing is thinnest",
        body: `Hello {{name|there}},

Most homes are well staffed through the day and run lean in the evening. That is usually when residents are most awake to their own situation — after activities have finished and before sleep comes.

A resident who would like to talk at nine in the evening is weighing it against interrupting a nurse who is plainly busy. Most decide not to.

More: ${SITE}

When do your residents most often seem to want company?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-dignity",
        audience: "eldercare",
        title: "Dignity, not monitoring",
        note: "Important with families who want oversight.",
        subject: "Company, not monitoring",
        body: `Hello {{name|there}},

Families sometimes ask whether they could see what a resident has been saying. The answer is no, and I'd rather be clear about it at the start.

A resident's conversations are their own. The home sees that licences are in use; it does not see anyone's words, and neither do their children.

Adults do not stop being entitled to a private thought on entering residential care. If a family needs oversight, this is the wrong product for them.

More: ${SITE}

Would that position be difficult with your families?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-pilot",
        audience: "eldercare",
        title: "Proposing a pilot on one floor",
        note: "Use after a positive exchange.",
        subject: "One floor, a few months",
        body: `Hello {{name|there}},

Rather than a decision for the whole home, could we try one floor or wing for a few months?

We help you set it up, residents use it or they don't, and you'll know from your own staff whether it was worth anything. If only two residents take to it, that is still an honest answer and an inexpensive way to find out.

Background: ${SITE}

Is there a floor where this would be worth trying — and who would need to agree?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-cost",
        audience: "eldercare",
        title: "What it costs",
        note: "Send when asked. Acknowledges that homes run tight.",
        subject: "What it would cost your home",
        body: `Hello {{name|there}},

Plainly, since residential homes run on tight margins and vague answers waste your time.

- Licences are per seat, a year at a time
- Conversations are never metered
- Our non-profit rate is genuinely different from the corporate one
- A pilot on one floor costs a fraction of covering the home

We won't quote a number before knowing how many residents would be in scope, because an honest figure depends on it.

More: ${SITE}

Roughly how many residents do you have?

— Suchismita Sen, Imotara`,
    },
    {
        id: "eldercare-follow-up",
        audience: "eldercare",
        title: "Follow-up when there's been no reply",
        note: "⚠️ Once only. No answer means stop.",
        subject: "A last note about your residents",
        body: `Hello {{name|there}},

I wrote a while ago about company for your residents and support for your staff, and haven't heard back — which I take to mean you have more pressing things, as homes generally do.

I won't keep writing.

One thought worth leaving behind regardless: if you do look at anything in this area, check first whether it works in the language your residents actually speak at home. Most of it doesn't, and that is usually why it goes unused.

If it becomes useful: ${SITE}

Is there someone else I should be speaking to about it?

— Suchismita Sen, Imotara`,
    },
];
