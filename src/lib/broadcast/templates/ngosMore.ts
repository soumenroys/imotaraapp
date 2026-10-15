// src/lib/broadcast/templates/ngosMore.ts
// Forty further NGO angles, added 2026-10-15 to take the category to fifty.
//
// ⚠️ SALES OUTREACH, not a newsletter — send one-to-one to a named person.
// See ORGANISATIONAL in ./types.ts for the measured reason.
//
// Organised so the picker is navigable: specific staff groups, then moments in
// a conversation (objections, pilots, renewals, introductions), then endings.

import { SITE, type Template } from "./types";

const t = (
    id: string, title: string, note: string, subject: string, body: string,
): Template => ({ id: `ngos-${id}`, audience: "ngos", title, note, subject, body });

const SIGN = "— Suchismita Sen, Imotara";

export const NGOS_MORE: Template[] = [
    // ── specific staff groups ───────────────────────────────────────────────
    t("survivor-facing-staff", "Staff who work with survivors",
      "For organisations doing protection or rehabilitation work.",
      "The weight your protection team carries home",
      `Hello {{name|there}},

Staff who sit with survivors absorb the detail of what happened. Supervision covers the casework; it rarely covers what the casework does to the person doing it.

Most of them would not describe themselves as affected, because the comparison they make is with the people they serve.

Imotara is private, available after the shift, and in the language they speak at home. Not therapy — and where someone needs that, it points them towards it rather than holding on.

More: ${SITE}

What does your organisation currently offer that team?

${SIGN}`),

    t("helpline-staff", "Helpline and call-centre teams",
      "For organisations running a phone or chat line.",
      "The call that stays with your helpline staff",
      `Hello {{name|there}},

Helpline work has an unusual shape: high volume, no resolution, and no way to know what happened next. One call in fifty stays with someone for weeks.

Debriefs help and are scheduled. The call that lands at eleven at night is not.

Imotara is available then, in their own language, and asks nothing of a supervisor already covering a rota.

More: ${SITE}

How many calls does your line take in a week?

${SIGN}`),

    t("community-health-workers", "Community health workers",
      "For health-focused NGOs with frontline cadres.",
      "Your community health workers, at the end of the day",
      `Hello {{name|there}},

Community health workers are embedded in the communities they serve, which is what makes them effective and also means they never leave work.

They see outcomes their training did not prepare them for, and the nearest colleague is often a bus ride away.

Something private on the phone they already carry, in the language they actually speak, costs little and removes no one from the field.

More: ${SITE}

How many are in your cadre?

${SIGN}`),

    t("night-shelter-staff", "Night shelter and outreach staff",
      "Specific and operational.",
      "Night staff, and the hours nobody supervises",
      `Hello {{name|there}},

Night shelter and street outreach staff work the hours when management is asleep and the situations are hardest. Support designed around office hours reaches them last or not at all.

Imotara is awake at three in the morning, which is when they are.

More: ${SITE}

Do your night teams have anything available to them during their shift?

${SIGN}`),

    t("short-term-project-staff", "Staff on short project contracts",
      "Funding-cycle flavoured.",
      "Staff who know their contract ends in March",
      `Hello {{name|there}},

Project-funded staff carry the work and an end date. The last quarter of a grant is spent doing the job and quietly worrying about the next one, and it is not something you raise with the manager who cannot fix it.

Attrition in that final quarter is expensive and largely invisible until it happens.

More: ${SITE}

How much of your team is on project rather than core funding?

${SIGN}`),

    t("interns-and-young-staff", "Interns and first-job staff",
      "For organisations with a young workforce.",
      "Your youngest staff, and what they won't say",
      `Hello {{name|there}},

Someone in their first job in the sector will not tell a supervisor they are finding it heavy. They assume the discomfort is a competence problem and that admitting it costs them the reference.

So they leave instead, usually citing something else.

Something they can reach without declaring anything changes that calculation.

More: ${SITE}

How many people are in their first year with you?

${SIGN}`),

    t("supervisors-without-supervision", "Supervisors who have no supervisor",
      "Middle management angle. Converts well.",
      "Who supervises the supervisors?",
      `Hello {{name|there}},

Field staff have a supervisor. The supervisor has a director who is managing funders. The support structure thins as it goes up, and the people holding everyone else have the least held themselves.

They are also the least likely to ask, because asking looks like not coping with a job they chose.

More: ${SITE}

Who does your middle layer talk to?

${SIGN}`),

    t("founder-who-never-stops", "The founder who never stops",
      "⚠️ Personal. Send only where you have a relationship.",
      "A question I don't think anyone asks you",
      `Hello {{name|there}},

Founders in this sector tend to be asked how the organisation is, never how they are. The two get treated as the same question and they are not.

You also cannot say the discouraging version out loud to your own team, or to a funder, which leaves very few places for it.

This is not a pitch for your organisation. It is one for you.

More: ${SITE}

When did you last say the honest version to anybody?

${SIGN}`),

    t("documentation-teams", "The people who write it down",
      "Overlooked group — often resonates.",
      "The team that reads every case file",
      `Hello {{name|there}},

Documentation, M&E and communications staff read everything. They write the case studies, transcribe the interviews and check the photographs.

They did not sign up for frontline work and are not counted as frontline, so the wellbeing provision skips them entirely.

More: ${SITE}

Who handles documentation for you?

${SIGN}`),

    t("disaster-standby", "Teams on standby",
      "For response organisations between deployments.",
      "The waiting between deployments",
      `Hello {{name|there}},

Standby has its own strain: nothing is happening, you cannot plan anything, and you are braced for a call that may come tonight or in six weeks.

It does not look like a hard period from outside, which is why nobody offers anything for it.

More: ${SITE}

How long are your standby rotations?

${SIGN}`),

    // ── objections and practical questions ─────────────────────────────────
    t("we-already-have-an-eap", "\"We already have an EAP\"",
      "Objection handler. Does not disparage their provider.",
      "You have an EAP. What's the uptake?",
      `Hello {{name|there}},

If you already have an employee assistance line, the question worth asking is not whether it is good but how many people use it.

It is commonly low single digits, and rarely because the service is poor. Using it means ringing a number, giving a name and booking a slot — three visible acts for a problem you are not sure qualifies yet.

Imotara sits before that step rather than replacing it. Many people reach a human service because something lowered the bar first.

More: ${SITE}

What is your current uptake, if you track it?

${SIGN}`),

    t("isnt-this-just-an-app", "\"Isn't this just a chatbot?\"",
      "Honest objection handler.",
      "A fair question about what this actually is",
      `Hello {{name|there}},

It is a reasonable scepticism and worth answering directly rather than with adjectives.

Imotara is a private space to think out loud, in 22 languages, that remembers context and shows patterns back over time. It is not a counsellor, it does not diagnose, and it will not claim to.

What it does is remove the barriers that stop people reaching the human help you already fund: no appointment, no name, no explaining yourself to a colleague.

If it is not right for you, that is a fine answer.

More: ${SITE}

What would you need to see to judge it?

${SIGN}`),

    t("data-protection", "Where the conversations live",
      "For organisations with a procurement or DP review.",
      "Where your staff's conversations actually live",
      `Hello {{name|there}},

The question your DP review will ask, answered before you ask it.

Conversations are stored against the individual's account, not the organisation's. The organisation sees that licences are in use; it cannot see who said what, and individual content is not an administrative view we offer to anyone. People can export and delete their own data on every plan, including free.

That limits what you can report, and we think that is correct — a tool staff believe is monitored is one they will not use honestly.

More: ${SITE}/privacy

What does your data protection review require?

${SIGN}`),

    t("low-connectivity", "Low-connectivity areas",
      "Practical objection for rural programmes.",
      "Does it work where the signal doesn't?",
      `Hello {{name|there}},

A fair question for rural programmes. The basic function — somewhere to put a thought — keeps working on the device without a connection. Some cloud features need signal; the core does not.

It also runs on the phone your field staff already have rather than requiring anything new.

More: ${SITE}

How patchy is connectivity across your field sites?

${SIGN}`),

    t("cost-vs-counsellor", "Cost compared to counselling",
      "⚠️ Must not claim it replaces counselling. It does not.",
      "How this compares to funding a counsellor",
      `Hello {{name|there}},

A question that deserves a straight answer rather than a favourable comparison.

A counsellor does something Imotara does not do, and if you can fund one you should. What usually goes wrong is capacity: one counsellor cannot cover a distributed team, and the people who most need the appointment are least likely to book it.

Imotara costs far less per person, and that is not the argument. The argument is that it covers the hours and places a counsellor cannot.

More: ${SITE}

Do you currently fund counselling for staff?

${SIGN}`),

    t("wellbeing-policy-on-paper", "A policy that exists on paper",
      "Slightly pointed. Use with a warm contact.",
      "Most wellbeing policies are never used",
      `Hello {{name|there}},

Many organisations have a staff wellbeing policy written for a funder, filed, and never used by anyone. Nobody is at fault; writing it was the deliverable.

The test of a policy is whether a field officer at nine in the evening can reach something because of it.

More: ${SITE}

Does yours pass that test?

${SIGN}`),

    t("csr-funded", "Funding it through CSR",
      "Practical route for Indian organisations.",
      "A possible route through your CSR partner",
      `Hello {{name|there}},

Staff wellbeing often falls between budgets: too internal for programme funding, too soft for core costs.

Some organisations fund it through a corporate partner's CSR allocation, which tends to suit the partner — it is measurable, it is for frontline workers, and it is not another grant for a programme they already fund.

Happy to put the cost on one page if that is a conversation worth having.

More: ${SITE}

Do you have a CSR partner who might consider it?

${SIGN}`),

    t("staff-turnover-cost", "What replacing someone costs",
      "Financial framing. Keep it honest.",
      "What it costs when a good field officer leaves",
      `Hello {{name|there}},

Replacing an experienced field officer costs the recruitment, the months of reduced output, and the relationships in the community that do not transfer.

Nobody leaves purely because of burnout, and burnout is in the mix more often than exit interviews capture — by then the reasons have hardened into a tidier story.

I am not going to claim this fixes retention. It addresses one contributor, at modest cost.

More: ${SITE}

How many people left your field teams last year?

${SIGN}`),

    t("grant-reporting-season", "Reporting season",
      "Time this to a reporting deadline.",
      "The fortnight before the report is due",
      `Hello {{name|there}},

Reporting season compresses everything: the programme carries on, and on top of it people are reconstructing twelve months of evidence to a deadline they did not set.

It is predictable, which makes it one of the few strains you can prepare for.

More: ${SITE}

When does your main reporting deadline fall?

${SIGN}`),

    t("when-a-programme-closes", "When a programme ends",
      "Sensitive. Good where funding has been cut.",
      "When the funding ends and the programme closes",
      `Hello {{name|there}},

Closing a programme is a particular kind of hard. Staff lose the work and the community loses the service, and the people managing the closure carry both while being professional about it.

There is rarely anything offered for that period, because the budget it would come from is the one that ended.

More: ${SITE}

Is anything winding down for you this year?

${SIGN}`),

    // ── languages, reach, scale ─────────────────────────────────────────────
    t("one-language-of-management", "Managed in English, lived in another",
      "For multi-state organisations.",
      "Managed in English, felt in Marathi",
      `Hello {{name|there}},

Organisations spanning several states manage in English and deliver in a dozen languages. Staff cope with that professionally and feel things in the language they grew up in.

Asking someone to describe something painful in their second language, to a stranger, during working hours, is asking a great deal. Most decline politely.

Imotara works in 22 and replies in whichever the person used, Roman script included.

More: ${SITE}

How many languages do your teams work across?

${SIGN}`),

    t("scaling-a-pilot", "After a pilot goes well",
      "Use when a pilot has produced good numbers.",
      "What a wider rollout would involve",
      `Hello {{name|there}},

If the pilot has been useful, the next question is usually what scaling actually involves, and the honest answer is: less than people expect.

There is no deployment, no device management and no training programme. Licences are issued, people use it or they do not, and uptake is the only number that matters.

What does change at scale is the conversation with your staff about privacy — worth getting right before, not after.

More: ${SITE}

How many people would a full rollout cover?

${SIGN}`),

    t("renewal", "Coming up to renewal",
      "Use before an annual renewal date.",
      "Your renewal, and whether it's worth it",
      `Hello {{name|there}},

Your licences come up for renewal shortly, so this is the moment to look at whether it earned its place.

The number I would look at is uptake, not satisfaction. If a meaningful share of the team opened it unprompted, it is doing something. If almost nobody did, renewing would be paying for a line in a policy document, and I would rather you did not.

Happy to pull the figures together either way.

More: ${SITE}

Shall I send what we can see from our side?

${SIGN}`),

    t("after-a-conference", "After meeting at an event",
      "Only where you actually met. Do not fake this.",
      "Following up on our conversation",
      `Hello {{name|there}},

We spoke briefly at the event about staff wellbeing, and you mentioned your field teams. I said I would write, so here I am, once.

The short version: Imotara is a private companion in 22 languages that staff reach from their own phone, with nothing to book and nobody to tell. Not therapy, and careful never to claim it.

More: ${SITE}

Would a short call be useful, or shall I leave it with you?

${SIGN}`),

    t("referred-by-peer", "Introduced by another organisation",
      "⚠️ Only use with a real referrer, named.",
      "An introduction from a mutual contact",
      `Hello {{name|there}},

A colleague at another organisation suggested I write to you — they have been using Imotara with their field team and thought it might fit your context.

I would rather you heard about it from them than from me, so I will keep this short: private companion, 22 languages, on the phone staff already carry, for the hours your supervision cannot cover.

More: ${SITE}

Would it help if I asked them to tell you how it has actually gone?

${SIGN}`),

    t("partnership-not-purchase", "Partnership rather than purchase",
      "For organisations that cannot buy but could collaborate.",
      "Not everything has to be a purchase",
      `Hello {{name|there}},

If budget is the obstacle, it may not be the only route. We work with some organisations on terms that are not a straightforward licence purchase — pilots, shared evaluation, or arrangements tied to a funder's interest in frontline wellbeing.

I would rather find a structure that works than hear a polite no about a price list.

More: ${SITE}

If budget were not the first obstacle, would this be useful to you?

${SIGN}`),

    t("beneficiaries-or-staff", "Beneficiaries or staff — pick one",
      "Clarifying. Prevents a muddled pilot.",
      "Start with your staff or the people you serve?",
      `Hello {{name|there}},

Organisations often want both at once, and the pilots that go badly are usually the ones that tried.

The two are genuinely different: staff need something outside the hierarchy and private from their manager; beneficiaries need something in their own language at hours your service is closed. Both work, and running them as one muddles what you learn.

My suggestion is to start with staff — the group is smaller, the consent question is simpler, and you will know within a month.

More: ${SITE}

Which were you thinking of first?

${SIGN}`),

    t("monitoring-without-intrusion", "What you can report to a funder",
      "Complements the measuring template; more M&E-specific.",
      "What you could honestly report to a funder",
      `Hello {{name|there}},

To be concrete about what you could and could not put in a report.

You can report licences issued and licences used — adoption, over time, by team if you structure it that way. You cannot report what anyone said, or anything derived from it, because that view does not exist on the administrative side.

If your funder needs outcome data on individuals, we will not be able to supply it, and I would rather tell you now than after the grant agreement.

More: ${SITE}

What is your funder actually asking you to evidence?

${SIGN}`),

    t("onboarding-new-staff", "Giving it to new joiners",
      "Operational suggestion rather than a pitch.",
      "Where this fits in your induction",
      `Hello {{name|there}},

A small thing that changes uptake considerably: introduce it during induction rather than announcing it to existing staff.

New joiners have no history of being offered wellbeing support that turned out to be monitoring, so they try it. Existing staff adopt it afterwards because a colleague mentions it, which is a far better recommendation than one from management.

More: ${SITE}

How many people do you induct in a year?

${SIGN}`),

    t("exit-interviews", "What exit interviews miss",
      "Retention framing. Honest about limits.",
      "What people don't say on their way out",
      `Hello {{name|there}},

By the time someone resigns, the decision is months old and the reasons have been rehearsed into something sayable. That is why exit interviews so rarely change anything.

The useful window is earlier, when someone is still working out whether the problem is the work, the manager, or something at home that has nothing to do with either.

That is precisely the period in which people talk to nobody at the organisation.

More: ${SITE}

What do your exit interviews tell you that you wish you had known earlier?

${SIGN}`),

    t("board-and-trustees", "Trustees and board members",
      "Niche but occasionally the right door.",
      "A wellbeing question for your board",
      `Hello {{name|there}},

Boards ask about safeguarding and finances. Staff wellbeing tends to reach them as a line in an annual report rather than a question anyone probes.

If it would be useful, I can put together a single page a trustee could read before a meeting — what we do, what we cannot see, and what it costs. Not a sales document.

More: ${SITE}

Would that be useful before your next board meeting?

${SIGN}`),

    t("women-focused-programmes", "Women-focused programmes",
      "⚠️ Respectful framing — staff, not beneficiaries.",
      "Privacy that holds in a shared household",
      `Hello {{name|there}},

For programmes working with women, privacy is not an abstraction. Something on a shared phone in a shared house needs to be discreet in practice, not only in policy.

Imotara requires no account to begin, keeps anonymous use on the device, and shows nothing in a notification beyond the day someone last wrote. The reminder never quotes anyone's words, deliberately — a lock screen is read by whoever picks the phone up.

More: ${SITE}

Is device privacy something your programme has had to think about?

${SIGN}`),

    t("migrant-worker-programmes", "Migrant worker programmes",
      "Language-led, specific.",
      "Workers a long way from the language they think in",
      `Hello {{name|there}},

Migrant workers are often several states from home, working in a language they manage rather than one they are comfortable in, with family contact compressed into short calls where everything is reported as fine.

Support in the destination state's language reaches them professionally and not personally.

Imotara covers 22 — including the ones people go home in.

More: ${SITE}

Which language groups does your programme reach?

${SIGN}`),

    t("rehabilitation-programmes", "Rehabilitation and recovery work",
      "⚠️ Must not imply clinical treatment. It does not.",
      "The gaps between sessions in recovery work",
      `Hello {{name|there}},

In recovery and rehabilitation programmes the structured sessions are not usually where things go wrong. The difficult hours are the unstructured ones in between.

⛔ To be explicit, because it matters here: Imotara is not treatment, not clinical, and must not be positioned as part of a care plan. It is somewhere to put a difficult hour.

Where someone needs clinical help it points them to it rather than holding on.

More: ${SITE}

How is the time between sessions currently supported in your programme?

${SIGN}`),

    t("volunteers-in-response", "Volunteers in emergency response",
      "Distinct from the staff deployment template.",
      "Volunteers who saw more than they expected",
      `Hello {{name|there}},

Emergency volunteers are stood down and go back to ordinary life, often without a debrief, because they were not staff.

What they saw does not know they were volunteers. It surfaces weeks later, at home, to people who were not there.

More: ${SITE}

How many volunteers did your last response involve?

${SIGN}`),

    t("tiny-organisations", "Very small organisations",
      "For five-to-fifteen-person NGOs.",
      "For an organisation of twelve people",
      `Hello {{name|there}},

Most wellbeing provision is priced and designed for organisations with an HR function. If you are twelve people, you have neither the budget nor anyone whose job this is.

Small organisations are also where it matters most: there is nowhere to take a problem that is not the person you take every problem to.

Licences scale down, and a dozen seats is a perfectly normal conversation.

More: ${SITE}

How many people are you at the moment?

${SIGN}`),

    t("what-success-looks-like", "What success would look like",
      "Sets expectations honestly before a pilot.",
      "What a good result would actually look like",
      `Hello {{name|there}},

Worth agreeing before rather than after, because the wrong measure makes a good pilot look like a failure.

A good result is a meaningful share of the team opening it unprompted and continuing to. It is not everyone using it, and it is not a measurable change in wellbeing scores over three months — anyone promising you that is selling something.

If a third of your field team uses it in a month without being chased, that is a real signal.

More: ${SITE}

What would you need to see to call it worthwhile?

${SIGN}`),

    t("not-right-for-you", "When it probably isn't a fit",
      "⚠️ Genuinely disqualifying. Builds more trust than it costs.",
      "This may not be the right fit for you",
      `Hello {{name|there}},

Rather than keep writing, it may be more useful to say when this is the wrong tool.

If you need individual-level reporting on staff wellbeing, we cannot supply it and will not. If your teams do not have smartphones, it will not reach them. And if what you actually need is clinical provision, this is not that and should not be bought instead of it.

If any of those apply, I would rather you spent the budget elsewhere.

More: ${SITE}

Does one of those describe your situation?

${SIGN}`),

    t("second-follow-up", "A final note after no reply",
      "⚠️ The LAST message. After this, stop entirely.",
      "I'll stop writing after this one",
      `Hello {{name|there}},

This is the last you will hear from me — I have written before and had no reply, which is a perfectly clear answer.

Nothing further is owed. If staff wellbeing becomes live for you, we are easy to find, and I would be glad to pick it up then.

One thing worth leaving behind either way: whatever you put in place, check whether a field officer could reach it at nine in the evening without telling a supervisor. That single property predicts uptake better than any feature comparison.

${SITE}

And if I have simply been writing to the wrong person, who should it be?

${SIGN}`),

    t("thank-you-after-pilot", "After a pilot, whatever the result",
      "Use when a pilot ends — including a poor one.",
      "Thank you for trying it either way",
      `Hello {{name|there}},

The pilot has run its course, so thank you for giving it a proper go — that costs internal effort whatever the outcome.

If uptake was low, that is a real finding and I would rather know why than persuade you otherwise. If it was useful, the next question is simply which teams come next.

Either way I will send what we can see from our side, with nothing dressed up.

More: ${SITE}

What did your team actually say about it?

${SIGN}`),
];
