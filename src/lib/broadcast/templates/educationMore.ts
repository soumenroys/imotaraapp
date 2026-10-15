// src/lib/broadcast/templates/educationMore.ts
// Forty further angles for schools, colleges and universities, added
// 2026-10-15 to take the category to fifty.
//
// ⚠️ SALES OUTREACH, not a newsletter — one-to-one, to a named person.
// 🔴 Minimum age 13, parental consent under 18. Nothing here may imply
// suitability below that; the house-style test enforces it.

import { SITE, type Template } from "./types";

const t = (
    id: string, title: string, note: string, subject: string, body: string,
): Template => ({ id: `education-${id}`, audience: "education", title, note, subject, body });

const SIGN = "— Suchismita Sen, Imotara";

export const EDUCATION_MORE: Template[] = [
    // ── student groups ──────────────────────────────────────────────────────
    t("first-year-transition", "First-year transition",
      "Time to the start of an academic year.",
      "The students who are quietly not coping yet",
      `Hello {{name|there}},

The first term hides a lot. Students who are struggling look identical to students who are settling in, and both are reluctant to say anything so early that it might define them.

By the time it surfaces, usually around the first assessment, it has been true for weeks.

Something private they can reach from their own phone, in their own language, tends to surface earlier than an appointment does.

More: ${SITE}

How large is your incoming cohort?

${SIGN}`),

    t("final-year", "Final year and leaving",
      "Time to the last term.",
      "The last term, and what comes after it",
      `Hello {{name|there}},

Final year carries two pressures at once: finishing well, and a future that is unresolved while everyone keeps asking about it.

Students manage the academic part with your support. The second part they mostly manage alone, because admitting uncertainty feels like admitting failure in front of peers who all seem to have plans.

More: ${SITE}

When does your final-year cohort start feeling it?

${SIGN}`),

    t("placement-season", "Placement season",
      "Strong for professional colleges.",
      "Placement season, for the ones who don't get picked",
      `Hello {{name|there}},

Placement season is public in a way few other pressures are. Everyone knows who has an offer, and the students without one are visibly without one for weeks.

Your placement cell handles the process. The part nobody owns is what it does to the students in the last rounds.

More: ${SITE}

When does your placement season run?

${SIGN}`),

    t("student-carers", "Students who are carers at home",
      "Often invisible to the institution.",
      "Students who go home to a second job",
      `Hello {{name|there}},

Some students leave campus and take up responsibility for a parent, a sibling, or a household. They rarely tell anyone, because it is simply their life rather than a circumstance.

It shows up as missed deadlines and absence, which gets read as disengagement.

More: ${SITE}

Would your institution know which students these are?

${SIGN}`),

    t("first-generation", "First-generation learners",
      "Respectful framing, no condescension.",
      "Students with nobody at home who has done this",
      `Hello {{name|there}},

A student whose parents did not attend college carries questions their classmates can simply ask at home — how much struggle is normal, whether this is worth it, what to do when it goes wrong.

Asking a teacher risks looking out of place. So they guess, and sometimes they leave.

More: ${SITE}

What share of your students are first in their family?

${SIGN}`),

    t("out-of-state", "Students from other states",
      "Language-led.",
      "Students a thousand kilometres from their language",
      `Hello {{name|there}},

Students from other states study in English, socialise in a language that is not theirs, and feel things in a third one that nobody on campus speaks.

Your counselling service, however good, is almost certainly not available in Odia or Manipuri.

Imotara covers 22 languages and replies in the one the student wrote in.

More: ${SITE}

Which states does your intake come from?

${SIGN}`),

    t("research-scholars", "Research scholars",
      "For universities with PhD programmes.",
      "The isolation of a long research degree",
      `Hello {{name|there}},

Research degrees are structurally lonely. Years of unsupervised time, a single supervisory relationship that may or may not work, and a peer group that is scattered.

Scholars are also adults with no obvious entitlement to student support, so they fall between the services.

More: ${SITE}

How many research scholars are enrolled with you?

${SIGN}`),

    t("distance-learners", "Distance and part-time learners",
      "Often entirely outside student services.",
      "The students who never come to campus",
      `Hello {{name|there}},

Distance and part-time students are usually working, often older, and almost always outside the reach of anything your campus services offer.

They are also carrying study on top of a job and a household, which is the group most likely to drop out quietly.

Something that needs no campus visit and no appointment reaches them.

More: ${SITE}

How many distance learners do you have?

${SIGN}`),

    t("repeat-year", "Repeating a year, or carrying backlogs",
      "Sensitive. Avoid implying failure.",
      "Students carrying a backlog",
      `Hello {{name|there}},

A student repeating a year or carrying papers has lost their cohort as well as time. The people they started with have moved on, and the shame of it does more damage than the academic setback.

They are statistically the most likely to leave, and the least likely to walk into a counselling office.

More: ${SITE}

How does your institution currently support that group?

${SIGN}`),

    t("scholarship-pressure", "Students on scholarships",
      "Specific and often overlooked.",
      "When your place depends on your marks",
      `Hello {{name|there}},

A student whose fees depend on maintaining a grade is doing the same degree under materially different conditions. A bad semester is not a disappointment, it is a financial emergency for their family.

They will not mention it, because the scholarship came with an implied obligation to be grateful.

More: ${SITE}

How many of your students are on conditional support?

${SIGN}`),

    t("athletes", "Students under performance pressure",
      "Sport, music, competitive programmes.",
      "Students whose identity is their performance",
      `Hello {{name|there}},

Students in competitive sport or performance carry an identity that is only as secure as their last result. An injury or a bad season is not a setback; it threatens who they understand themselves to be.

The coaching structure around them is built for performance, not for that.

More: ${SITE}

Do your competitive students have anything separate from coaching support?

${SIGN}`),

    t("after-an-incident", "After something happens on campus",
      "⚠️ Handle carefully. Never opportunistic.",
      "The weeks after something happens on campus",
      `Hello {{name|there}},

After a serious incident, institutions usually arrange counselling sessions for a week or two. Attendance is highest when the need is lowest, and lowest a month later when it surfaces.

⛔ I am not suggesting this replaces what you put in place, and I would not write about a specific incident. Only that the tail of these things is long and usually unresourced.

More: ${SITE}

What does your institution do beyond the first fortnight?

${SIGN}`),

    t("bullying", "Students being singled out",
      "Careful framing: not a reporting tool.",
      "Students who won't report it",
      `Hello {{name|there}},

Students rarely report being singled out, because reporting changes their situation in ways they cannot control and often makes the social cost worse.

⛔ Imotara is not a reporting channel and should never be presented as one — your safeguarding process is the only thing that can act.

What it can be is the place a student works out that it is happening and that it is not their fault, which is frequently what has to come before a report.

More: ${SITE}

What is your current route for a student who is not ready to report?

${SIGN}`),

    t("returning-after-absence", "Coming back after a long absence",
      "Illness, bereavement, suspension.",
      "The student coming back after months away",
      `Hello {{name|there}},

A student returning after a long absence faces the academic catch-up, which you support, and the social one, which nobody does. Their group has moved on and there is no way to explain where they went without explaining.

The first fortnight back decides whether they stay.

More: ${SITE}

How many students return from extended absence in a year?

${SIGN}`),

    t("long-commute", "Students with long commutes",
      "Specific to urban Indian institutions.",
      "Three hours of commuting, every day",
      `Hello {{name|there}},

Students commuting two or three hours each way are tired in a way that looks like disengagement. They also miss everything that happens outside timetabled hours, which is where most belonging is built.

The commute itself, though, is dead time they are already holding a phone through.

More: ${SITE}

How many of your students commute more than an hour?

${SIGN}`),

    t("sleep", "Sleep",
      "Light, practical, non-clinical.",
      "Nobody on your campus is sleeping enough",
      `Hello {{name|there}},

Students sleep badly for structural reasons — late study, early classes, shared rooms, phones — and the consequences get read as attitude problems.

⛔ Imotara does not treat sleep problems and should not be pitched as a sleep aid. But a mind that will not stop at one in the morning is something it can be talked to, which is sometimes the obstacle.

More: ${SITE}

Does sleep come up in your student feedback?

${SIGN}`),

    t("parental-expectation", "Parental expectation",
      "Very resonant in Indian education.",
      "Studying something your parents chose",
      `Hello {{name|there}},

A significant number of students are on a course somebody else selected, and cannot say so at home or on campus without it becoming a confrontation.

It surfaces as disengagement in second year, by which point the options have narrowed.

More: ${SITE}

Does that pattern show up in your dropout data?

${SIGN}`),

    t("choosing-a-stream", "Choosing a stream or major",
      "Decision-support framing.",
      "The choice they can't discuss at home",
      `Hello {{name|there}},

Stream and specialisation decisions get made under family pressure and peer comparison, rarely with a quiet hour to work out what the student actually wants.

Your counsellors can help, and are usually booked solid at exactly that time of year.

More: ${SITE}

When does that decision fall in your calendar?

${SIGN}`),

    t("social-media", "What they compare themselves to",
      "Avoid moralising about phones.",
      "Comparison, running continuously",
      `Hello {{name|there}},

Students compare themselves constantly, which is not new. What is new is that the comparison runs all night and against an edited version of everyone they know.

Telling them to use their phones less is advice they have heard and will not take.

Something on the same phone, that lets them say what the comparison is doing, is at least reachable.

More: ${SITE}

Does this come up in your pastoral conversations?

${SIGN}`),

    t("board-exam-cohort", "The board exam cohort",
      "Schools specifically.",
      "The months before the boards",
      `Hello {{name|there}},

The board exam year compresses a great deal into a few months, and the pressure is distributed unevenly — it lands hardest on students whose families have the most riding on it.

Your counsellor's capacity does not expand to meet it, and the hours it is most needed are late evenings.

🔴 Note on age: Imotara's minimum is 13, with parental consent required under 18. For a board cohort that means parental agreement is part of the rollout.

More: ${SITE}

Which cohort would be in scope for you?

${SIGN}`),

    // ── staff groups ────────────────────────────────────────────────────────
    t("hostel-wardens", "Hostel wardens and residential staff",
      "Often forgotten entirely.",
      "Your wardens are on duty at three in the morning",
      `Hello {{name|there}},

Wardens and residential staff handle the incidents that happen after everyone else has gone home — the homesickness, the arguments, occasionally much worse — with no colleague on shift and no debrief afterwards.

They are also staff, so student services do not cover them.

More: ${SITE}

How many residential staff do you have?

${SIGN}`),

    t("non-teaching-staff", "Non-teaching staff",
      "Rarely included in wellbeing provision.",
      "The staff who aren't teachers",
      `Hello {{name|there}},

Administrative, library, laboratory and support staff are usually outside both the student service and whatever is offered to faculty. They deal with distressed students at counters and have nowhere to put it.

Including them costs little and is noticed.

More: ${SITE}

Does your current provision extend beyond teaching staff?

${SIGN}`),

    t("counsellor-burnout", "Your counsellor",
      "⚠️ Must not imply replacing them.",
      "A question about your counsellor, not your students",
      `Hello {{name|there}},

Your counsellor carries the institution's distress, often alone, usually without clinical supervision, and frequently part-time.

⛔ Nothing I offer replaces them, and I would not suggest it. But reducing the volume of students who come to them for something that was never going to need a professional is one way to protect the capacity you have.

More: ${SITE}

Does your counsellor have supervision of their own?

${SIGN}`),

    t("faculty-workload", "Faculty workload",
      "Distinct from the teacher-wellbeing template.",
      "Teaching, research, admissions, and pastoral care",
      `Hello {{name|there}},

Faculty are expected to teach, publish, administer and notice when a student is struggling. The last one has no allocated hours and is the first to be dropped, which then shows up as a pastoral failure.

Supporting faculty is not separate from supporting students; it is upstream of it.

More: ${SITE}

How much pastoral load sits with your teaching staff?

${SIGN}`),

    t("training-teachers-to-notice", "Training staff to notice",
      "Positions Imotara as complementary, not a substitute.",
      "Teachers can notice. Then what?",
      `Hello {{name|there}},

Institutions often invest in training staff to spot a student in difficulty. That training works, and then creates a problem: the teacher notices, and the only thing to offer is a counselling service with a three-week wait.

Having something available immediately makes the noticing worth doing.

More: ${SITE}

Have your staff had that training?

${SIGN}`),

    t("what-not-to-ask-teachers", "What teachers should not be asked to do",
      "Slightly bold. Use with a warm contact.",
      "Your teachers are not counsellors",
      `Hello {{name|there}},

In a lot of institutions, pastoral care has quietly become the responsibility of whichever teacher the student happens to trust. That teacher has no training, no supervision and no boundary, and they carry it home.

It is not sustainable, and it is usually invisible until that teacher leaves.

More: ${SITE}

Who ends up holding this at your institution?

${SIGN}`),

    t("admissions-season-staff", "Admissions season",
      "Operational timing.",
      "Admissions season, from the staff side",
      `Hello {{name|there}},

Admissions season is weeks of high-volume work with anxious families, and the staff absorbing that are the least visible people in the institution.

It is predictable, which makes it preparable.

More: ${SITE}

When does your admissions peak fall?

${SIGN}`),

    // ── practical, procurement, process ────────────────────────────────────
    t("referral-pathway", "Fitting it to your referral pathway",
      "Process-led. Good for a counselling head.",
      "Where this would sit in your referral pathway",
      `Hello {{name|there}},

To be concrete about placement: Imotara sits before your first formal step, not inside the pathway.

A student uses it privately, works out what is actually wrong, and then either manages it or arrives at your counsellor already able to say what they need. The second outcome is the valuable one.

⛔ It is not a triage tool, it does not assess risk for you, and it must not be given a place in the pathway that implies it does.

More: ${SITE}

What does your current first step look like?

${SIGN}`),

    t("anonymous-use", "Why anonymous use matters here",
      "Addresses the main uptake lever.",
      "Students will not use anything that names them",
      `Hello {{name|there}},

The single feature that determines uptake in a school or college is whether a student has to identify themselves to begin.

Imotara needs no account. A student opens it and starts, and anonymous use keeps the conversation on their own device.

Everything else is secondary to that, in our experience.

More: ${SITE}

Would anonymous access be acceptable within your policies?

${SIGN}`),

    t("parental-consent-mechanics", "How parental consent would work",
      "Follow-up to the age template, more operational.",
      "How consent would work in practice",
      `Hello {{name|there}},

The practical version, since the policy answer alone is rarely enough.

Minimum age 13; under 18 requires a parent or guardian's agreement. Every user passes a first-use acceptance screen stating this, in 22 languages, and the acceptance is recorded.

⚠️ Being straight with you: we do not yet have *verifiable* parental consent — a mechanism proving the parent themselves agreed. That is planned for around January 2027. Institutions that need it today usually handle consent through their own admission paperwork.

More: ${SITE}/terms

How does your institution currently obtain consent for third-party services?

${SIGN}`),

    t("parent-asks-to-see", "When a parent asks to see it",
      "The hardest question schools ask. Answer honestly.",
      "What you'd tell a parent who asks to see the conversations",
      `Hello {{name|there}},

It will be asked, so here is the answer before you need it.

No. A parent cannot see their child's conversations, and neither can the institution. That view does not exist on the administrative side.

That is uncomfortable to defend to an anxious parent, and it is the reason the tool works at all — a student who believes it is readable will not write anything true in it.

⛔ If your institution needs parental visibility, this is the wrong product and I would rather say so now.

More: ${SITE}

Would that position be defensible at your institution?

${SIGN}`),

    t("device-policy", "Phones on campus",
      "Practical objection.",
      "If phones aren't allowed during the day",
      `Hello {{name|there}},

Many schools restrict phones during the day, which raises the obvious question.

Most use is outside school hours anyway — evenings, weekends, the hours when nothing you provide is open. If your students have devices at home, it reaches them.

For day-restricted campuses, shared computers in a library also work; it runs in a browser with no installation.

More: ${SITE}

What is your device policy during the day?

${SIGN}`),

    t("accreditation", "Accreditation and documentation",
      "For institutions preparing a review.",
      "Student wellbeing in your accreditation file",
      `Hello {{name|there}},

Accreditation reviews ask what provision exists for student wellbeing, and the honest answer for many institutions is one part-time counsellor and a policy.

To be clear about what we can and cannot evidence: we can show provision and adoption. We cannot provide individual outcome data, because that view does not exist.

If your reviewer requires outcome measurement at the individual level, we would not satisfy it.

More: ${SITE}

What does your review actually require?

${SIGN}`),

    t("summer-break", "The long break",
      "Seasonal timing.",
      "The months when campus support closes",
      `Hello {{name|there}},

Institutional support largely stops during the long break. For most students that is fine. For the ones whose difficulty is at home rather than at college, the break is the hardest stretch of the year and the only one with no service at all.

More: ${SITE}

Is anything available to your students over the break?

${SIGN}`),

    t("alumni", "Recent leavers",
      "Niche but occasionally compelling.",
      "The year after they leave you",
      `Hello {{name|there}},

The year after graduation is unstructured in a way institutions rarely consider their problem, and the support that existed ends on the day the course does.

Some institutions extend access for a year. It costs little and it is remembered.

More: ${SITE}

Do you keep any contact with recent leavers?

${SIGN}`),

    t("multilingual-rollout", "Rolling out across languages",
      "Operational detail for a multilingual campus.",
      "What a multilingual rollout actually involves",
      `Hello {{name|there}},

Nothing, practically. There is no language configuration to manage — the student writes in whichever of the 22 they want and the reply comes back in that one, including Roman script.

That matters because the alternative, translating your own material, is a project nobody finishes.

More: ${SITE}

Which languages would you most need covered?

${SIGN}`),

    t("what-success-looks-like-edu", "What a good result would look like",
      "Sets expectations before a pilot.",
      "What a successful term would look like",
      `Hello {{name|there}},

Worth agreeing in advance, because the wrong measure makes a good pilot look like a failure.

A good result is a meaningful share of students opening it unprompted and coming back. It is not every student using it, and it is not a measurable change in wellbeing scores in one term — nobody can honestly promise that.

If a fifth of a year group uses it without being told to, that is a real signal.

More: ${SITE}

What would convince you either way?

${SIGN}`),

    t("not-right-for-you-edu", "When it isn't a fit",
      "⚠️ Genuinely disqualifying. Builds trust.",
      "This might not suit your institution",
      `Hello {{name|there}},

Rather than keep writing, here is when this is the wrong choice.

If you need visibility of individual students' conversations, we will not provide it. If your students are under 13, they are below our minimum age. And if what you need is clinical provision on campus, this is not that and should not substitute for it.

If any of those apply, spend the budget elsewhere.

More: ${SITE}

Does one of those describe you?

${SIGN}`),

    t("after-pilot-edu", "After a pilot term",
      "Use when a pilot ends, including a poor one.",
      "What your students actually said",
      `Hello {{name|there}},

The pilot term has finished, so thank you for running it properly — that takes internal effort whatever the result.

If uptake was low I would rather understand why than persuade you otherwise. Low uptake in a school usually means students were not convinced it was private, and that is worth knowing regardless of what you do next.

More: ${SITE}

What did your students say about it?

${SIGN}`),

    t("final-note-edu", "A final note after no reply",
      "⚠️ The LAST message. Then stop.",
      "I'll stop writing after this",
      `Hello {{name|there}},

This is the last you will hear from me. I have written before without reply, which is a clear enough answer, and an academic calendar is an unforgiving thing to interrupt.

One thought worth leaving behind: whatever you put in place, check whether a student can reach it without being seen to. That single property predicts uptake more than any feature comparison, and it is usually what low usage is really telling you.

${SITE}

And if I have been writing to the wrong person, who should it be?

${SIGN}`),
];
