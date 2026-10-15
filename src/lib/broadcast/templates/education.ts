// src/lib/broadcast/templates/education.ts
// ⚠️ SALES OUTREACH, not a newsletter — see ORGANISATIONAL in ./types.ts
//
// 🔴 Imotara's minimum age is 13, with parental consent required under 18.
// Nothing in this file may imply it is suitable for younger children.

import { SITE, type Template } from "./types";

export const EDUCATION: Template[] = [
    {
        id: "education-wont-walk-in",
        audience: "education",
        title: "Students who won't walk into the counsellor's office",
        note: "Strongest opener for schools and colleges.",
        subject: "The students your counsellor never sees",
        body: `Hello {{name|there}},

Every institution with a counsellor has the same quiet problem: the students who most need the appointment are the least likely to make one.

It isn't usually about the counsellor. It's that walking into that office is a visible act in a building full of people who will notice.

Imotara is a private companion a student can use from their own phone, in their own language, without telling anyone. It is not therapy and never claims to be — but it gives a student somewhere to go first, and quite often it's what makes the second step to your counsellor possible.

More: ${SITE}

Roughly what proportion of your students do you think your counselling service actually reaches?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-exam-season",
        audience: "education",
        title: "Exam season",
        note: "Time this 4–6 weeks before board or semester exams.",
        subject: "The weeks before exams, and the week after results",
        body: `Hello {{name|there}},

Two moments in your calendar reliably produce distress: the weeks before exams, and the days after results.

Counselling capacity doesn't scale to meet either. The need arrives for everyone at once, and arrives loudest at night.

Imotara is available at 1am, in the student's own language, and asks nothing of your staff. It won't resolve what a qualified counsellor resolves — but it means a student at 1am has something other than their own spiralling.

More: ${SITE}

When does your institution feel this most — before the exams, or after the results?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-teacher-wellbeing",
        audience: "education",
        title: "Teacher and faculty wellbeing",
        note: "Leads with staff rather than students.",
        subject: "A question about your staff rather than your students",
        body: `Hello {{name|there}},

Conversations about wellbeing in education are nearly always about students. Teachers absorb a great deal of what students bring in, and are expected to have somewhere to put it.

Mostly they don't. Staff rooms are not private, and the institution's own counsellor is rarely someone a teacher feels able to approach.

Imotara exists outside that hierarchy entirely. Nobody in the institution knows who is using it.

More: ${SITE}

Does your institution currently offer staff anything separate from the student service?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-age-and-consent",
        audience: "education",
        title: "Age limits and parental consent",
        note: "Send early to schools — answers the first objection.",
        subject: "How we handle age and parental consent",
        body: `Hello {{name|there}},

If you're considering anything like this for students, the first question is usually about age and consent, so let me answer it before you ask.

- Imotara's minimum age is **13**
- Between 13 and 18, we require parental or guardian consent
- Where local law sets a higher age, the higher age applies
- Every user passes a first-use acceptance screen before they can use it

We'd rather state this plainly than let an institution discover it during a procurement review.

Our terms, in full: ${SITE}/terms

What age range would be in scope at your institution?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-hostel-students",
        audience: "education",
        title: "Residential and hostel students",
        note: "For boarding schools and residential campuses.",
        subject: "Students a long way from home",
        body: `Hello {{name|there}},

A residential student has the hardest version of this. The people who would normally notice something was wrong are several hundred kilometres away, and the weekly phone call home is the one conversation where everything is reported as fine.

Homesickness is treated as a phase to be endured rather than something anyone should need help with, so it goes unsaid.

Imotara is available in the student's home language — which, for a student far from home, matters more than it might sound.

More: ${SITE}

How many of your students are residential?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-counsellor-caseload",
        audience: "education",
        title: "One counsellor, several hundred students",
        note: "For institutions with a stretched counselling service.",
        subject: "One counsellor, how many students?",
        body: `Hello {{name|there}},

Most institutions we speak to have one counsellor, sometimes part-time, for several hundred students. The arithmetic doesn't work and everyone involved knows it.

The usual response is a waiting list, which quietly filters by persistence rather than need.

Imotara doesn't add counselling capacity — it isn't a counsellor. What it does is give the students who are managing somewhere to think, so your counsellor's limited hours reach the students who genuinely need a person.

More: ${SITE}

What's the ratio at your institution?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-multilingual-campus",
        audience: "education",
        title: "Multilingual campuses",
        note: "For institutions drawing students from many states.",
        subject: "Students who study in English and feel in Bengali",
        body: `Hello {{name|there}},

A campus drawing students from several states teaches in English, and students cope in English. But distress is rarely felt in a second language — it arrives in the one they grew up with, and that's the one they can't use with the counsellor.

Imotara understands 22 languages and replies in the one the student wrote in, including Roman script. A student can say the difficult thing the way they'd actually say it.

More: ${SITE}

How many languages are spoken across your student body?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-what-institution-sees",
        audience: "education",
        title: "What the institution can and cannot see",
        note: "Answers the procurement privacy question directly.",
        subject: "What your institution would and wouldn't see",
        body: `Hello {{name|there}},

Worth being precise about, because students will ask and the answer determines whether they use it.

The institution can see that licences are being used. It cannot see who said what, and conversations are not an administrative view we offer to anyone.

That limits what you can report. We think that's correct: a wellbeing tool a student believes is monitored is a wellbeing tool a student will not use honestly, and then it's worse than nothing.

More: ${SITE}

Does your institution have a reporting requirement that would conflict with that?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-pilot",
        audience: "education",
        title: "Proposing a pilot with one department",
        note: "Use after a positive exchange.",
        subject: "One department, one term",
        body: `Hello {{name|there}},

Rather than a decision for the whole institution, could we try one department for a single term?

We set it up, students use it or they don't, and at the end you have your own evidence. If uptake is poor, that is a real answer and better learned small.

Background: ${SITE}

Is there a department or year group where this would be worth trying — and who would need to agree to it?

— Suchismita Sen, Imotara`,
    },
    {
        id: "education-follow-up",
        audience: "education",
        title: "Follow-up when there's been no reply",
        note: "⚠️ Once only. No answer to this means stop.",
        subject: "One last note on student wellbeing",
        body: `Hello {{name|there}},

I wrote a while ago about student and staff wellbeing and haven't heard back — which usually means the timing is wrong rather than the idea, and an academic calendar is an unforgiving thing to interrupt.

I won't keep writing.

One thing worth leaving you with regardless: whatever you put in place, check whether students can reach it without being seen to. That single detail predicts uptake more than anything else we've observed.

If it becomes useful: ${SITE}

Is there someone else at the institution I should be writing to?

— Suchismita Sen, Imotara`,
    },
];
