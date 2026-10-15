// src/lib/broadcast/templates/eldercareMore.ts
// Forty further angles for residential and elder care, added 2026-10-15 to
// take the category to fifty.
//
// ⚠️ SALES OUTREACH, not a newsletter — one-to-one, to a named person.
//
// ⚠️ TONE. Residents are adults with full lives behind them. Nothing here may
// read as though they are a problem to be managed, and nothing may promise to
// replace human visiting — the offer is company in the hours between, never
// instead of. Where something is clinical, it is named as clinical and handed
// over rather than absorbed.

import { SITE, type Template } from "./types";

const t = (
    id: string, title: string, note: string, subject: string, body: string,
): Template => ({ id: `eldercare-${id}`, audience: "eldercare", title, note, subject, body });

const SIGN = "— Suchismita Sen, Imotara";

export const ELDERCARE_MORE: Template[] = [
    // ── residents ───────────────────────────────────────────────────────────
    t("new-resident", "The first month after moving in",
      "Strong opener. Specific and humane.",
      "The first month after someone moves in",
      `Hello {{name|there}},

The first weeks are the hardest and the least visible. A new resident is being gracious about a decision they may not have wanted, in a building of strangers, while their family needs reassurance that it was the right choice.

So they say it is fine, to everyone, including themselves.

More: ${SITE}

How many new residents do you take in a year?

${SIGN}`),

    t("resident-who-was-someone", "Residents who had a working life",
      "Dignity-led. Very well received.",
      "Residents who used to be addressed differently",
      `Hello {{name|there}},

A resident who ran a department, taught for thirty years or raised a family alone is now addressed primarily as someone who needs help with things.

The competence is still there and has nowhere to go. A good deal of what reads as difficulty is actually that.

More: ${SITE}

Do your residents get asked about what they used to do?

${SIGN}`),

    t("residents-who-dont-join-in", "Residents who don't come to activities",
      "Practical and common.",
      "The residents who never come to anything",
      `Hello {{name|there}},

Every home has residents who decline every activity. It gets recorded as withdrawal and treated as a participation problem.

Often they are simply not group people and never were. The absence of company is still real; the group is just not the answer for them.

More: ${SITE}

How many of your residents keep to their rooms?

${SIGN}`),

    t("after-a-death-in-the-home", "When a resident dies",
      "⚠️ Very sensitive. For the other residents.",
      "The residents who are still there afterwards",
      `Hello {{name|there}},

When a resident dies, support goes — rightly — to the family and the staff. The other residents knew them daily, and are left with a quiet corridor and a reminder about themselves.

They are rarely offered anything, partly because nobody is sure what to say.

More: ${SITE}

How does your home mark it for the other residents?

${SIGN}`),

    t("residents-with-no-visitors", "Residents nobody visits",
      "Handle without pity.",
      "The residents whose names aren't on the visitor book",
      `Hello {{name|there}},

Most homes have a few. Families abroad, estranged, or simply gone. Staff compensate informally, which is generous and not systematic.

Something available at any hour, in their own language, does not fix it. It fills part of it.

More: ${SITE}

How many of your residents get regular visitors?

${SIGN}`),

    t("couples-separated", "When one of a couple moves in",
      "Specific and often moving.",
      "When only one of them needed the place",
      `Hello {{name|there}},

Sometimes only one partner needs residential care. After decades together they are apart for the first time, and both are being brave about it on their respective sides.

The one at home is usually the more isolated of the two, and is nobody's resident.

More: ${SITE}

Do you see that situation often?

${SIGN}`),

    t("after-a-fall", "After a fall or a hospital stay",
      "⚠️ Clinical care belongs elsewhere. Say so.",
      "The confidence that doesn't come back",
      `Hello {{name|there}},

Physical recovery after a fall is managed well. What is rarely addressed is the confidence, which often does not return with the mobility — and the resulting caution reads as decline.

⛔ The clinical side belongs with your nursing team and we would not touch it. The fear afterwards is a different thing and sits with nobody.

More: ${SITE}

How is that period usually handled in your home?

${SIGN}`),

    t("hearing-and-sight", "Residents who can't easily join a conversation",
      "Accessibility angle, handled plainly.",
      "Residents who have stopped joining conversations",
      `Hello {{name|there}},

Hearing loss excludes people from group conversation long before anyone notices, and the withdrawal gets read as mood rather than as a practical barrier.

Reading on a screen at their own pace, or speaking rather than typing and having replies read back, sidesteps a lot of that.

More: ${SITE}

How many of your residents have significant hearing loss?

${SIGN}`),

    t("night-waking", "Residents awake at night",
      "Operationally specific.",
      "Residents who are awake at two in the morning",
      `Hello {{name|there}},

Sleep fragments with age, so a proportion of your residents are awake for long stretches at night with a single night nurse covering the floor.

They will not ring the bell for company, because the bell is for emergencies and they know it.

More: ${SITE}

How many of your residents are regularly awake at night?

${SIGN}`),

    t("residents-with-mild-memory-loss", "Residents with mild memory difficulty",
      "⚠️ Must not claim any therapeutic or diagnostic role.",
      "Where this does and doesn't fit with memory loss",
      `Hello {{name|there}},

Worth being careful rather than enthusiastic here.

⛔ Imotara is not a memory aid, not a cognitive intervention, and should never be part of a care plan for dementia. We do not claim benefit there and would ask you not to either.

For residents in the early, frustrating stage — aware of what is slipping and reluctant to burden family with it — a private place to say so is sometimes useful. That is the whole claim.

More: ${SITE}

Would that distinction hold for your residents?

${SIGN}`),

    t("end-of-life", "Residents near the end of life",
      "⚠️ The most delicate. Use rarely, never as a pitch.",
      "Conversations people can't have with their children",
      `Hello {{name|there}},

Some residents want to talk about dying and cannot, because their children become distressed and the staff are busy and kind.

⛔ This is not palliative care and does not belong in one. Your clinical and chaplaincy provision does that work.

What it can be is somewhere a person says the thing they have decided not to say to their daughter.

More: ${SITE}

Is that a conversation your residents find anywhere?

${SIGN}`),

    // ── families ────────────────────────────────────────────────────────────
    t("family-guilt", "Families carrying guilt",
      "Often the most responsive audience of all.",
      "The guilt families bring with them",
      `Hello {{name|there}},

Families arrive carrying a decision they are not sure about. They are often short with staff because of it, and the guilt does not reduce with time — it simply becomes quieter.

Nobody offers families anything. They are not your residents and not your staff.

More: ${SITE}

Do your families ever say any of this out loud?

${SIGN}`),

    t("families-abroad", "Families in another country",
      "Distinct from the existing distant-families template.",
      "The daughter who calls from another time zone",
      `Hello {{name|there}},

An adult child abroad manages the arrangement from a distance, on calls timed across zones, with no way to judge whether what they are told is the whole picture.

They carry guilt, logistics and no company for either.

Extending access to families costs little and is remembered.

More: ${SITE}

What proportion of your families are overseas?

${SIGN}`),

    t("family-disagreement", "When siblings disagree",
      "Specific, common, rarely addressed.",
      "When the siblings don't agree",
      `Hello {{name|there}},

Decisions about a parent frequently split siblings — one nearby doing everything, one distant with opinions. The disagreement is rarely about care and usually about older things.

Your staff end up mediating it without any remit to.

More: ${SITE}

How often does that land on your team?

${SIGN}`),

    // ── staff ───────────────────────────────────────────────────────────────
    t("night-staff-eldercare", "Night staff",
      "Operational, distinct from the evening template.",
      "One nurse, a whole floor, all night",
      `Hello {{name|there}},

Night staff handle the falls, the confusion and the deaths that happen between midnight and six, usually alone, and hand over to a day team that is already busy.

There is no debrief built into that shift pattern.

More: ${SITE}

How many staff cover your nights?

${SIGN}`),

    t("care-assistants", "Care assistants",
      "The largest group and the least provided for.",
      "The staff who do the most intimate work",
      `Hello {{name|there}},

Care assistants do the physically and emotionally closest work in the building, for the lowest pay, and are the group least likely to be included in anything described as wellbeing.

They also form the strongest attachments to residents, which is what makes the losses land hardest on them.

More: ${SITE}

How many care assistants do you employ?

${SIGN}`),

    t("agency-staff", "Agency and bank staff",
      "Often excluded from everything.",
      "The staff who aren't really yours",
      `Hello {{name|there}},

Agency staff cover your hardest shifts and belong to nobody. No induction into the culture, no inclusion in anything offered, and the same losses as permanent staff.

Extending something low-cost to them is noticed, and it affects whether they come back.

More: ${SITE}

How much of your rota is agency?

${SIGN}`),

    t("registered-manager", "The registered manager",
      "⚠️ Personal. Only with a relationship.",
      "A question about you, not the home",
      `Hello {{name|there}},

A registered manager carries regulatory liability, staffing, families and clinical oversight, usually with nobody in the building at the same level to talk to.

You cannot say the discouraging version to your team or to the owners.

More: ${SITE}

Where do you take it?

${SIGN}`),

    t("staff-caring-at-home-too", "Staff who go home to more care",
      "Specific and very common in this sector.",
      "Staff who finish a shift and start caring again",
      `Hello {{name|there}},

A significant share of care staff go home to a parent or child who also needs them. The skills transfer; the recovery time does not exist.

They are the least likely of anyone to describe themselves as needing support.

More: ${SITE}

Do you know how many of your team are carers at home too?

${SIGN}`),

    t("after-an-inspection", "After an inspection",
      "Operationally timed.",
      "The week after the inspectors leave",
      `Hello {{name|there}},

Inspection weeks are exhausting and the aftermath is worse — relief if it went well, and something harder if it did not, landing on a team that already worked flat out.

More: ${SITE}

When is your next inspection due?

${SIGN}`),

    t("staff-turnover-eldercare", "Turnover",
      "Financial framing, honest about limits.",
      "What it costs when a good carer leaves",
      `Hello {{name|there}},

Replacing a care assistant costs recruitment, induction, agency cover in the gap, and the relationships with residents that do not transfer.

⛔ I will not claim this fixes retention. Grief with nowhere to go is one contributor among several, and this addresses that one, at modest cost.

More: ${SITE}

What was your turnover last year?

${SIGN}`),

    t("recruitment-difficulty", "Recruiting at all",
      "Acknowledges the sector's real problem.",
      "When you can't recruit in the first place",
      `Hello {{name|there}},

In much of the sector the problem is not retention but that nobody applies. Which makes keeping the people you have the only lever you actually control.

More: ${SITE}

How long do your vacancies stay open?

${SIGN}`),

    // ── practical and commercial ───────────────────────────────────────────
    t("who-sets-it-up", "Who actually sets it up",
      "Removes the main practical objection.",
      "Who would have to set this up?",
      `Hello {{name|there}},

A fair concern, since your staff have no spare capacity for a project.

Practically: there is nothing to install and no system to administer. A resident or staff member opens it in a browser or on a phone and starts. No account is needed to begin.

If a floor's residents needed help getting started, that is an afternoon, not a project.

More: ${SITE}

Who would usually own something like this in your home?

${SIGN}`),

    t("shared-devices", "Shared tablets",
      "⚠️ Important privacy caveat — stated honestly.",
      "If residents would share a tablet",
      `Hello {{name|there}},

If you are thinking of a communal tablet, one caution worth having early.

Anonymous use keeps the conversation on the device, which on a shared tablet means the next person could in principle see it. For genuine privacy, personal devices or individual accounts are better.

⛔ I would rather raise that now than have a resident discover it.

More: ${SITE}

Would residents be using their own phones, or something shared?

${SIGN}`),

    t("families-paying", "When families pay rather than the home",
      "Alternative commercial route.",
      "Families sometimes fund this themselves",
      `Hello {{name|there}},

If the home's budget is the obstacle, some families fund it directly for their own relative — particularly those abroad who want to do something and have limited options.

That needs nothing from you beyond not objecting.

More: ${SITE}

Would your families be open to that?

${SIGN}`),

    t("regulator-questions", "What a regulator would ask",
      "Pre-empts the compliance question.",
      "How this would look to an inspector",
      `Hello {{name|there}},

To pre-empt it: Imotara is not a care intervention, is not part of a care plan, and produces no clinical record. It is a private communication tool a resident may choose to use, like a telephone.

⛔ It should not appear in care documentation as a therapeutic activity, and we would ask you not to record it as one.

More: ${SITE}

Would your inspector be likely to ask about it?

${SIGN}`),

    t("consent-and-capacity", "Consent and capacity",
      "⚠️ The hardest question in this sector. Answer honestly.",
      "Residents who can't give meaningful consent",
      `Hello {{name|there}},

The question this sector should ask, and the honest answer.

Imotara is designed for people who can decide to use it. For residents without the capacity to consent meaningfully, we would not suggest it, and no arrangement on our side changes that judgement — it belongs with you and the family.

⛔ We will not claim benefit for residents who cannot consent, and would be wary of anyone who did.

More: ${SITE}

What share of your residents would be able to consent for themselves?

${SIGN}`),

    t("languages-in-the-home", "Languages spoken in your home",
      "Practical version of the mother-tongue template.",
      "The languages nobody on the staff speaks",
      `Hello {{name|there}},

Most homes have a resident or two whose first language nobody on the rota speaks. Staff manage warmly and practically; conversation of any depth stops.

22 languages, replying in whichever one the person used.

More: ${SITE}

Is there a resident in that position with you?

${SIGN}`),

    t("day-centres", "Day centres and respite",
      "Adjacent service, often the same operator.",
      "Day visitors, and the hours at home",
      `Hello {{name|there}},

If you run day services, the people attending go home to the hours you do not cover — which are most of them, and usually the harder ones.

More: ${SITE}

Do you run day or respite services alongside residential?

${SIGN}`),

    t("home-care-teams", "Home care teams",
      "For operators with a domiciliary arm.",
      "Carers who drive between fifteen-minute calls",
      `Hello {{name|there}},

Domiciliary carers work alone all day, in other people's houses, to a schedule that does not allow for the visit where something is wrong.

They have no staff room and no colleague to debrief with at the end of it.

More: ${SITE}

Do you run home care as well as residential?

${SIGN}`),

    t("small-homes", "Small, independent homes",
      "Important: most Indian homes are small.",
      "For a home with twenty residents",
      `Hello {{name|there}},

Most provision in this sector is priced for large groups. If you run one home with twenty residents, you have neither the budget nor anyone whose job this would be.

Licences scale down, and twenty seats is an entirely normal conversation.

More: ${SITE}

How many residents do you have?

${SIGN}`),

    t("trust-run-homes", "Trust and charity-run homes",
      "Non-profit pricing route.",
      "If the home is run on donations",
      `Hello {{name|there}},

Charitable and trust-run homes operate on margins that make any new line difficult, and are often doing the most for the people with the least.

Our non-profit rate is genuinely different, and a pilot on one floor costs a fraction of covering the home.

More: ${SITE}

How is your home funded?

${SIGN}`),

    t("what-success-looks-like-elder", "What a good result would look like",
      "Sets expectations before a pilot.",
      "What would make it worth continuing",
      `Hello {{name|there}},

Worth agreeing before, because the wrong measure makes a good pilot look like a failure.

In a home of forty, if three or four residents use it regularly and a handful of staff use it after shifts, that is a real result. It will not be most of your residents, and anyone promising that has not worked in a home.

More: ${SITE}

What would make it worth continuing, for you?

${SIGN}`),

    t("introduced-by-family", "Introduced by a family member",
      "⚠️ Only where a real family member suggested it.",
      "A family member suggested I write",
      `Hello {{name|there}},

A relative of one of your residents mentioned Imotara and suggested I write to you directly.

I would rather you heard it from them than from me, so briefly: a private companion in 22 languages, usable by voice, for the long hours between visits. Not a replacement for anyone.

More: ${SITE}

Would it help if I asked them to tell you how it has gone?

${SIGN}`),

    t("after-pilot-elder", "After a pilot",
      "Use when a pilot ends, including a poor one.",
      "What your residents and staff actually said",
      `Hello {{name|there}},

The pilot has run, so thank you for giving it a proper go — that costs your team time whatever the result.

If barely anyone used it, I would rather understand why than persuade you otherwise. In homes, low uptake usually means the setup needed a person sitting alongside and nobody had the hour.

More: ${SITE}

What did your staff say about it?

${SIGN}`),

    t("renewal-elder", "Approaching renewal",
      "Honest even at the cost of the renewal.",
      "Whether this is worth renewing",
      `Hello {{name|there}},

Renewal is coming, so the honest question: did anyone use it?

If a handful of residents and staff did, that is worth the line. If nobody did, renewing buys a tick in a policy file and I would rather you put the money into the rota.

More: ${SITE}

Shall I send what we can see from our side?

${SIGN}`),

    t("not-right-for-you-elder", "When it isn't a fit",
      "⚠️ Genuinely disqualifying.",
      "This may not suit your home",
      `Hello {{name|there}},

Rather than keep writing, here is when this is the wrong thing.

If most of your residents cannot consent meaningfully, it is not for them. If families expect to see what residents say, we will not provide that. And if what you need is clinical mental health input, this is not that and must not stand in for it.

If any of those apply, I will stop.

More: ${SITE}

Does one of those describe your home?

${SIGN}`),

    t("volunteers-and-visitors", "Volunteer visitors",
      "Small group, genuinely affected, never provided for.",
      "Your volunteer visitors see it too",
      `Hello {{name|there}},

Volunteers who sit with residents week after week form real attachments and are told nothing when someone dies, because they are not family and not staff.

They turn up the following week to an empty chair.

More: ${SITE}

How many regular volunteers come into your home?

${SIGN}`),

    t("kitchen-and-housekeeping", "Kitchen and housekeeping staff",
      "The most overlooked group in any home.",
      "The staff residents talk to most",
      `Hello {{name|there}},

Residents often say more to the person bringing tea or cleaning the room than to anyone with care in their job title — it is a conversation with no assessment attached.

Those staff hold a surprising amount and are included in nothing.

More: ${SITE}

Would your housekeeping team be in scope for you?

${SIGN}`),

    t("final-note-elder", "A final note after no reply",
      "⚠️ The LAST message. Then stop entirely.",
      "Last note from me about your residents",
      `Hello {{name|there}},

This is the last you will hear from me. I have written before without reply, which is a clear answer, and homes have more pressing things than my letters.

One thought worth leaving: if you ever do look at anything in this area, check first whether it works in the language your residents actually speak at home. Most of it does not, and that is usually why it sits unused.

${SITE}

And if someone else would be the right person, who is it?

${SIGN}`),
];
