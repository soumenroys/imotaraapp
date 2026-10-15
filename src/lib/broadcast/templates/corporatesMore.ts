// src/lib/broadcast/templates/corporatesMore.ts
// Forty further corporate angles, added 2026-10-15 to take the category to
// fifty.
//
// ⚠️ SALES OUTREACH, not a newsletter — one-to-one, to a named person.
// Ordered as: employee groups, moments in the employment cycle, then the
// procurement and commercial conversations.

import { SITE, type Template } from "./types";

const t = (
    id: string, title: string, note: string, subject: string, body: string,
): Template => ({ id: `corporates-${id}`, audience: "corporates", title, note, subject, body });

const SIGN = "— Suchismita Sen, Imotara";

export const CORPORATES_MORE: Template[] = [
    // ── employee groups ─────────────────────────────────────────────────────
    t("managers-delivering-bad-news", "Managers who deliver the bad news",
      "Strong during restructuring. Not opportunistic if framed on the manager.",
      "The managers who have to deliver it",
      `Hello {{name|there}},

In a restructuring, support is arranged for the people leaving. The managers conducting those conversations — often a dozen in a week, often about people they hired — are given a script and expected to carry on.

They cannot discuss it with their team, and they cannot discuss it at home in any detail.

More: ${SITE}

How many of your managers are having those conversations this quarter?

${SIGN}`),

    t("first-time-managers", "First-time managers",
      "Converts well. Specific and common.",
      "People promoted into managing people",
      `Hello {{name|there}},

Someone promoted for being good at the work is now responsible for other people's performance, morale and occasionally their personal crises, usually with two days of training.

They cannot admit to their team that they are unsure, and admitting it upward feels like proving the promotion was wrong.

More: ${SITE}

How many first-time managers do you promote in a year?

${SIGN}`),

    t("customer-facing-abuse", "Staff who absorb customer anger",
      "Support centres, retail, collections, frontline service.",
      "Staff who are shouted at for a living",
      `Hello {{name|there}},

In support, collections and frontline retail, being on the receiving end of somebody's bad day is simply part of the role. The call ends, the next one connects, and there is nowhere for the previous one to go.

It accumulates quietly and shows up as attrition rather than as complaints.

More: ${SITE}

How many of your people are customer-facing?

${SIGN}`),

    t("factory-floor", "Manufacturing and plant staff",
      "Often excluded from corporate wellbeing entirely.",
      "Wellbeing that reaches the plant, not just the office",
      `Hello {{name|there}},

Corporate wellbeing programmes are usually designed by and for head office. Plant and warehouse staff have no desk, no corporate email, and little opportunity to be online during a shift.

Something on a personal phone, in the language they actually speak, in whatever hours they have, is a different proposition from a portal they cannot reach.

More: ${SITE}

How many of your employees are at sites rather than offices?

${SIGN}`),

    t("field-sales", "Field sales and travelling staff",
      "Specific and often forgotten.",
      "People who are never in the same place twice",
      `Hello {{name|there}},

Field staff spend their weeks alone in transit, hit targets in public, and miss everything informal that holds a team together.

The support that exists is in an office they visit monthly.

More: ${SITE}

How large is your field team?

${SIGN}`),

    t("on-call-rotations", "On-call rotations",
      "Technology and operations flavoured.",
      "The week somebody is on call",
      `Hello {{name|there}},

On-call weeks disrupt sleep whether or not anything pages. The anticipation does most of the damage, and the recovery is assumed to happen over a weekend.

Teams normalise it, which means nobody raises it until someone leaves.

More: ${SITE}

How often does your on-call rotation come round?

${SIGN}`),

    t("project-crunch", "The crunch before a deadline",
      "Predictable and preparable.",
      "The six weeks before the deadline",
      `Hello {{name|there}},

Crunch periods are planned for in terms of hours and not in terms of people. Everyone agrees it is temporary, and the temporary period arrives three times a year.

Because it is predictable, it is one of the few strains you can resource in advance.

More: ${SITE}

When is your next crunch period?

${SIGN}`),

    t("safety-critical", "Safety-critical roles",
      "⚠️ Must not imply fitness-for-duty assessment.",
      "Roles where a bad night matters more",
      `Hello {{name|there}},

In driving, plant operation and similar roles, a sleepless night is not only a personal matter. Which is exactly why nobody declares one — declaring it has consequences for the roster.

⛔ To be explicit: Imotara is not a fitness-for-duty assessment, produces no such signal, and must never be positioned as one. It is somewhere private, which is what makes it usable at all here.

More: ${SITE}

How does your organisation currently handle that?

${SIGN}`),

    t("expat-and-relocated", "Relocated and expatriate staff",
      "Language-led.",
      "Employees a long way from home",
      `Hello {{name|there}},

Relocated employees have the job, the visa and the housing sorted, and no one to talk to. The company solved the logistics, which everyone treats as having solved the move.

Support in the destination language reaches them professionally, not personally.

More: ${SITE}

How many of your staff have relocated in the past year?

${SIGN}`),

    t("contract-workers", "Contract and gig workers",
      "⚠️ Check whether your benefits legally can extend.",
      "The workers your benefits don't cover",
      `Hello {{name|there}},

Contractors, agency staff and gig workers do the work and sit outside the benefits. They also have the least security, which is the thing most likely to be weighing on them.

Extending something low-cost to them is one of the few gestures that is noticed immediately.

More: ${SITE}

Does your current provision reach non-permanent staff?

${SIGN}`),

    t("interns-corp", "Interns and graduate trainees",
      "Small group, outsized effect on employer brand.",
      "Interns won't tell you they're struggling",
      `Hello {{name|there}},

An intern or graduate trainee will not raise a difficulty with a manager who is also deciding whether they get an offer.

They tell their university instead, and their friends, which is where your graduate reputation actually gets set.

More: ${SITE}

How many interns do you take in a year?

${SIGN}`),

    t("senior-isolation", "Senior leadership",
      "⚠️ Only with a warm relationship. Easy to get wrong.",
      "A question about you rather than your workforce",
      `Hello {{name|there}},

Senior people have the fewest places to say they are struggling. Saying it downward frightens the organisation; saying it sideways is competitive; saying it upward is career-limiting.

So the people with the most pressure have the thinnest support, and nobody designs a programme for them because it looks absurd on paper.

More: ${SITE}

Where do you take it, when it is heavy?

${SIGN}`),

    t("hr-team-itself", "The HR team",
      "Often the single most receptive audience.",
      "Who supports the people who support everyone?",
      `Hello {{name|there}},

Your HR team handles the grievances, the terminations, the illnesses and the bereavements. They hold confidences they cannot discuss with anyone, including each other.

They are also the people who would have to administer any support programme, which makes them the last to be offered it.

More: ${SITE}

Is anything in place for your own team?

${SIGN}`),

    t("mental-health-first-aiders", "Mental health first aiders",
      "Positions Imotara as complementary.",
      "Your first aiders, after the conversation",
      `Hello {{name|there}},

Organisations train volunteers to be a first point of contact, which works. What is usually missing is anywhere for the first aider to put what they just heard.

They are colleagues, not clinicians, and they go back to their own job afterwards.

More: ${SITE}

How many first aiders have you trained?

${SIGN}`),

    t("wellbeing-lead", "The person who owns wellbeing",
      "Flattering without being obsequious.",
      "Owning wellbeing for everyone except yourself",
      `Hello {{name|there}},

If wellbeing sits with you alongside another full role, you will know the particular position: responsible for everyone's, with no one responsible for yours, and judged on a number — utilisation — that you do not control.

More: ${SITE}

What does the board actually ask you for?

${SIGN}`),

    // ── moments in the employment cycle ────────────────────────────────────
    t("performance-review-season", "Review season",
      "Predictable timing.",
      "The fortnight after ratings come out",
      `Hello {{name|there}},

Ratings land and most people are disappointed, including a good number who did well. The conversation with the manager addresses the rating; it does not address the fortnight afterwards.

More: ${SITE}

When does your review cycle close?

${SIGN}`),

    t("passed-over", "Being passed over",
      "Specific and rarely addressed.",
      "The people who didn't get promoted",
      `Hello {{name|there}},

Every promotion round produces a handful of people who expected one and did not get it. They are told to stay motivated and not given anywhere to be demotivated first.

That group is also the most likely to be approached by a competitor in the following quarter.

More: ${SITE}

How many people does your last cycle have in that position?

${SIGN}`),

    t("bereavement-return", "Returning after a bereavement",
      "⚠️ Distinct from general leave. Handle gently.",
      "Three weeks after the bereavement leave ends",
      `Hello {{name|there}},

Bereavement leave is measured in days and grief is not. Someone returns, is treated carefully for a fortnight, and then the organisation moves on while they do not.

Week five is usually the hard one, and by then asking feels unreasonable.

More: ${SITE}

What does your policy currently allow?

${SIGN}`),

    t("maternity-return", "Returning from parental leave",
      "⚠️ Must not touch clinical postnatal matters.",
      "Coming back after parental leave",
      `Hello {{name|there}},

Returning is treated as a logistics problem — desk, hours, handover — and is mostly an identity one. The person who left is not quite the person coming back, and the role assumes otherwise.

⛔ Anything clinical belongs with a doctor, and Imotara says so rather than engaging with it.

More: ${SITE}

How many people return from parental leave with you each year?

${SIGN}`),

    t("notice-period", "Working a notice period",
      "Unusual angle; often lands.",
      "The strangest three months of a job",
      `Hello {{name|there}},

A notice period is an odd stretch: still working, already gone, excluded from anything forward-looking and expected to hand over graciously.

People rarely leave entirely gladly, and there is nowhere to process the ending while still being professional about it.

More: ${SITE}

How long are your notice periods?

${SIGN}`),

    t("onboarding-corp", "Where it fits in onboarding",
      "Operational, improves uptake.",
      "Introduce it at induction, not by announcement",
      `Hello {{name|there}},

A practical point that changes uptake more than the launch email does.

New joiners have no history of being offered wellbeing support that turned out to be monitoring, so they try it. Existing staff adopt it afterwards because a colleague mentions it — which is a far better recommendation than one from HR.

More: ${SITE}

How many people do you onboard each month?

${SIGN}`),

    t("workplace-conflict", "Conflict between colleagues",
      "⚠️ Explicitly not a grievance channel.",
      "The conflict that hasn't become a grievance",
      `Hello {{name|there}},

Most workplace conflict never reaches a formal process. It sits for months, consuming attention, until one party leaves.

⛔ Imotara is not a grievance channel and must not be presented as one — only your process can act. What it can do is help someone work out what they actually want to happen, which is often what has to precede raising it at all.

More: ${SITE}

How much unreported conflict would you guess sits in your organisation?

${SIGN}`),

    t("after-workplace-incident", "After an incident at work",
      "⚠️ Never opportunistic. General, not specific.",
      "The month after an incident at work",
      `Hello {{name|there}},

After a serious incident, organisations arrange sessions for a week or two. Attendance peaks when need is lowest, and need peaks about a month later.

⛔ I would not write about a specific incident and am not doing so. Only that the tail is long and usually unresourced.

More: ${SITE}

What does your organisation do beyond the first fortnight?

${SIGN}`),

    t("hybrid-friction", "Return-to-office friction",
      "Current and contested — stay neutral.",
      "The office policy nobody is happy with",
      `Hello {{name|there}},

Whatever your hybrid policy is, a substantial group is unhappy with it, and that unhappiness is usually about something else — care responsibilities, commute cost, a home that is not a workplace.

Those reasons rarely get said out loud, so the feedback you receive is about the policy rather than about the lives underneath it.

More: ${SITE}

How settled is your policy at the moment?

${SIGN}`),

    t("long-commute-corp", "Long commutes",
      "Urban India specifically.",
      "Three hours a day, before work starts",
      `Hello {{name|there}},

Employees commuting two or three hours each way lose the time and arrive already depleted. It reads as low energy and gets managed as a performance issue.

The commute is also dead time they are already holding a phone through.

More: ${SITE}

What does a typical commute look like for your staff?

${SIGN}`),

    t("night-shift-health", "Night shift, over years",
      "Distinct from the general shift template.",
      "What ten years of night shifts does",
      `Hello {{name|there}},

A night rotation for a few months is an inconvenience. Years of it is a different thing, and the people doing it are usually the furthest from head office.

⛔ The physical health side belongs with occupational health, not with us. The part that goes unattended is the isolation of being awake when everyone you know is not.

More: ${SITE}

How many of your staff are on permanent nights?

${SIGN}`),

    // ── commercial, procurement, process ───────────────────────────────────
    t("security-review", "Your security review",
      "Procurement-facing. Be precise and unembellished.",
      "What your security review will want to know",
      `Hello {{name|there}},

The short version, so your team can judge quickly.

Conversations sit against the individual's own account, not the company's. The employer sees licences issued and used; it cannot see content, and that view does not exist on the administrative side. Individuals can export and delete their own data on every plan.

If your review requires employer access to content, we will fail it, and I would rather say so before the questionnaire.

More: ${SITE}/privacy

Shall I send what your reviewers usually ask for?

${SIGN}`),

    t("works-council", "Explaining it to employee representatives",
      "For unionised or council-governed workplaces.",
      "How this would be explained to your works council",
      `Hello {{name|there}},

Anything touching employee wellbeing data gets scrutinised by representatives, correctly.

The position is simple to put to them: the employer cannot see conversations, cannot request them, and no individual-level reporting exists. The only thing visible is that a licence was used.

That is usually a short conversation rather than a difficult one, because there is nothing to negotiate away.

More: ${SITE}

Would your representatives need to be consulted?

${SIGN}`),

    t("benefits-broker", "Through your benefits broker",
      "Practical commercial route.",
      "This may sit better with your broker",
      `Hello {{name|there}},

If benefits are intermediated, it may be simpler to have this sit alongside the rest of your package rather than as a separate line.

Happy to put the detail in a form your broker can assess, including what it is not — specifically that it is not a clinical service and should not be positioned as replacing one.

More: ${SITE}

Who handles your benefits?

${SIGN}`),

    t("esg-reporting", "Wellbeing in your ESG reporting",
      "⚠️ Be honest about measurement limits.",
      "What you could report, and what you couldn't",
      `Hello {{name|there}},

For social reporting, to be precise about the limits before they become a problem.

You can report provision and adoption — licences issued, licences used, over time. You cannot report wellbeing outcomes at the individual level, because that data does not exist.

Anyone offering you outcome metrics from a confidential tool is either measuring something else or reading things they should not.

More: ${SITE}

What does your reporting framework actually require?

${SIGN}`),

    t("cost-per-seat", "Cost per seat, plainly",
      "Distinct from the existing cost template; procurement-flavoured.",
      "Per seat, per year, without the preamble",
      `Hello {{name|there}},

Licences are per seat, bought annually. Conversations are never metered, so nobody is cut off mid-sentence and there is no usage-based surprise at renewal.

What I will not do is quote before knowing headcount and shape, because the honest number depends on both.

⛔ And I will not claim it reduces your counselling spend. It does not do the same job.

More: ${SITE}

What headcount would be in scope?

${SIGN}`),

    t("we-tried-something-like-this", "\"We tried something like this\"",
      "Objection handler. Does not dismiss their experience.",
      "If a previous wellbeing app went unused",
      `Hello {{name|there}},

A lot of organisations have bought something in this space and watched it go unused. If that is your experience, it is the most useful thing you could tell me.

In almost every case we have seen, the cause was one of three: people suspected the employer could see it, it required an account tied to a work email, or it was only in English.

If yours failed for a different reason, I would genuinely like to know what it was.

More: ${SITE}

What did you try, and what happened?

${SIGN}`),

    t("utilisation-is-the-number", "The only number that matters",
      "Sets the measure before a pilot.",
      "The one number worth watching",
      `Hello {{name|there}},

If you run a pilot, I would suggest judging it on one thing: what share of the team opened it unprompted and came back.

Not satisfaction scores, which measure politeness. Not wellbeing indices over a quarter, which nobody can honestly attribute.

If a quarter of a team uses something private without being chased, that is a real signal. If almost nobody does, that is also real and I would rather you acted on it.

More: ${SITE}

What would you need to see to call it worthwhile?

${SIGN}`),

    t("multi-country", "More than one country",
      "For organisations with offices across borders.",
      "Teams in more than one country",
      `Hello {{name|there}},

Multi-country provision usually means a different vendor per market and a different experience in each.

Imotara is one service in 22 languages, which simplifies the procurement and means the Hyderabad team and the Manila team get the same thing.

⚠️ Local legal requirements still vary, and data protection questions should be asked per market rather than assumed.

More: ${SITE}

Which countries would be in scope?

${SIGN}`),

    t("scaling-after-pilot-corp", "Scaling after a pilot",
      "Use when a pilot has gone well.",
      "What a full rollout would involve",
      `Hello {{name|there}},

Less than people expect. No deployment, no device management, no training programme — licences are issued and people use them or they do not.

What does change at scale is the internal communication about privacy. Getting that right before the rollout matters more than anything technical.

More: ${SITE}

How many people would a full rollout cover?

${SIGN}`),

    t("renewal-corp", "Approaching renewal",
      "Honest, even at the cost of the renewal.",
      "Your renewal, and whether it earned its place",
      `Hello {{name|there}},

Renewal is coming up, so this is the moment to look at whether it earned its place.

The number to look at is uptake. If a meaningful share of people opened it unprompted, it is doing something. If almost nobody did, renewing buys a line in a policy document, and I would rather you spent it elsewhere.

Happy to pull the figures together either way.

More: ${SITE}

Shall I send what we can see from our side?

${SIGN}`),

    t("after-a-conference-corp", "After meeting at an event",
      "⚠️ Only where you actually met.",
      "Following up from the conference",
      `Hello {{name|there}},

We spoke briefly about wellbeing provision and the gap between what gets bought and what gets used. I said I would write, so here it is, once.

Short version: private companion, 22 languages, on the employee's own phone, nothing to book and nobody to tell. Not therapy, and careful never to claim it.

More: ${SITE}

Would a short call help, or shall I leave it with you?

${SIGN}`),

    t("not-right-for-you-corp", "When it isn't a fit",
      "⚠️ Genuinely disqualifying.",
      "This may not be right for your organisation",
      `Hello {{name|there}},

Rather than keep writing, here is when this is the wrong purchase.

If you need individual-level visibility, we will not provide it. If your workforce does not have smartphones, it will not reach them. And if what you need is clinical provision, this is not that and must not be bought instead of it.

If any of those apply, spend the budget elsewhere and I will stop.

More: ${SITE}

Does one of those describe you?

${SIGN}`),

    t("small-employers", "Small and mid-size employers",
      "Most Indian employers are not large. Priced for them.",
      "For a company of forty people",
      `Hello {{name|there}},

Workplace wellbeing is designed and priced for organisations with an HR function. At forty people you have neither the budget nor anyone whose job this is.

It also matters more at that size: there is nowhere to take a problem that is not the person you take every problem to, and that person is usually the founder.

Licences scale down. Forty seats is an ordinary conversation.

More: ${SITE}

How many people are you at the moment?

${SIGN}`),

    t("final-note-corp", "A final note after no reply",
      "⚠️ The LAST message. Then stop entirely.",
      "Last note from me",
      `Hello {{name|there}},

This is the last you will hear from me — I have written before without reply, which is a clear answer.

One thing worth leaving behind regardless: whatever you use, check whether an employee can reach it without anyone at work knowing. That single property predicts utilisation better than any feature comparison, and it is usually what a low number is really telling you.

${SITE}

And if this sits with someone else, who should I have written to?

${SIGN}`),
];
