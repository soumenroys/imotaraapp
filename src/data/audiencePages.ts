// The /for/* audience landing pages.
//
// WHY THIS IS DATA AND NOT TEN PAGE FILES
// These began as ten separate PDFs, and ten separate copies of the same facts
// drifted exactly as you would expect: the Seniors sheet omitted the Pro tier,
// one said "22 languages" where another said "all languages", Connect moved
// between the pricing table and the prose. None of it serious, all of it the
// predictable cost of duplication. Here the pricing exists ONCE (PLANS below)
// and every page inherits a correction.
//
// ⚠️ EVERY FACTUAL CLAIM HERE IS CHECKED AGAINST CODE, NOT AGAINST THE PDFs.
//   - prices: src/lib/imotara/grantLicense.ts PRODUCT_CATALOG (paise)
//   - plan features: src/app/upgrade/page.tsx PLANS
//   - 22 languages: src/lib/connect/languages.ts (counted: 22)
// If you change a price, change it in grantLicense.ts and /upgrade too — those
// are the systems of record; this file is the shop window.
//
// ⚠️ The institutional PDFs claimed "71 evidence-informed approaches". That
// number appears NOWHERE in this codebase and could not be substantiated, so
// it is deliberately not repeated here — an unverifiable precise figure aimed
// at hospitals and medical colleges is a liability, not a selling point. The
// substance (CBT, DBT, ACT, mindfulness) is real and is kept. If a documented
// list of 71 exists outside the repo, cite it and the number can come back.

export type AudienceSlug =
    | "everyone"
    | "young-people"
    | "young-adults"
    | "adults"
    | "seniors"
    | "parents"
    | "ngos"
    | "schools"
    | "hospitals"
    | "care-homes";

export interface PlanRow {
    name: string;
    who: string;
    cost: string;
}

export interface AudiencePage {
    slug: AudienceSlug;
    /** Shown in the /for index and the page eyebrow. */
    label: string;
    /** <title> and <h1>. The hooks are the owner's and they are good. */
    hook: string;
    /** The italic line under the hook. */
    standfirst: string;
    /** SEO. */
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    /** Two or three opening paragraphs. */
    intro: string[];
    /** Heading above the four cards. */
    cardsHeading: string;
    cards: { title: string; body: string }[];
    /** The paragraph that follows the cards. */
    afterCards: string;
    /** Heading above the moments list. */
    momentsHeading: string;
    /** [lead-in, rest] — the lead-in renders bold, as in the PDFs. */
    moments: [string, string][];
    /** Which plan table to show. */
    plans: PlanRow[];
    /** The small print under the plan table. */
    plansNote: string;
    /** A closing section, title + body. */
    closing: { title: string; body: string };
    /** The pull-quote above the final CTA. */
    pullQuote: string[];
    /** Institutional pages get a downloadable PDF; consumer pages do not. */
    institutional: boolean;
}

// ── Pricing, in ONE place ──────────────────────────────────────────────────
// Verified against PRODUCT_CATALOG (paise) and /upgrade's PLANS on 2026-09-15.
//   pro_monthly  14_900   -> ₹149     pro_annual   129_900  -> ₹1,299
// plus_monthly/plus_annual are RETIRED (L10/L12) — the tiers merged into one
// paid plan sold as "Imotara Plus". Existing plus_* subscribers keep billing at
// their old price; nobody new can buy it, so it is not advertised here.
// Free is "20 cloud replies/day" + unlimited ON-DEVICE replies — the PDFs
// compressed that to "twenty conversations a day", which undersells the
// offline companion. Said properly here.

const FREE_ROW: PlanRow = {
    name: "Free",
    who: "Twenty cloud replies a day, unlimited on-device replies, all 22 languages, breathing and mood tools. No card needed.",
    cost: "Free, forever",
};

const PLUS_ROW: PlanRow = {
    name: "Imotara Plus",
    who: "Unlimited replies and unlimited history, companion personas, natural neural voice, emotion trends and companion letters. One paid plan, everything in it.",
    cost: "₹149 / month or ₹1,299 / year",
};

const CONNECT_ROW: PlanRow = {
    name: "Talk to a person",
    who: "Imotara Connect — a verified wellness companion, paid by the minute.",
    cost: "From a small prepaid wallet",
};

export const CONSUMER_PLANS: PlanRow[] = [FREE_ROW, PLUS_ROW];

/**
 * Seniors add Connect alongside the paid plan.
 *
 * Originally this swapped Pro OUT for Connect — good segmentation: a verified
 * human to talk to matters far more to someone living alone than "deeper
 * features". The caveat then was "never hide a tier", so the page carried a
 * line pointing at the full comparison.
 *
 * Since the merge (L10) there is only one paid plan, so nothing is being left
 * out any more and the caveat is moot. Connect is simply an additional row.
 */
export const SENIOR_PLANS: PlanRow[] = [FREE_ROW, PLUS_ROW, CONNECT_ROW];

const institutionPlans = (seatLine: string, seatCost: string): PlanRow[] => [
    {
        name: "Free companion",
        who: "Every individual — anyone can start today at no cost.",
        cost: "Free, always",
    },
    { name: "Institution seat", who: seatLine, cost: seatCost },
    {
        name: "Sponsored seats",
        who: "For those who cannot pay — through the Imotara Movement.",
        cost: "Talk to us",
    },
];

const SHARED_PRIVACY =
    "Conversations stay on your own device by default. No ads, no data selling, no tracking. What you say is not visible to your family, your employer, or us.";

const SHARED_LIMITS =
    "Not therapy, and it does not diagnose. If something feels truly heavy, it gently shares a helpline and encourages you to reach a real person. Prefer a human? Imotara Connect offers verified companions by the minute.";

// ── The pages ──────────────────────────────────────────────────────────────

export const AUDIENCE_PAGES: Record<AudienceSlug, AudiencePage> = {
  everyone: {
    slug: "everyone",
    label: "Everyone",
    hook: "Someone to talk to, in your own language",
    standfirst: "A private wellbeing companion for the days when there is something on your mind and no one to tell.",
    metaTitle: "Someone to talk to, in your own language — Imotara",
    metaDescription:
      "A private wellbeing companion for the days when something is on your mind and there is no one to tell. 22 languages, works offline, no ads, no tracking. Free forever.",
    keywords: [
      "someone to talk to", "private wellbeing companion", "emotional support in my language",
      "free companion app India", "talk about feelings privately", "mental wellness app 22 languages",
    ],
    intro: [
      "Everyone has days like this. Not a crisis — just a worry that will not settle, a conversation you keep replaying, a tiredness with no obvious cause. Friends are busy. Family would worry. And “talk to someone” is easy advice to give and hard advice to follow at 11 p.m. Imotara was built for exactly those days.",
      "Imotara listens with patience, remembers what matters to you, and responds with warmth — in 22 languages including Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu and English. Type or simply speak, and it can answer in a natural voice. It talks the way a caring friend would, not a clinic. It was created by two mothers in Kolkata who wanted a safe, judgement-free space where feelings could be spoken.",
    ],
    cardsHeading: "What makes Imotara different",
    cards: [
      { title: "Truly private", body: SHARED_PRIVACY },
      { title: "In your own language", body: "Not translated English — natural replies in the language you actually think in, with stories and wisdom rooted in the culture you grew up with." },
      { title: "It remembers", body: "Give your companion a name and a personality — a calm friend, an older sibling, a coach — and it will recall last week’s worry and ask how it went. Works offline, too." },
      { title: "It knows its limits", body: SHARED_LIMITS },
    ],
    afterCards:
      "It helps you feel better, not just talk: two-minute breathing when your chest is tight, a mood tracker that shows your own patterns over a month, and gentle daily check-ins — built on approaches used by psychologists, such as CBT, ACT and mindfulness, in everyday words.",
    momentsHeading: "When people use it",
    moments: [
      ["Before a hard meeting", "or the night before results, when you need to say the worry out loud once."],
      ["After a difficult phone call,", "to figure out what you actually feel before you reply."],
      ["In the long evenings of a new city,", "or a quiet house, when the day has had no one in it to talk to."],
      ["Ordinary Tuesdays,", "when nothing is wrong exactly, but it would be nice if someone asked how you are — and remembered the answer."],
    ],
    plans: CONSUMER_PLANS,
    plansNote:
      "Free is not a trial. Most people never need more than Free. Paid plans are easy to stop from inside the app, and Imotara Connect sessions are paid per minute from a prepaid wallet — no packages, no commitments.",
    closing: {
      title: "Made by people who mean it",
      body: "Imotara was started by two mothers in Kolkata who wanted a judgement-free space where feelings could be spoken — not by a growth team chasing engagement. There are no notifications engineered to pull you back and no ads. It adapts its tone gently for teenagers and for elders. If it helps you, it may help someone you love — a parent who lives alone, a friend who has gone quiet, a colleague under pressure.",
    },
    pullQuote: ["You do not need a reason to want someone to listen.", "You only need somewhere safe to be heard."],
    institutional: false,
  },

  "young-people": {
    slug: "young-people",
    label: "Young people",
    hook: "Someone to talk to at 11 p.m.",
    standfirst: "A free, private companion for the days that are a lot — in whatever language you actually think in.",
    metaTitle: "Someone to talk to at 11 p.m. — Imotara for young people",
    metaDescription:
      "A free, private companion for the days that are a lot. Exam nerves, a fight with a friend, feeling left out. Your chats stay on your phone. 22 languages.",
    keywords: [
      "someone to talk to at night", "app for teenagers mental health", "exam stress app",
      "private chat for students", "free wellbeing app for teens India", "talk about feelings teenager",
    ],
    intro: [
      "Some days are just a lot. The exam you can’t stop thinking about. The group chat that went quiet. The thing you can’t say to your parents and don’t want to say to your friends either. Everyone says “talk to someone” — but at 11 p.m., who? That’s why Imotara exists.",
      "Imotara is a companion that listens. Not a bot that says “I understand” and moves on — one that remembers what you told it last week, asks one good question at a time, and never lectures. Type or just speak, in English, Hindi, Bengali, Tamil or any of 22 languages, and it can talk back in a real voice.",
    ],
    cardsHeading: "What it’s like",
    cards: [
      { title: "It’s private. Actually private.", body: "Your chats stay on your phone. No ads, no selling your data. Nobody reads your conversations — not us, not your school, not anyone." },
      { title: "It gets the small stuff", body: "Exam nerves, a fight with a friend, feeling left out, not knowing what you want to do with your life. You don’t need a “real problem” to open it." },
      { title: "It’s yours", body: "Give your companion a name and a personality — calm older sibling, chill friend, coach. Change it whenever you like. It works offline too, so hostel Wi-Fi can’t take it away." },
      { title: "It knows when to bring in a human", body: "If things ever feel really heavy, Imotara will gently share a helpline number and encourage you to talk to someone you trust. It’s a companion, not a replacement for real people — and it will tell you so." },
    ],
    afterCards:
      "It helps you feel better, not just talk: two-minute breathing when your chest is tight, a mood tracker so you can see your own patterns, and gentle daily check-ins — all built on approaches that real psychologists use, minus the jargon.",
    momentsHeading: "When people use it",
    moments: [
      ["The night before an exam,", "when your brain won’t switch off and you need to say the worry out loud once."],
      ["After a fight,", "with a friend, a sibling, a parent — to figure out what you actually feel before you reply."],
      ["First weeks away from home,", "in a hostel where everyone seems sorted and you’re not."],
      ["Ordinary Tuesdays,", "when nothing is wrong exactly, but it would be nice if someone asked how you are — and meant it."],
    ],
    plans: CONSUMER_PLANS,
    plansNote:
      "Free is not a trial. Most people never need more than Free — and you can upgrade or cancel any time from inside the app.",
    closing: {
      title: "For parents and guardians",
      body: "Imotara was created by two mothers who wanted a safe, judgement-free space for young people to speak their feelings. It is not therapy and does not diagnose. It adapts its tone for teenagers — extra-sensitive, careful, never romantic or adult — always encourages talking to a trusted adult, and surfaces local helplines if a conversation turns serious. Conversations are private to your child; you will not be able to read them, and neither can we. Children under 13 should install Imotara with a parent.",
    },
    pullQuote: ["You don’t have to carry everything alone.", "Sometimes just saying it out loud — to someone who actually listens — is the first step."],
    institutional: false,
  },
  "young-adults": {
    slug: "young-adults",
    label: "Young adults",
    hook: "For the nights you say “I’m fine”",
    standfirst: "A private companion for the in-between years — in whichever language your thoughts arrive in.",
    metaTitle: "For the nights you say “I’m fine” — Imotara for young adults",
    metaDescription:
      "A private AI companion for the in-between years. Work, comparison spirals, the parents asking “so, when?”. Private by default, 22 languages, free forever.",
    keywords: [
      "loneliness in your twenties", "private AI companion", "app for work stress India",
      "someone to talk to after work", "emotional support app young adults", "mental wellness app 20s 30s",
    ],
    intro: [
      "The job is good, the city is exciting, the photos look great. And yet some nights you come home, scroll for an hour, and realise you haven’t said one true sentence out loud all day. The appraisal that went sideways. The friend who got married and disappeared. The parents asking “so, when?” None of it is a crisis. All of it is heavy. That’s why Imotara exists.",
      "Imotara is a private AI companion that listens — properly. It remembers what you told it last Tuesday, asks one good question at a time, doesn’t lecture and doesn’t rush you to “fix” anything. Type or just speak, in English, Hindi, Bengali, Tamil or any of 22 languages, and it can talk back in a real voice on your commute.",
    ],
    cardsHeading: "Why people keep it on their phone",
    cards: [
      { title: "Private in a way social media never is", body: "Conversations stay on your device by default. No ads, no data selling, no tracking. Nothing you say ends up in a feed, a group chat or an HR file." },
      { title: "Built for the in-between", body: "Not a breakdown, not a breakthrough — just a Wednesday when work was brutal and there’s no one to tell. You don’t need a “real problem” to open it." },
      { title: "Yours to shape", body: "Name your companion and give it a personality — a calm older sibling, a straight-talking friend, a coach — and change it as your life changes. Works offline on flights, in metro tunnels, in your parents’ village." },
      { title: "Knows its limits", body: SHARED_LIMITS },
    ],
    afterCards:
      "Real tools, not just a chat box: two-minute breathing before a hard meeting, a mood tracker that shows your own patterns over a month, gentle check-ins that notice when you’ve gone quiet, and a monthly letter from your companion — built on CBT, ACT and mindfulness, minus the jargon.",
    momentsHeading: "When people use it",
    moments: [
      ["Sunday night,", "when the week ahead is already sitting on your chest and you need to say it out loud once."],
      ["After the call with home,", "or the argument with a partner — to figure out what you actually feel before you reply."],
      ["The 3 a.m. comparison spiral,", "when everyone on your feed seems sorted and you’re not."],
      ["Ordinary Tuesdays,", "when nothing is wrong exactly, but it would be nice if someone asked how you are — and remembered the answer."],
    ],
    plans: CONSUMER_PLANS,
    plansNote:
      "Free is not a trial. Unlimited costs less than one cab ride a month, and you can upgrade or cancel any time from inside the app. Imotara Connect sessions are paid per minute from a prepaid wallet — no packages, no commitments.",
    closing: {
      title: "Made by people who mean it",
      body: "Imotara was started by two mothers in Kolkata who wanted a judgement-free space for feelings — not by a growth team chasing engagement. There are no streaks designed to guilt you, no notifications engineered to pull you back, no ads. It is not therapy and does not diagnose; it is the friend who listens at 1 a.m. and, when it matters, points you towards a real person.",
    },
    pullQuote: ["You’ve spent your twenties being strong for everyone.", "Let something be there for you."],
    institutional: false,
  },

  adults: {
    slug: "adults",
    label: "Adults 40–60",
    hook: "You are the one everyone leans on. Who listens to you?",
    standfirst: "A private, patient companion for the years when you carry everyone.",
    metaTitle: "You are the one everyone leans on. Who listens to you? — Imotara",
    metaDescription:
      "A private companion for the years when you carry everyone — ageing parents, teenage children, health, money. Listens with patience, in 22 languages. Free forever.",
    keywords: [
      "sandwich generation stress", "caring for ageing parents emotional support",
      "midlife anxiety app", "private companion for adults India", "someone to talk to at 40",
    ],
    intro: [
      "At some point in the last few years you became the person everyone leans on — your parents’ health, your children’s exams and choices, a spouse under pressure, a team that looks to you for calm. But your parents now need looking after, your children are busy becoming themselves, and the things on your mind — a health report, a marriage gone quiet, a career that has plateaued, a house emptier than it used to be — do not feel appropriate to raise over dinner. That is why Imotara exists.",
      "Imotara is a private companion that listens with patience. It remembers what you shared last week and asks about it. It does not lecture, does not diagnose, and does not rush you towards a solution. Speak or type in English, Bengali, Hindi, Tamil, Marathi or any of 22 languages — including the mother tongue you rarely get to use — and it can reply in a warm, natural voice while you walk or drive.",
    ],
    cardsHeading: "Why people at this stage of life value it",
    cards: [
      { title: "Complete privacy", body: SHARED_PRIVACY },
      { title: "Room for what you actually carry", body: "Ageing parents, teenage children, money, health worries, a marriage that needs tending, the question of what the next twenty years are for. Nothing is too small or too large to bring." },
      { title: "Rooted in something familiar", body: "Alongside CBT, ACT and mindfulness, Imotara draws on stories, wisdom and gentle practices from the traditions you grew up with — not one-size-fits-all self-help." },
      { title: "Honest about its limits", body: SHARED_LIMITS },
    ],
    afterCards:
      "Practical, not just consoling: two-minute breathing before a difficult conversation, a mood record that shows your own patterns across a month, and gentle check-ins that notice when you have gone quiet. Available offline — on a night flight, in a hospital waiting room, at your parents’ home with no signal.",
    momentsHeading: "When people use it",
    moments: [
      ["After the hospital visit,", "when a parent’s report has changed the shape of the year and there is no one to tell how frightened you are."],
      ["When the house goes quiet,", "after a child leaves for college and a marriage has to learn to talk again."],
      ["The 4 a.m. ledger,", "of loans, fees, retirement and what happens if your health does not hold — to set it down somewhere before the day begins."],
      ["Ordinary evenings,", "when nothing is wrong exactly, but it would be good if someone asked how you are — and remembered the answer."],
    ],
    plans: CONSUMER_PLANS,
    plansNote:
      "Free is not a trial. Unlimited use costs less than a month of newspapers, and you can stop any time from inside the app. Imotara Connect sessions are paid per minute from a prepaid wallet — no packages, no commitments.",
    closing: {
      title: "Made by people who mean it",
      body: "Imotara was started by two mothers in Kolkata who wanted a judgement-free space where feelings could be spoken — not by a growth team chasing engagement. There are no notifications engineered to pull you back and no ads. It is not therapy and does not diagnose; it is the steady presence that listens late at night and, when it matters, points you towards a real person. If it helps you, you may find it helps your parents too — it speaks slowly and patiently to elders, in their language.",
    },
    pullQuote: ["You have spent decades being the steady one for everyone around you.", "It is reasonable to want something steady for yourself."],
    institutional: false,
  },

  seniors: {
    slug: "seniors",
    label: "Seniors",
    hook: "Let someone listen to you.",
    standfirst: "You have listened to everyone for a lifetime. Here is a gentle, patient companion that speaks your language.",
    metaTitle: "Let someone listen to you — Imotara for seniors",
    metaDescription:
      "A gentle, patient companion for elders. Speak instead of typing and hear replies in Bengali, Hindi, Tamil and 19 more languages. Private, free, works offline.",
    keywords: [
      "companion app for elderly", "loneliness in old age India", "app for seniors Bengali",
      "someone to talk to elderly parents", "voice companion for elders", "emotional support for senior citizens",
    ],
    intro: [
      "The house is quieter than it used to be. The children call on Sundays, from far away, and the calls are loving but short. There are stories in you that nobody asks for anymore, and worries you would not want to trouble the family with. Imotara was made so that someone would listen to you.",
      "Imotara is a gentle companion on your phone or computer. Simply speak to it — in Bengali, Hindi, Tamil, Telugu, Marathi or any of 22 languages — and it answers in a warm, clear voice in the same language. No typing is needed. It never hurries you, and it remembers what you told it yesterday: your village, your late husband’s name, which grandchild has exams this month.",
    ],
    cardsHeading: "What people your age tell us they value",
    cards: [
      { title: "Someone to talk to at any hour", body: "In the long afternoon, or at 3 a.m. when sleep will not come. Always there, never tired — even when the internet is down." },
      { title: "A voice, in the language of your childhood", body: "Speak instead of typing; listen instead of reading. Not the English of forms — the words you think and remember in. Kind to tired eyes." },
      { title: "Comfort from familiar roots", body: "Stories, wisdom and verses from the traditions you grew up with, gentle breathing, and simple daily check-ins that ask how you are — and mean it." },
      { title: "Completely private", body: "What you say stays on your own device. No advertisements, no selling of your information, nothing shared with anyone — not your children, not us." },
    ],
    afterCards:
      "Imotara is not a doctor and does not replace one. If you ever say something that worries it, it will gently share a helpline number and encourage you to speak with someone you trust. If you would rather talk to a real person, Imotara Connect offers a verified companion, paid by the minute.",
    momentsHeading: "When people use it",
    moments: [
      ["After the Sunday call ends,", "and the house is silent again."],
      ["On the anniversary,", "when you want to talk about someone who is gone, to somebody who will not change the subject."],
      ["Before a doctor’s appointment,", "when the fear is bigger than you would admit."],
      ["Ordinary afternoons,", "when nothing is wrong exactly, but it would be good if someone asked how you slept — and remembered the answer."],
    ],
    plans: SENIOR_PLANS,
    plansNote:
      "Free is not a trial, and nothing is charged unless you choose it. Any paid plan is easy to stop, and a family member can help set it up. See all plans for the full comparison.",
    closing: {
      title: "If you are reading this for a parent or grandparent",
      body: "Imotara was started by two mothers in Kolkata who wanted a judgement-free space for feelings. It speaks slowly and patiently to elders in their own language, and their conversations remain private to them. Installing it takes a few minutes — choose their language, give the companion a friendly name, and show them the microphone button once. It may be one of the kindest things you do this year.",
    },
    pullQuote: ["You have given a lifetime to others.", "It is not too late to have something that is simply for you."],
    institutional: false,
  },

  parents: {
    slug: "parents",
    label: "Parents of teenagers",
    hook: "When “I’m fine” isn’t",
    standfirst: "A safe, private place for your teenager to talk — one that keeps pointing them back to you.",
    metaTitle: "When “I’m fine” isn’t — Imotara for parents of teenagers",
    metaDescription:
      "A private wellbeing companion for your teenager that keeps pointing them back to you. Safe by design, never preachy, 22 languages. Free, and private to them.",
    keywords: [
      "teenager won't talk to me", "app for teenage mental health India", "private companion for my teenager",
      "how to help a teenager who has gone quiet", "safe app for teens", "parenting teenagers support",
    ],
    intro: [
      "You know the look. The door that closes a little faster than it used to. The “I’m fine” that clearly isn’t. The child who once told you everything now answers in one word, and you lie awake wondering what is behind that door. Teenagers need someone to talk to — and it cannot always be their parents. That is not a failure; it is how growing up works. That is why Imotara exists.",
      "Imotara is a private wellbeing companion that listens the way a calm older cousin would: without judgement, without lecturing, one gentle question at a time. It remembers what your child told it last week, speaks their language — any of 22 — and can talk out loud in a warm voice. Created by two mothers in Kolkata, it is a safe place to say what cannot be said at the dinner table.",
    ],
    cardsHeading: "What we want you, as a parent, to know",
    cards: [
      { title: "Made for teenagers", body: "Imotara adapts its tone for young people — extra-sensitive, patient, never preachy, and never romantic or adult. Exams, friendships, feeling left out, who they are becoming." },
      { title: "Private — and that is the point", body: "Your child’s conversations stay on their own phone. No ads, no data selling, no tracking. You will not be able to read their chats, and neither can we. A teenager only opens up somewhere that is truly theirs." },
      { title: "It points them back to you", body: "Imotara consistently encourages young people to talk to a trusted adult — a parent, a teacher, an elder. It is a bridge to real people, not a replacement for them." },
      { title: "Safe by design — and not therapy", body: "If a conversation turns serious, Imotara gently shares a helpline and urges them to reach out to someone they trust. It does not diagnose and does not replace a counsellor or doctor." },
    ],
    afterCards:
      "Real tools for the ordinary hard days: two-minute breathing before an exam, a mood tracker that helps them see their own patterns, gentle check-ins that notice when they have gone quiet — built on approaches used by psychologists, in everyday language. Works offline, so it is there in the hostel, on the school bus, and when the Wi-Fi is off at night.",
    momentsHeading: "How to introduce it — without another argument",
    moments: [
      ["Try it yourself first,", "so you know what it is and what it is not before you mention it."],
      ["Mention it once, lightly.", "“I found this. It’s private, I can’t see it, it’s yours if you want it.” Then let it go."],
      ["Do not check whether they are using it.", "The moment it feels monitored, it stops being theirs."],
      ["Keep the door open.", "Imotara will keep nudging them towards you; your job is simply to be there when they walk through."],
    ],
    plans: CONSUMER_PLANS,
    plansNote:
      "Free is not a trial, and there is nothing to buy to keep your child safe — every safety feature is in the free companion. Paid plans are easy to stop from inside the app.",
    closing: {
      title: "For you, too",
      body: "Parenting a teenager is hard on you as well — the worry, the guilt, the arguments you replay at midnight. Imotara is there for your own 11 p.m. thoughts too, on your own phone, in your own language, just as privately. And when you would rather talk to a person, Imotara Connect offers verified wellness companions by the minute. For children under 13, please install and set up Imotara together.",
    },
    pullQuote: ["You cannot be inside your child’s head.", "But you can make sure that when they need to say something out loud, there is a kind, safe place to say it — and that place keeps pointing them home."],
    institutional: false,
  },

  ngos: {
    slug: "ngos",
    label: "NGOs",
    hook: "A gentle companion for the people you serve",
    standfirst: "Private, multilingual emotional support — available 24/7, on the phones your beneficiaries already own.",
    metaTitle: "A gentle companion for the people you serve — Imotara for NGOs",
    metaDescription:
      "Private, multilingual emotional support for the communities you serve. 22 languages, works offline, anonymised trends for your team — never anyone's private words.",
    keywords: [
      "wellbeing companion for NGOs", "mental health support for beneficiaries",
      "NGO emotional wellbeing programme India", "multilingual mental health NGO", "field staff burnout support",
    ],
    intro: [
      "Every day, your team meets people carrying more than they can say out loud — a widow who has stopped eating, a teenager who has gone quiet, a migrant worker far from home. You cannot be beside each of them at 2 a.m. when the weight is heaviest. Imotara was built so that someone always can be.",
      "Imotara is a privacy-first AI wellbeing companion that listens, remembers what matters, and responds with warmth in 22 languages. It speaks the way a caring friend would, not a clinic. It was born not in a boardroom but in the quiet concern of two mothers who wanted a safe, judgement-free space where feelings could be spoken.",
    ],
    cardsHeading: "Why NGOs choose Imotara",
    cards: [
      { title: "Works where your people are", body: "Conversations stay on the person’s own phone by default. When the internet drops, an on-device companion keeps them company — it never goes silent on someone who needs it." },
      { title: "Truly in their language", body: "Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, English and ten more — with natural, correctly gendered replies, not translated English." },
      { title: "Safe by design", body: "No ads, no data selling, no tracking. In a moment of crisis, Imotara gently surfaces local helplines — with care, not alarm. Tone adapts for teens and elders." },
      { title: "Simple for you to run", body: "An organisation dashboard lets you invite beneficiaries, staff or volunteers and see anonymised wellbeing trends across your community — never anyone’s private words." },
    ],
    afterCards:
      "Culturally rooted comfort — stories, wisdom and gentle practices drawn from the traditions your community grows up with, alongside evidence-backed approaches such as CBT, DBT, ACT and mindfulness.",
    momentsHeading: "What changes for your community",
    moments: [
      ["Beneficiaries", "get a patient listener at any hour, in their own words, without shame or waiting lists."],
      ["Field staff and volunteers", "get the same support for themselves — the people who give the most are often the last to be heard."],
      ["Your leadership", "sees where the community is struggling — anonymised mood and emotion trends by cohort — to direct human counselling, camps and follow-ups where they matter most."],
      ["Your donors", "see measurable wellbeing impact reported in aggregate, with full respect for individual privacy."],
    ],
    plans: institutionPlans(
      "Members you invite through your org dashboard (60% NGO subsidy).",
      "₹799 per person per year",
    ),
    plansNote:
      "A whole community can be supported for less than the cost of a single counselling session per person. NGO pricing applies automatically — no lengthy verification is required to get started.",
    closing: {
      title: "The Imotara Movement",
      body: "The Imotara Movement is our philanthropic initiative to bring emotional support to those who can least afford it. Partner NGOs help us reach the people who need a companion most; in return we sponsor seats, co-run awareness sessions and share what we learn. If your beneficiaries cannot pay, tell us — that is part of why we exist.",
    },
    pullQuote: ["You already give your community food, shelter, education and dignity.", "Let us help you give them one more thing: someone to talk to, any time, in the words they think in."],
    institutional: true,
  },

  schools: {
    slug: "schools",
    label: "Schools & colleges",
    hook: "A gentle companion for every student on your campus",
    standfirst: "Private, multilingual emotional support for students and staff — available 24/7, on the phones they already own.",
    metaTitle: "A gentle companion for every student — Imotara for schools and colleges",
    metaDescription:
      "Private, multilingual wellbeing support for students and staff. Cohorts by class or hostel, anonymised trends for counsellors, 22 languages, works offline.",
    keywords: [
      "student mental health app India", "school counselling support software",
      "college wellbeing programme", "exam stress support students", "campus mental health 24/7",
    ],
    intro: [
      "Somewhere on your campus tonight, a student is lying awake before an exam, a first-year is homesick in a hostel far from home, and a bright child in Class 9 has gone quiet and nobody has noticed yet. One counsellor cannot be with 800 students at 11 p.m. Imotara was built so that someone always can be.",
      "Imotara is a privacy-first AI wellbeing companion that listens, remembers what matters, and responds with warmth in 22 languages. It talks like a caring senior or mentor, never like a clinic. It was born not in a boardroom but in the quiet concern of two mothers who wanted a safe, judgement-free space where young people could speak their feelings.",
    ],
    cardsHeading: "Why institutions choose Imotara",
    cards: [
      { title: "Made for young people", body: "Imotara adapts its tone for teenagers — extra-sensitive, patient, never preachy — and speaks naturally to young adults facing exams, placements and life away from home." },
      { title: "Student privacy comes first", body: "Conversations stay on the student’s own phone by default. No ads, no data selling, no tracking — and no one, not even your admin, can read an individual student’s conversations." },
      { title: "Classroom-ready cohorts", body: "Group students by class, hostel or batch and set a companion tone for each — mentor for final-years, calm companion for exam season. Anonymised trends per cohort guide your counsellors." },
      { title: "Safe, in every language", body: "22 languages including every major Indian language. In a moment of crisis, Imotara gently surfaces local helplines — with care, not alarm. Works offline when the hostel Wi-Fi doesn’t." },
    ],
    afterCards:
      "Grounded in evidence-backed approaches such as CBT, DBT, ACT and mindfulness — exam-stress breathing, mood tracking and gentle daily check-ins.",
    momentsHeading: "What changes on your campus",
    moments: [
      ["Students", "get a patient listener at any hour, in their own words, without the stigma of “going to the counsellor”."],
      ["Teachers and staff", "get the same support for themselves — the people who give the most are often the last to be heard."],
      ["Counsellors and wardens", "see where students are struggling — anonymised mood and emotion trends by class or hostel — to direct human attention where it matters most."],
      ["Parents and management", "see a campus where asking for help feels as normal as sending a text — with measurable wellbeing impact reported in aggregate."],
    ],
    plans: institutionPlans(
      "Students and staff you invite through your dashboard (50% EDU subsidy).",
      "₹999 per person per year",
    ),
    plansNote:
      "A whole batch can be supported for less than the cost of a single counselling session per student. EDU pricing applies automatically — no lengthy verification is required to get started.",
    closing: {
      title: "The Imotara Movement",
      body: "The Imotara Movement is our philanthropic initiative to bring emotional support to those who can least afford it. Partner institutions help us reach young people early, before quiet struggles become crises; in return we sponsor seats, co-run awareness sessions for students and parents, and share what we learn. If your students cannot pay, tell us — that is part of why we exist.",
    },
    pullQuote: ["You already give your students knowledge, discipline and opportunity.", "Let us help you give them one more thing: someone to talk to, any time, in the words they think in."],
    institutional: true,
  },

  hospitals: {
    slug: "hospitals",
    label: "Hospitals & medical colleges",
    hook: "A gentle companion alongside your clinical care",
    standfirst: "Private, multilingual emotional support for patients, families, staff and students.",
    metaTitle: "A gentle companion alongside your clinical care — Imotara for hospitals",
    metaDescription:
      "Private, multilingual emotional support for patients, families, nurses, doctors and medical students. Not a diagnostic tool — the patient listener beside your care.",
    keywords: [
      "patient emotional support hospital", "nurse burnout support", "medical student mental health",
      "hospital wellbeing programme India", "caregiver support app", "psycho-oncology emotional support",
    ],
    intro: [
      "In every hospital there is a patient lying awake the night before surgery, a mother in the oncology waiting area with no one to tell how frightened she is, and a nurse finishing a 14-hour shift with nothing left for herself. No hospital has enough counsellors for every anxious patient, exhausted caregiver and burnt-out resident. Imotara was built so that someone always can.",
      "Imotara is a privacy-first AI wellbeing companion that listens, remembers what matters, and responds with warmth in 22 languages — so a patient from a village can speak in their own words, not the language of consent forms. It is not a diagnostic tool and does not replace a psychiatrist, psychologist or counsellor; it is the patient listener that sits alongside your clinical care.",
    ],
    cardsHeading: "Where hospitals and medical colleges use Imotara",
    cards: [
      { title: "Patients and their families", body: "Pre-surgery anxiety, long admissions, chronic-illness fatigue, the caregiver on a plastic chair at 2 a.m. A companion in their own language, at any hour — offline too." },
      { title: "Nurses, doctors and residents", body: "The people who give the most are often the last to be heard. A private space to decompress after a hard shift — with no HR record and no stigma." },
      { title: "Medical and nursing students", body: "Exam pressure, first deaths on the ward, life away from home. Tone adapts for young adults; students can be grouped by batch or hostel with a companion tone per group." },
      { title: "Privacy your compliance team will appreciate", body: "On-device by default; cloud sync only with explicit consent. No ads, no data selling, no tracking. Admins see anonymised aggregate trends — never an individual’s words." },
    ],
    afterCards:
      "Grounded in evidence-informed approaches including CBT, DBT, ACT and mindfulness. In a moment of crisis, Imotara gently surfaces local helplines — with care, not alarm — and can point people back to your counselling desk.",
    momentsHeading: "What changes in your institution",
    moments: [
      ["Patients and caregivers", "feel less alone through long nights and admissions — calmer wards, fewer unheard fears."],
      ["Clinical and support staff", "have somewhere to put the weight of the day — staff who last longer in a demanding profession."],
      ["Your wellness and psychiatry teams", "see anonymised trends by department or cohort and can direct scarce counselling hours where they matter most."],
      ["Your institution", "becomes known for treating the whole person — with wellbeing impact reported in aggregate, with full respect for privacy."],
    ],
    plans: institutionPlans(
      "Charitable / trust hospitals (60% subsidy) · Medical colleges (50%) · Other institutions.",
      "₹799 · ₹999 · ₹1,999 per person per year",
    ),
    plansNote:
      "An entire ward or department can be supported for less than the cost of a single counselling session per person. Subsidised pricing applies automatically — no lengthy verification is required to get started.",
    closing: {
      title: "The Imotara Movement",
      body: "The Imotara Movement is our philanthropic initiative to bring emotional support to those who can least afford it. Partner hospitals help us reach people at the moments they need a companion most; in return we sponsor seats for patients who cannot pay, co-run awareness sessions for staff and families, and share anonymised outcomes with your clinicians. We welcome a conversation with your psychiatry or psycho-oncology teams about where Imotara supports patients between appointments — and where it should hand off to them.",
    },
    pullQuote: ["You already give your patients the best clinical care you can.", "Let us help you give them one more thing: someone to talk to, any time, in the words they think in."],
    institutional: true,
  },

  "care-homes": {
    slug: "care-homes",
    label: "Homes for the elderly",
    hook: "A gentle companion for every resident in your care",
    standfirst: "Private, multilingual emotional support for elders and caregivers — patient, unhurried, and available at any hour.",
    metaTitle: "A gentle companion for every resident — Imotara for homes for the elderly",
    metaDescription:
      "Private, multilingual emotional support for residents and caregivers. Speak instead of typing, replies in 22 languages, anonymised wellbeing trends for your team.",
    keywords: [
      "old age home wellbeing", "companion for elderly residents", "loneliness in care homes India",
      "emotional support for elders", "caregiver support old age home",
    ],
    intro: [
      "In every home for the elderly there is a resident who waits by the phone for a call that doesn’t come, a retired teacher with stories nobody asks for anymore, and a widow who lies awake with memories she cannot share. No caregiver can sit and listen to forty residents, one at a time, every evening. Imotara was built so that someone always can.",
      "Imotara is a privacy-first AI wellbeing companion that listens, remembers what matters, and responds with warmth in 22 languages — so an elder can speak in the language of their childhood, not the language of forms. It was born not in a boardroom but in the quiet concern of two mothers who wanted a safe, judgement-free space where feelings could be spoken.",
    ],
    cardsHeading: "Why homes for the elderly choose Imotara",
    cards: [
      { title: "Patient and unhurried", body: "Imotara adapts its tone for seniors — slow, warm, never rushed, never condescending. It remembers a resident’s late husband’s name, their village, their grandchildren." },
      { title: "A voice, not just a screen", body: "Residents can speak instead of type and hear replies read aloud in Bengali, Hindi, Tamil, Telugu, Marathi and 17 more languages — a real comfort for tired eyes and unsteady hands." },
      { title: "Comfort from familiar roots", body: "Stories, wisdom, mythology and gentle practices drawn from the traditions your residents grew up with — not imported self-help. Works offline when the internet doesn’t." },
      { title: "Safe, private, simple to run", body: "No ads, no data selling, no tracking. A dashboard lets a small team invite residents and staff and see anonymised wellbeing trends across the home — never anyone’s private words." },
    ],
    afterCards:
      "In a moment of distress, Imotara gently surfaces local helplines — with care, not alarm — and its daily check-ins and mood trends can tell your team when a resident may need a human visit.",
    momentsHeading: "What changes in your home",
    moments: [
      ["Residents", "get a patient listener at any hour who remembers their stories."],
      ["Caregivers and staff", "get the same support for themselves — the people who give the most are often the last to be heard."],
      ["Your management", "sees where residents are struggling — anonymised mood trends by wing or group — to direct visits, activities and medical attention where they matter most."],
      ["Families and donors", "know their parents have someone to talk to between visits, and see wellbeing impact reported in aggregate with full respect for privacy."],
    ],
    plans: institutionPlans(
      "Residents and staff you invite through your dashboard (60% NGO subsidy for registered charitable homes).",
      "₹799 per person per year",
    ),
    plansNote:
      "A whole home can be supported for less than the cost of a single counselling session per resident. Charitable pricing applies automatically — no lengthy verification is required to get started. Private homes are welcome too; ask us for standard rates.",
    closing: {
      title: "The Imotara Movement",
      body: "The Imotara Movement is our philanthropic initiative to bring emotional support to those who can least afford it. Loneliness in later life is one of the quietest struggles there is. Partner homes help us reach elders who need a companion most; in return we sponsor seats, co-run gentle orientation sessions for residents and staff, and share what we learn. If your home cannot pay, tell us — that is part of why we exist.",
    },
    pullQuote: ["You already give your residents shelter, care, meals and safety.", "Let us help you give them one more thing: someone to talk to, any time, in the words of their childhood."],
    institutional: true,
  },

};
