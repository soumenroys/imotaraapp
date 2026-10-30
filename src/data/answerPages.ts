// The /answers/* pages — one question, answered properly.
//
// 🔑 WHY THESE AND WHY THIS SHAPE. Search Console, three months to 2026-10-16:
// 111 impressions across SEVEN queries, six of them the brand name. The site
// ranks at position 6.2 with a 17.1% CTR and is simply never shown. The single
// non-brand query Imotara has ever had an impression for was
// *"can an ai therapy app help with grief and loss processing"* — long,
// conversational, and about the reader's situation rather than about the
// product. These pages are that shape, deliberately.
//
// ⚠️ AND THEY ARE NOT MARKETING PAGES WITH QUESTIONS AS HEADINGS. The 16 blog
// posts and 11 /for/* pages, which ARE organised around what Imotara wants to
// say, have produced no measurable non-brand impressions between them. A page
// that answers the question and never mentions the product is worth more here
// than one that does the reverse — to the reader, to a search engine, and to an
// assistant deciding what to quote.
//
// 🔴 THE SAFETY RULES, enforced by src/__tests__/answerPagesAreSafe.test.ts:
//   · every page carries a `whenToGetHelp` list naming a REAL service
//   · no page claims to treat, diagnose or cure anything
//   · no page tells the reader what they "have"
//   · the crisis routing is country-aware, never India-only
//     ⇒ the lesson of imotaraapp 3ef1937, where an undetected country was shown
//       Indian numbers and ~140 countries were shown none at all
//
// ⛔ IF YOU ADD A PAGE: it must be answerable honestly by a wellness companion
// that is not therapy. "How do I treat my depression" is not; "why do I feel
// flat all the time" is. The difference is the whole editorial line.

export type AnswerSlug =
    | "grief-and-loss"
    | "anxious-at-night"
    | "lonely-around-people"
    | "overthinking-before-sleep"
    | "exam-stress"
    | "angry-all-the-time"
    | "do-i-need-therapy"
    | "crying-for-no-reason";

export interface AnswerSection {
    heading: string;
    body: string[];
}

export interface AnswerPage {
    slug: AnswerSlug;
    /** The <h1>. Phrased the way someone actually types or says it. */
    question: string;
    /** 2–4 sentences, first on the page. This is what an assistant quotes. */
    shortAnswer: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    sections: AnswerSection[];
    /** Small, concrete, doable now. ⛔ Never a treatment plan. */
    tryNow: string[];
    /** 🔴 Never empty, and always names a real service. */
    whenToGetHelp: string[];
    related: { href: string; label: string }[];
}

/** 🔴 Verbatim from src/lib/safety/crisisResources.ts — never typed from memory. */
const CRISIS =
    "If you are thinking of harming yourself, please contact a real service now. In India, Tele-MANAS on 14416 is free and open around the clock, or 112 for emergencies. Anywhere else, findahelpline.com lists the service for your country.";

const NOT_THERAPY =
    "Imotara is a wellness companion for self-reflection. It is not therapy, it does not diagnose, and it is not a crisis service.";

export const ANSWER_PAGES: Record<AnswerSlug, AnswerPage> = {
    "grief-and-loss": {
        slug: "grief-and-loss",
        question: "Can anything actually help with grief and loss?",
        shortAnswer:
            "Nothing makes grief shorter, and anyone promising that is selling something. What does help is having somewhere to put it — saying the thing out loud, or writing it down, on the days when there is no one to say it to. Grief is not a problem to be solved, and it does not move in a straight line.",
        metaTitle: "Can anything help with grief and loss? — Imotara",
        metaDescription:
            "An honest answer about grief: what helps, what does not, why it is not linear, and when to reach for a person rather than an app.",
        keywords: [
            "can an ai therapy app help with grief and loss processing",
            "how to deal with grief",
            "grief support app",
            "coping with loss of a loved one",
            "why does grief come in waves",
        ],
        sections: [
            {
                heading: "Grief does not move in stages, whatever you have read",
                body: [
                    "The five stages were never meant as a sequence to be worked through, and they were originally written about people facing their own death, not about those left behind. Grief arrives in waves, returns to things you thought were finished, and is often worst some months in, when everyone else has quietly moved on.",
                    "Nothing has gone wrong if you felt almost fine last week and cannot stand up today. That is the shape of it.",
                ],
            },
            {
                heading: "What actually seems to help",
                body: [
                    "Saying it. Out loud to someone, or written down where nobody will read it. The content matters less than it leaving your head, because grief kept entirely internal tends to circle.",
                    "Keeping ordinary structure — eating, sleeping roughly when you used to, going outside — not because it fixes anything, but because losing those makes everything else harder to carry.",
                    "Letting it be about the specific person. Generic comfort slides off. The useful thing is usually a particular memory, a particular regret, the particular way they said your name.",
                ],
            },
            {
                heading: "Where an app fits, and where it does not",
                body: [
                    "An app is available at three in the morning, which is when a lot of grief turns up, and it does not get tired of you returning to the same thing for the fifth time. That is a real use.",
                    NOT_THERAPY + " It cannot sit with you, and it will never have known the person you lost.",
                ],
            },
        ],
        tryNow: [
            "Write one sentence about them that you have not said to anyone. It does not have to be profound, and nobody has to see it.",
            "Name the feeling more precisely than 'sad' — guilty, relieved, furious, blank. Relief and anger are extremely common in grief and almost nobody admits to them.",
            "Decide one ordinary thing you will do today: a meal, a walk, a shower. One, not a list.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If months have passed and you cannot work, eat or get out of bed, that is worth taking to a doctor — not because you are grieving wrongly, but because grief and depression can look alike and one of them responds to treatment.",
            "If you find yourself drinking or using substances to get through the evenings, talk to someone before it becomes the method.",
        ],
        related: [
            { href: "/answers/crying-for-no-reason", label: "Crying for no reason?" },
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
        ],
    },

    "anxious-at-night": {
        slug: "anxious-at-night",
        question: "Why do I feel so anxious at night?",
        shortAnswer:
            "Because the distractions are gone. Anxiety is not worse at night so much as it is finally audible — there is no work, no noise and no one to talk to, so what was humming underneath all day becomes the only thing in the room. Tiredness also lowers your ability to argue back at it.",
        metaTitle: "Why do I feel anxious at night? — Imotara",
        metaDescription:
            "Why anxiety gets louder after dark, what actually helps in the moment, and when night-time anxiety is worth taking to a doctor.",
        keywords: [
            "why do i feel anxious at night",
            "night time anxiety",
            "anxiety attacks at night",
            "cant sleep because of anxiety",
            "why is my anxiety worse in the evening",
        ],
        sections: [
            {
                heading: "What is actually happening",
                body: [
                    "During the day you are busy, and being busy is a very effective way of not noticing how you feel. At night the noise stops. Nothing new has arrived — you have simply run out of things drowning it out.",
                    "Tiredness matters too. The part of you that says 'this is not as bad as it feels' is the first thing to go when you are exhausted, which is why a worry at midnight has a weight it will not have at nine the next morning.",
                    "And lying still with your eyes closed is, unhelpfully, the ideal condition for thinking.",
                ],
            },
            {
                heading: "Why 'just stop thinking about it' fails",
                body: [
                    "Trying not to think about something keeps it in the room, because checking whether you have stopped is itself thinking about it. The way out is usually sideways: give your attention something else to hold rather than ordering it to let go.",
                    "This is also why the worry at 2am feels urgent and unanswerable. It is not that the problem is worse; it is that you cannot act on it at 2am, so there is nowhere for the thought to go.",
                ],
            },
        ],
        tryNow: [
            "Write the worry down, in one line, on paper or on a phone. Externalising it reliably takes some weight out of it, partly because you stop holding it in place to avoid forgetting it.",
            "Breathe out for longer than you breathe in — four in, six or eight out, for about a minute. The long exhale is the part that matters.",
            "If you have been lying awake more than about twenty minutes, get up and sit somewhere dim for a while. Staying in bed trains your brain to treat the bed as the place where you worry.",
            "Name five things you can see in the room. Deliberately dull, and that is the point.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If this happens most nights for weeks, or you are frightened to go to bed, that is worth a GP appointment. Persistent night anxiety is common and very treatable, and the treatments work.",
            "If you wake gasping, with a racing heart or chest pain, get it checked physically first — panic and several ordinary medical causes feel identical from the inside.",
        ],
        related: [
            { href: "/answers/overthinking-before-sleep", label: "Overthinking before sleep" },
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
        ],
    },

    "lonely-around-people": {
        slug: "lonely-around-people",
        question: "Why do I feel lonely even when I am around people?",
        shortAnswer:
            "Loneliness is not about how many people are nearby. It is the gap between how known you feel and how known you want to feel, so a crowded room where nobody knows what your week was actually like can be lonelier than an empty one.",
        metaTitle: "Why do I feel lonely around people? — Imotara",
        metaDescription:
            "Loneliness is about being known, not about numbers. Why it happens in company, what narrows the gap, and when it is worth talking to someone.",
        keywords: [
            "why do i feel lonely around people",
            "lonely in a crowd",
            "feeling alone even with friends",
            "why do i feel disconnected from everyone",
        ],
        sections: [
            {
                heading: "The gap, not the number",
                body: [
                    "You can have company all day and still not have been asked a single question you wanted to answer honestly. Loneliness tracks the depth of contact, not the amount of it, which is why it survives a full calendar.",
                    "It is also why moving somewhere new, or into a big group, often makes it worse before it makes it better: more people, less history.",
                ],
            },
            {
                heading: "The part that keeps it going",
                body: [
                    "Loneliness quietly changes how you read people. It makes neutral faces look unfriendly and short replies look like rejection, which makes you withdraw slightly, which gets read as distance — and the thing confirms itself.",
                    "Knowing this does not dissolve it, but it is worth knowing that some of the evidence you are collecting is being generated by the loneliness rather than observed by you.",
                ],
            },
            {
                heading: "What narrows it",
                body: [
                    "Specificity. 'How are you' produces nothing; telling one person one true, slightly awkward thing about your week does more than ten pleasant conversations.",
                    "Repetition over intensity. Being known is built by the same low-stakes contact happening again — the regular walk, the weekly call — not by one big honest conversation.",
                    "Being the one who starts. Unfair, and still usually true: most people are waiting, and the lonelier you feel the less likely you are to be the one who reaches out.",
                ],
            },
        ],
        tryNow: [
            "Tell one person one specific true thing about your week. Not a summary — a detail.",
            "Message someone you have not spoken to in months, with no agenda and no apology for the gap.",
            "If saying it to a person is too much right now, say it somewhere first. Getting it into words at all is the step that makes saying it aloud possible later.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If you have been withdrawing for months, or have stopped answering people entirely, that is worth taking to a doctor or counsellor — long-term loneliness affects physical health, not only mood.",
            "If being around people has started to feel frightening rather than merely empty, that is a different thing and it responds well to help.",
        ],
        related: [
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
            { href: "/compare/ai-companion-vs-human-counsellor", label: "An app or a person?" },
        ],
    },

    "overthinking-before-sleep": {
        slug: "overthinking-before-sleep",
        // 🔑 30 Oct 2026, Search Console: "how to stop overthinking at night" ×14
        // and "what to do when you can't sleep because of overthinking" — the
        // words people use are "at night", so the question says it too.
        question: "How do I stop overthinking at night when I am trying to sleep?",
        shortAnswer:
            "You mostly do not stop it by trying to stop it. What works better is giving the thoughts somewhere to go before you lie down, and giving your attention something undemanding to hold once you have. Fighting the thinking keeps you awake more reliably than the thinking does.",
        metaTitle: "How to stop overthinking at night — Imotara",
        metaDescription:
            "Why thoughts get loud at bedtime, why suppressing them backfires, what to do when you have been lying awake for a while — and when sleeplessness is worth seeing a doctor about.",
        keywords: [
            "how to stop overthinking at night",
            "what to do when you can't sleep because of overthinking",
            "overthinking at night",
            "racing thoughts before sleep",
            "cant sleep mind wont stop",
            "how to quiet your mind at bedtime",
        ],
        sections: [
            {
                heading: "Why it happens exactly then",
                body: [
                    "Bed is the first point in the day with no input and no task. Your mind does not generate more thoughts at night; it simply has nothing else to do, so you finally hear the ones that were there all along.",
                    "Unfinished things are also noisier than finished ones. Anything you have not decided, written down or acted on keeps surfacing, because keeping it active is how you avoid forgetting it.",
                ],
            },
            {
                heading: "Why suppressing backfires",
                body: [
                    "Instructing yourself not to think about something requires monitoring whether you have stopped — which is thinking about it. Then you get annoyed at still being awake, and the annoyance is a second problem on top of the first.",
                    "Most of the distress of a sleepless night is not the thoughts. It is the arithmetic: how little sleep is left, how bad tomorrow will be.",
                ],
            },
            {
                heading: "If you have been lying awake a while",
                body: [
                    "If it feels like twenty minutes or more, get up. Go somewhere dim, do something dull — fold laundry, read something unexciting on paper — and go back to bed only when you feel sleepy. It sounds backwards, and it is one of the core parts of CBT-I: it stops the bed becoming the place where you lie and think.",
                    "Leave the clock alone while you do it. Checking the time restarts the arithmetic, and the arithmetic is what keeps you up.",
                ],
            },
            {
                heading: "If you wake in the small hours and it starts again",
                body: [
                    "Waking briefly in the night is normal; most people do it several times and never remember. What turns it into a bad night is the thinking that switches on with it.",
                    "Do not try to solve anything then. Problems look larger at that hour than they will at breakfast. If it is on tomorrow's list, it can wait there — and if it is not, putting it there is the one thing worth doing before you settle again.",
                ],
            },
        ],
        tryNow: [
            "Do a brain-dump an hour before bed — everything unresolved, in a list, no solutions required. The point is that the thought stops needing to hold itself open.",
            "If something has a next action, write the next action and nothing more. 'Email the landlord' is enough.",
            "In bed, give attention something dull to hold: counting backwards from 300 in threes, or describing a familiar walk in detail.",
            "Stop doing the arithmetic. Lying awake rested is not nothing, and one bad night is survivable — the panic about tomorrow costs more than the lost hour.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If you have slept badly most nights for a month or more, see a doctor and ask specifically about CBT-I, the talking treatment for insomnia — it outperforms sleeping tablets over the long run.",
            "If the thoughts keeping you awake are frightening rather than just busy, or you are using alcohol to get to sleep, say that to someone.",
        ],
        related: [
            { href: "/answers/anxious-at-night", label: "Anxious at night?" },
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
        ],
    },

    "exam-stress": {
        slug: "exam-stress",
        question: "How do I cope with exam stress?",
        shortAnswer:
            "Some stress before an exam is doing its job — it sharpens attention. It becomes a problem when it stops you working rather than helping you work. The two most useful levers are making the work smaller and specific, and protecting sleep, which is the first thing students give up and the one that costs most.",
        metaTitle: "How to cope with exam stress — Imotara",
        metaDescription:
            "What helps with exam stress and what quietly makes it worse — including the thing students sacrifice first and should not.",
        keywords: [
            "how to cope with exam stress",
            "exam anxiety help",
            "stressed about exams cant study",
            "board exam stress",
            "how to study when anxious",
        ],
        sections: [
            {
                heading: "The difference between useful and useless stress",
                body: [
                    "Alertness before an exam is helpful. The unhelpful version is the one that makes you reread the same page, avoid starting, or revise the subject you already know because it is the comfortable one.",
                    "If you are avoiding, the problem is usually not laziness or lack of care. It is that the task in your head is too big to start — 'revise chemistry' has no beginning.",
                ],
            },
            {
                heading: "Sleep is not the thing to cut",
                body: [
                    "Memory consolidates during sleep, so the hours you take from it are partly taken from the revision you already did. A student who sleeps and revises four hours generally does better than one who does not sleep and revises seven.",
                    "The all-nighter before a paper is the single most reliably counterproductive thing in this entire subject.",
                ],
            },
            {
                heading: "On the pressure from outside",
                body: [
                    "A great deal of exam stress is not about the exam. It is about what a result is supposed to prove, and to whom — and in many families that pressure is real and not imagined.",
                    "It is worth separating the two in your own head, even if you cannot change the external part. 'I need to do well' and 'I will be a disappointment' are different sentences and the second one does not help you revise.",
                ],
            },
        ],
        tryNow: [
            "Shrink the next task until it has an obvious first move: not 'revise chemistry' but 'do three questions from chapter four'.",
            "Work in a fixed block — 25 or 45 minutes — then actually stop. A finite block is much easier to start than an open-ended evening.",
            "Revise the thing you are worst at first, while you have the most patience. The comfortable topic is a hiding place.",
            "Keep sleep. Protect it ahead of the last hour of revision, especially the night before.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If you cannot eat or sleep, or you are having panic attacks, tell someone at school or university — there are usually adjustments available, and asking is not an admission of failure.",
            "If the thought of a result feels unsurvivable, say that to a person today rather than carrying it alone. That thought is far more common among students than anyone admits, and it is not a reliable narrator.",
        ],
        related: [
            { href: "/answers/overthinking-before-sleep", label: "Overthinking before sleep" },
            { href: "/for/young-people", label: "Imotara for students" },
        ],
    },

    "angry-all-the-time": {
        slug: "angry-all-the-time",
        question: "Why am I angry all the time?",
        shortAnswer:
            "Constant anger is usually not really about the things setting it off. It is most often exhaustion, or a boundary that has been crossed for a long time, or another feeling that has nowhere acceptable to go. Anger is loud, which is why it gets heard first and asked about last.",
        metaTitle: "Why am I angry all the time? — Imotara",
        metaDescription:
            "What constant irritability usually means, why the trigger is rarely the cause, and when anger is worth taking to someone.",
        keywords: [
            "why am i angry all the time",
            "constant irritability",
            "why do i get angry so easily",
            "anger over small things",
        ],
        sections: [
            {
                heading: "The trigger is rarely the cause",
                body: [
                    "If small things are producing large reactions, the small thing is not what you are reacting to. It is the last item on a pile you have been carrying without putting down.",
                    "Tiredness is the most underrated cause by a long way. Being chronically short of sleep removes almost all of the gap between feeling something and acting on it.",
                ],
            },
            {
                heading: "What anger is often covering",
                body: [
                    "Frequently: fear, humiliation, grief, or being treated unfairly somewhere you cannot afford to object. Anger is permitted in places where those are not, so it arrives wearing their clothes.",
                    "It is also a boundary signal. Persistent anger at one particular person or situation is usually information about something you have been tolerating, and the useful question is what you have been putting up with rather than why you are so irritable.",
                ],
            },
            {
                heading: "The thing nobody says",
                body: [
                    "Being angry a lot is frightening when you did not used to be, and the fear of becoming someone you do not like makes people hide it, which makes it worse.",
                    "Noticing it and asking what it is pointing at is not a weakness. It is the only thing that reliably reduces it.",
                ],
            },
        ],
        tryNow: [
            "When it rises, name it specifically before you respond — 'I am humiliated', 'I am exhausted', 'this is unfair'. The naming creates the gap.",
            "Check sleep and food before you look for anything deeper. Both are boring and both are frequently the answer.",
            "Ask what you have been putting up with. Write the answer down, even if you cannot change it yet.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If you have hurt someone, frightened someone, or come close to it, get help now rather than after the next time. Anger that has become behaviour needs a person, not an app, and services exist for exactly this.",
            "If you cannot remember what you did while angry, or you are drinking around it, that is worth a doctor's appointment.",
        ],
        related: [
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
            { href: "/compare/ai-companion-vs-human-counsellor", label: "An app or a person?" },
        ],
    },

    "do-i-need-therapy": {
        slug: "do-i-need-therapy",
        question: "How do I know if I need therapy?",
        shortAnswer:
            "The usual test is not how bad it feels but how long it has lasted and how much it is costing you. If something has been going on for weeks rather than days, and it is affecting your sleep, work or relationships, that is enough reason — you do not need to be in crisis to qualify, and waiting until you are is the common mistake.",
        metaTitle: "How do I know if I need therapy? — Imotara",
        metaDescription:
            "A plain test for whether to see someone, what the first appointment is actually like, and why you do not need to be in crisis to go.",
        keywords: [
            "how do i know if i need therapy",
            "should i see a therapist",
            "do i need counselling",
            "when to get mental health help",
            "am i depressed or just sad",
        ],
        sections: [
            {
                heading: "The test most people use is the wrong one",
                body: [
                    "Almost everyone asks 'is it bad enough?' — and almost everyone decides it is not, because they can think of someone worse off. That comparison is not a diagnostic and it keeps people waiting for years.",
                    "The better questions: how long has this gone on, and what is it costing? Weeks rather than days, plus a cost to sleep, work or the people around you, is reason enough.",
                ],
            },
            {
                heading: "What a first appointment is actually like",
                body: [
                    "Largely you talk and they ask questions. You will not be sectioned, medicated on the spot, or told you are broken. You can say you do not know where to start, and that is a normal beginning.",
                    "You are also allowed to decide a particular therapist is not right for you. Fit matters more than credentials and it is reasonable to try someone else.",
                ],
            },
            {
                heading: "If you cannot get to therapy right now",
                body: [
                    "Cost and waiting lists are real, and telling someone to 'just see a professional' is not always usable advice. What remains available: a GP, who is often the fastest route in; free helplines, which exist for more than emergencies; and writing things down, which is not treatment but is not nothing.",
                    NOT_THERAPY + " It is somewhere to put things in the meantime, and the meantime can be long.",
                ],
            },
        ],
        tryNow: [
            "Write down how long it has been going on. Not how bad — how long. That is the number that decides.",
            "List what it is costing: sleep, work, people. Seeing it written down tends to settle the question.",
            "If you decide yes, make the first contact a small one — a GP appointment, or a helpline, not a search for the perfect therapist.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If you have been low, flat or anxious for more than two weeks in a way that is not shifting, see a doctor. Two weeks is the common clinical threshold and it is much shorter than most people assume.",
            "If you are using alcohol or anything else to manage how you feel, mention that specifically — it changes what help is appropriate.",
        ],
        related: [
            { href: "/compare/ai-companion-vs-therapy", label: "Is an AI companion the same as therapy?" },
            { href: "/answers/crying-for-no-reason", label: "Crying for no reason?" },
        ],
    },

    "crying-for-no-reason": {
        slug: "crying-for-no-reason",
        question: "Is it normal to cry for no reason?",
        shortAnswer:
            "Yes, and there is usually a reason — it is simply not the one in front of you. Crying that arrives at a trivial moment is generally a backlog finding the first available exit, which is why it so often happens over an advert or a kind word rather than over the actual thing.",
        metaTitle: "Is it normal to cry for no reason? — Imotara",
        metaDescription:
            "Why tears turn up at trivial moments, what a backlog of unfelt feeling does, and when frequent crying is worth seeing a doctor about.",
        keywords: [
            "crying for no reason",
            "why do i cry so easily",
            "cant stop crying",
            "is it normal to cry randomly",
            "crying over small things",
        ],
        sections: [
            {
                heading: "The reason is usually just not the obvious one",
                body: [
                    "Feelings that get postponed do not disappear; they wait. When something finally lowers your guard — tiredness, a piece of music, somebody being unexpectedly kind — the whole backlog can come out at once, attached to whatever happened to be in the room.",
                    "This is why it so often feels disproportionate and slightly embarrassing. The trigger genuinely is trivial. The contents are not.",
                ],
            },
            {
                heading: "Holding it in is not strength",
                body: [
                    "Crying is a release mechanism, not a malfunction. People who have been coping well for a long time often cry at odd moments precisely because the coping has been expensive.",
                    "If you have been told you are too sensitive, consider that you may simply have less left in reserve than the people telling you that.",
                ],
            },
        ],
        tryNow: [
            "Let it finish rather than stopping it. It usually passes faster when it is not being fought.",
            "Afterwards, ask what the week has actually been like. The answer is often immediately obvious once the crying has made room for it.",
            "Check the boring causes too: sleep, illness, hormonal cycles and medication changes all lower the threshold.",
        ],
        whenToGetHelp: [
            CRISIS,
            "If it is happening most days for a couple of weeks, or you cannot identify any backlog it might belong to, see a doctor — persistent tearfulness is one of the more common early signs of depression and it treats well.",
            "If it is accompanied by not being able to feel anything else, that is worth mentioning specifically.",
        ],
        related: [
            { href: "/answers/do-i-need-therapy", label: "Do I need therapy?" },
            { href: "/answers/grief-and-loss", label: "Grief and loss" },
        ],
    },
};

export const ANSWER_SLUGS = Object.keys(ANSWER_PAGES) as AnswerSlug[];

export function answerPageFor(slug: string): AnswerPage | undefined {
    return ANSWER_PAGES[slug as AnswerSlug];
}
