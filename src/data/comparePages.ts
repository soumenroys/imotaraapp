// The /compare/* decision pages.
//
// 🔑 WHY THESE EXIST. Search Console, three months to 2026-10-16: 111
// impressions across SEVEN queries, six of them the brand name or a
// misspelling. The site ranks (position 6.2) and converts (17.1% CTR) and is
// simply never shown, because almost nothing on it answers anything people
// type. The single non-brand query was
// *"can an ai therapy app help with grief and loss processing"* — long,
// conversational, question-shaped. These pages are that shape.
//
// ⛔ NO CLAIMS ABOUT NAMED COMPETITORS. Not one page says "Imotara vs <product>".
// Three reasons, in order of how much they cost:
//   1. Every specific claim about another product — its price, its features,
//      whether it is clinically validated — is unverifiable from this
//      repository, goes stale silently, and becomes the owner's liability the
//      day it is wrong. For a mental-health product, a wrong claim about a
//      rival's clinical status is the worst kind.
//   2. Nobody maintains them. A competitor matrix is a promise to re-check
//      someone else's pricing page forever.
//   3. People do not actually search "X vs Y" nearly as much as they search
//      "is an AI app the same as therapy". The category question is the real
//      query AND the safe one.
// ⇒ Same discipline as audiencePages.ts, which deliberately dropped the
// unsubstantiated "71 evidence-informed approaches" figure.
//
// ⚠️ EVERY FACT ABOUT IMOTARA HERE IS CHECKED AGAINST CODE, not against the
// marketing pages:
//   - 22 languages            src/lib/connect/languages.ts (counted: 22)
//   - free tier + prices      src/data/audiencePages.ts FREE_ROW / PLUS_ROW,
//                             themselves pinned to grantLicense.ts
//   - age 13 / under 18       src/lib/legal/consentCopy.ts
//   - crisis numbers          src/lib/safety/crisisResources.ts
// If a price changes, it changes in grantLicense.ts first. This is the shop
// window, never the system of record.
//
// 🔴 EVERY PAGE CARRIES A `notFor` SECTION — where Imotara is the WRONG
// choice. That is not modesty. A page that only sells is the page an AI
// assistant declines to quote, and a wellness product that overclaims is a
// safety problem before it is a marketing one.

export type CompareSlug =
    | "ai-companion-vs-therapy"
    | "ai-companion-vs-human-counsellor"
    | "free-vs-paid-mental-health-apps"
    | "how-to-choose-a-mental-health-app"
    | "mental-health-apps-in-indian-languages";

export interface CompareRow {
    criterion: string;
    imotara: string;
    other: string;
}

export interface CompareSection {
    heading: string;
    body: string[];
}

export interface ComparePage {
    slug: CompareSlug;
    /** The <h1>, and the question the page exists to answer. */
    question: string;
    /** 1–2 sentences. Deliberately quotable: this is what an assistant lifts. */
    shortAnswer: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    /** Column headings for the table. */
    columns: { imotara: string; other: string };
    rows: CompareRow[];
    sections: CompareSection[];
    /** 🔴 Where Imotara is the wrong answer. Never empty. */
    notFor: string[];
    related: { href: string; label: string }[];
}

const NOT_THERAPY =
    "Imotara is a wellness companion for self-reflection and emotional awareness. It is not therapy, it does not diagnose, and it is not a crisis service.";

const CRISIS_LINE =
    "If you are in danger or thinking of harming yourself, contact a real service now — in India, Tele-MANAS on 14416, free and around the clock, or 112 for emergencies. Anywhere else, findahelpline.com lists the service for your country.";

export const COMPARE_PAGES: Record<CompareSlug, ComparePage> = {
    "ai-companion-vs-therapy": {
        slug: "ai-companion-vs-therapy",
        question: "Is an AI companion the same as therapy?",
        shortAnswer:
            "No. Therapy is a clinical relationship with a trained, accountable professional who can assess, diagnose and treat. An AI companion like Imotara is a place to put feelings into words between those conversations, or when none are available. The two are not substitutes, and anything marketed as an AI therapist should be treated with suspicion.",
        metaTitle: "Is an AI companion the same as therapy? — Imotara",
        metaDescription:
            "A plain answer: what an AI companion can and cannot do, how it differs from therapy, and when to see a professional instead. From Imotara, which is not therapy and says so.",
        keywords: [
            "is ai therapy real therapy",
            "ai companion vs therapy",
            "can an ai app replace a therapist",
            "is an ai therapy app safe",
            "difference between ai companion and counselling",
        ],
        columns: { imotara: "An AI companion (Imotara)", other: "Therapy with a professional" },
        rows: [
            {
                criterion: "What it is",
                imotara: "A private space to name what you are feeling and notice patterns over time.",
                other: "A clinical relationship with a trained, regulated professional.",
            },
            {
                criterion: "Can it diagnose?",
                imotara: "No. Never. It does not assess or label conditions.",
                other: "Yes — that is part of the work.",
            },
            {
                criterion: "Accountability",
                imotara: "A product, governed by its terms and privacy policy.",
                other: "A licensed practitioner, answerable to a professional body.",
            },
            {
                criterion: "Availability",
                imotara: "Any hour, immediately, in 22 languages.",
                other: "By appointment, subject to cost and waiting lists.",
            },
            {
                criterion: "Cost",
                imotara: "Free tier forever — twenty cloud replies a day and unlimited on-device replies. Imotara Plus is ₹149 / month or ₹1,299 / year.",
                other: "Varies widely; often the main barrier.",
            },
            {
                criterion: "In a crisis",
                imotara: "Shows the helpline for your country and encourages you to reach a person. It is not a crisis service.",
                other: "Can act, escalate and involve emergency care.",
            },
        ],
        sections: [
            {
                heading: "What an AI companion is genuinely good at",
                body: [
                    "Putting a feeling into words is itself useful, and it is often the part people cannot do at 2am with nobody awake. An AI companion is available at exactly that hour, costs nothing to start, and does not get tired of you returning to the same thing.",
                    "It is also patient with repetition and with language. Imotara works in 22 languages, so you can describe a feeling in the language you actually feel it in rather than translating yourself into English first — which is, for a great many people, the difference between saying the true thing and saying the sayable thing.",
                    "And it notices patterns. Mood recorded over weeks shows you things a single conversation cannot: that Sundays are hard, that something improved after a change you had stopped noticing.",
                ],
            },
            {
                heading: "What it cannot do, and will not pretend to",
                body: [
                    NOT_THERAPY,
                    "It cannot assess risk the way a clinician can. It cannot adjust a treatment plan, write to your doctor, or notice the thing you are carefully not saying. It has no professional body standing behind it and no duty of care in the legal sense.",
                    "Anything sold to you as an AI therapist is overclaiming. Reflection and treatment are different activities, and a product that blurs them is a product that will eventually be trusted with something it cannot hold.",
                ],
            },
            {
                heading: "How they fit together",
                body: [
                    "The honest framing is not either/or. People in therapy often use something like Imotara between sessions — the week is where the material comes from, and arriving with it written down makes the hour go further.",
                    "People who are not in therapy, and cannot currently get there, use it as somewhere for feelings to go that is better than nowhere. That is a real use, and it is not the same as saying it is enough.",
                    "If you want a human but not a clinician, Imotara Connect offers verified wellness companions, paid by the minute from a prepaid wallet. Still not therapy — a person, not a practitioner.",
                ],
            },
        ],
        notFor: [
            "You are in crisis or thinking of harming yourself. " + CRISIS_LINE,
            "You need a diagnosis, medication, or a treatment plan. That requires a clinician, and no app substitutes for one.",
            "You are being asked to use an app instead of care you are entitled to. An app is not a reason for anyone to withhold treatment.",
            "You want someone who remembers you as a person across years and can be held accountable for your care.",
        ],
        related: [
            { href: "/compare/ai-companion-vs-human-counsellor", label: "AI companion or a real person?" },
            { href: "/faq", label: "Straight answers about Imotara" },
            { href: "/help", label: "Help and safety" },
        ],
    },

    "ai-companion-vs-human-counsellor": {
        slug: "ai-companion-vs-human-counsellor",
        question: "Should I talk to an AI companion or a real person?",
        shortAnswer:
            "Talk to a person whenever you can and whenever it matters. An AI companion is for the hours when no person is available, when you cannot afford one yet, or when you want to work out what you think before saying it aloud to someone.",
        metaTitle: "AI companion or a real person? — Imotara",
        metaDescription:
            "When an AI companion helps and when you should talk to a human instead. Honest about both, from Imotara, which offers each.",
        keywords: [
            "ai companion vs real person",
            "should i talk to an ai or a human",
            "is it bad to talk to an ai about feelings",
            "online counsellor vs ai app",
        ],
        columns: { imotara: "An AI companion", other: "A human companion or counsellor" },
        rows: [
            {
                criterion: "Available at 3am",
                imotara: "Yes, immediately.",
                other: "Rarely.",
            },
            {
                criterion: "Understands your situation",
                imotara: "Only what you tell it, each time you tell it.",
                other: "Builds real context about your life.",
            },
            {
                criterion: "Judgement",
                imotara: "None — which is sometimes exactly the point.",
                other: "None, from a good one — and it means more, because they could.",
            },
            {
                criterion: "Cost",
                imotara: "Free to start.",
                other: "Paid by the minute on Imotara Connect; privately, usually much more.",
            },
            {
                criterion: "Can act for you",
                imotara: "No.",
                other: "Yes — can escalate, refer, and stay with you.",
            },
        ],
        sections: [
            {
                heading: "The case for saying it to a person",
                body: [
                    "Being heard by another human does something that being processed does not. If you have the option, take it — a friend, a family member, a counsellor, anyone who will sit with it.",
                    "A person also notices what you leave out. They remember what you said last month and hear that this month is different. No current AI does that in the way a person who knows you does.",
                ],
            },
            {
                heading: "The case for the app first",
                body: [
                    "Plenty of people cannot do the above today. The person is asleep, or far away, or is the problem. Or saying it aloud to someone who knows you is exactly the barrier, and writing it to something that will not flinch is how it first gets said at all.",
                    "There is also rehearsal. Working out what you actually think, privately, before you take it to someone — that is a real use and not a lesser one.",
                    "And there is cost. Free matters when free is what there is.",
                ],
            },
            {
                heading: "Imotara offers both, deliberately",
                body: [
                    "The AI companion is the free tier and always will be. Imotara Connect is a verified human wellness companion, billed by the minute from prepaid minutes, where you pay only for minutes actually used.",
                    "Connect companions are wellness companions, not clinicians. " + NOT_THERAPY,
                ],
            },
        ],
        notFor: [
            "You are in immediate danger. " + CRISIS_LINE,
            "You are using the app to avoid a conversation you know you need to have. It will wait with you, but it cannot have it for you.",
            "You need clinical care. Neither the AI companion nor a Connect companion is a therapist.",
        ],
        related: [
            { href: "/compare/ai-companion-vs-therapy", label: "Is an AI companion the same as therapy?" },
            { href: "/for/everyone", label: "What Imotara is" },
        ],
    },

    "free-vs-paid-mental-health-apps": {
        slug: "free-vs-paid-mental-health-apps",
        question: "Do you have to pay for a mental health app?",
        shortAnswer:
            "No. A genuinely useful free tier is possible, and you should be suspicious of any app that blocks a conversation mid-sentence to sell you something. Imotara's free tier is permanent: twenty cloud replies a day, unlimited on-device replies, and all 22 languages, with no card required.",
        metaTitle: "Do you have to pay for a mental health app? — Imotara",
        metaDescription:
            "What a free tier should include, what paying actually buys, and the warning signs of a paywall placed where it does harm.",
        keywords: [
            "free mental health app",
            "free ai therapy app no subscription",
            "mental health app without paying",
            "is there a free alternative to therapy apps",
        ],
        columns: { imotara: "Imotara free", other: "Imotara Plus" },
        rows: [
            { criterion: "Cost", imotara: "Free, forever. No card.", other: "₹149 / month or ₹1,299 / year." },
            { criterion: "Replies", imotara: "Twenty cloud replies a day, then unlimited on-device replies — the conversation is never blocked.", other: "Unlimited." },
            { criterion: "Languages", imotara: "All 22.", other: "All 22." },
            { criterion: "Mood tools", imotara: "Mood check-ins, breathing, history and trends.", other: "Everything in free, plus emotion trends and companion letters." },
            { criterion: "Voice", imotara: "Read-aloud and transcription with a small daily cap when signed out.", other: "Natural neural voice, unlimited." },
            { criterion: "History", imotara: "Kept on your device.", other: "Unlimited history and cross-device sync." },
        ],
        sections: [
            {
                heading: "The one rule a wellness paywall should follow",
                body: [
                    "It should never land in the middle of a difficult moment. If an app stops you mid-conversation to ask for a card, the product has been designed so that distress is the sales pitch.",
                    "Imotara's free limit is built so this cannot happen: when the twenty daily cloud replies are used, it quietly switches to on-device replies and the conversation continues. You may notice the replies become simpler. You will not be stopped.",
                ],
            },
            {
                heading: "What paying actually buys",
                body: [
                    "Unlimited replies and history, companion personas, the natural neural voice, emotion trends and companion letters. One paid plan with everything in it, rather than a ladder of tiers.",
                    "Nothing about safety is behind the paywall. Crisis resources, the helpline for your country, the age protections and the privacy defaults are identical on both tiers, because charging for those would be indefensible.",
                ],
            },
            {
                heading: "What free does not mean",
                body: [
                    "It does not mean you are the product. Imotara does not sell data, does not run ads and does not track you across the web. Conversations stay on your own device by default.",
                    "If an app is free and does none of that, ask what it is monetising instead.",
                ],
            },
        ],
        notFor: [
            "You want unlimited cloud replies without paying. The free tier is generous and permanent, but it is not unlimited.",
            "You need cross-device sync or cloud backup — those require an account and the paid plan.",
            "You are looking for free therapy. " + NOT_THERAPY,
        ],
        related: [
            { href: "/upgrade", label: "What Plus includes" },
            { href: "/compare/how-to-choose-a-mental-health-app", label: "How to choose an app" },
        ],
    },

    "how-to-choose-a-mental-health-app": {
        slug: "how-to-choose-a-mental-health-app",
        question: "How do you choose a mental health app?",
        shortAnswer:
            "Check six things: whether it claims to be therapy, where your conversations are stored, what happens in a crisis, whether the free tier is usable, whether it works in your language, and what the minimum age is. An app that is vague about any of them has told you something.",
        metaTitle: "How to choose a mental health app — a checklist — Imotara",
        metaDescription:
            "Six questions to ask of any emotional-wellbeing app, and Imotara's own answers to each, including where it is not the right choice.",
        keywords: [
            "how to choose a mental health app",
            "what to look for in a wellbeing app",
            "are mental health apps safe",
            "mental health app privacy checklist",
        ],
        columns: { imotara: "Imotara's answer", other: "What a vague answer suggests" },
        rows: [
            {
                criterion: "Does it claim to be therapy?",
                imotara: "No, explicitly, on the first screen you ever see.",
                other: "An app that implies clinical treatment is overclaiming.",
            },
            {
                criterion: "Where do conversations live?",
                imotara: "On your own device by default. No ads, no data selling, no tracking.",
                other: "If this is hard to find, assume the answer is not the one you want.",
            },
            {
                criterion: "What happens in a crisis?",
                imotara: "It shows the helpline for your country — not one country's number worldwide — and encourages a real service.",
                other: "A single national helpline shown to everyone means nobody checked.",
            },
            {
                criterion: "Is the free tier usable?",
                imotara: "Twenty cloud replies a day, then unlimited on-device replies. Never blocked mid-conversation.",
                other: "A free tier that stops you at the hard moment is a sales tactic.",
            },
            {
                criterion: "Does it work in your language?",
                imotara: "22 languages, including 11 Indian languages, for chat and voice.",
                other: "English-only is a real limit, not a detail.",
            },
            {
                criterion: "What is the minimum age?",
                imotara: "13, and under 18 a parent or guardian must agree. A higher local age wins.",
                other: "No stated age means no thought given to who is using it.",
            },
        ],
        sections: [
            {
                heading: "Why the crisis question matters more than the features",
                body: [
                    "Most of the time an app's crisis behaviour is invisible, which is exactly why it goes unchecked. The test is simple: does it show a service that exists in your country?",
                    "This is not hypothetical. Imotara's own crisis lookup once defaulted to Indian numbers for undetected countries and showed nothing at all for around 140 others. It was found, fixed at the root rather than patched at each call site, and the fix is why the claim above can be made at all.",
                ],
            },
            {
                heading: "Why language is not a detail",
                body: [
                    "People do not feel in their second language. Being forced to describe grief in English, when grief happened in Bengali or Tamil or Marathi, changes what gets said — usually into something smaller and more manageable than the truth.",
                    "This is also the least served part of the market. There is far less competition for a genuinely good wellbeing app in Odia than in English, and far more need.",
                ],
            },
        ],
        notFor: [
            "You want a clinical product. " + NOT_THERAPY,
            "You want a single app to replace a care team. Nothing on this list does that.",
            "You are choosing on behalf of someone in crisis right now. " + CRISIS_LINE,
        ],
        related: [
            { href: "/compare/ai-companion-vs-therapy", label: "Is an AI companion the same as therapy?" },
            { href: "/compare/mental-health-apps-in-indian-languages", label: "Apps in Indian languages" },
            { href: "/privacy", label: "Imotara's privacy policy" },
        ],
    },

    "mental-health-apps-in-indian-languages": {
        slug: "mental-health-apps-in-indian-languages",
        question: "Are there mental health apps in Indian languages?",
        shortAnswer:
            "Yes, though far fewer than in English. Imotara works in 22 languages, eleven of them Indian — Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia and Urdu — for both chat and voice, on the free tier as well as the paid one.",
        metaTitle: "Mental health apps in Indian languages — Imotara",
        metaDescription:
            "Emotional wellbeing in Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia and Urdu — chat and voice, on the free tier.",
        keywords: [
            "mental health app in hindi",
            "mental health app in bengali",
            "emotional support app indian languages",
            "ai companion in tamil",
            "mood tracker in marathi",
        ],
        columns: { imotara: "Imotara", other: "English-only apps" },
        rows: [
            { criterion: "Chat", imotara: "All 22 languages.", other: "English." },
            { criterion: "Voice and read-aloud", imotara: "Supported across the language set.", other: "English, usually." },
            { criterion: "Consent and safety screens", imotara: "Shown in your language, not only English.", other: "Often English even where the app is translated." },
            { criterion: "Crisis numbers", imotara: "Matched to your country, not to your language.", other: "Frequently a single national number." },
            { criterion: "Cost of the language support", imotara: "None — it is on the free tier.", other: "Sometimes a premium feature." },
        ],
        sections: [
            {
                heading: "Language is not country, and the difference is a safety issue",
                body: [
                    "Bengali is also spoken in Bangladesh, Tamil in Sri Lanka and Singapore, Urdu mostly in Pakistan, Punjabi in both India and Pakistan. An app that infers your helpline from the language you chose will hand some people a number they cannot call.",
                    "Imotara resolves the crisis service from country, separately from language, and names findahelpline.com for anywhere not covered.",
                ],
            },
            {
                heading: "Written in the language, not translated into it",
                body: [
                    "Machine-translating an English wellbeing script produces text that is grammatical and slightly wrong — the register of a form rather than of a person. Imotara's consent and safety copy carries the same voice across all 22 languages and has been corrected by native speakers in use.",
                    "Each language also has its own question-and-answer page, written in its own script.",
                ],
            },
        ],
        notFor: [
            "Your language is not among the 22. The app will not serve you well, and it is better to say so.",
            "You need clinical care in your language — that is a different and harder problem than an app solves. " + NOT_THERAPY,
            "You are in crisis. " + CRISIS_LINE,
        ],
        related: [
            { href: "/faq/hi", label: "हिन्दी में सवाल-जवाब" },
            { href: "/faq/bn", label: "বাংলায় প্রশ্ন-উত্তর" },
            { href: "/faq/ta", label: "தமிழில் கேள்வி-பதில்" },
        ],
    },
};

export const COMPARE_SLUGS = Object.keys(COMPARE_PAGES) as CompareSlug[];

export function comparePageFor(slug: string): ComparePage | undefined {
    return COMPARE_PAGES[slug as CompareSlug];
}
