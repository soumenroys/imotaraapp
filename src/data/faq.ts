// src/data/faq.ts
//
// The public FAQ. Question-shaped, because that is the only shape that has ever
// worked for this site in search.
//
// 🔴 MEASURED 2026-10-16 in Search Console, 3 months: 111 impressions, average
// position 6.2, CTR 17.1% — and **seven queries in total**, six of which were
// the brand name or a misspelling of it. The single non-brand query was
// *"can an ai therapy app help with grief and loss processing"*: long,
// conversational, question-shaped.
//
// 🔑 THE DIAGNOSIS THAT PRODUCED THIS FILE. The existing 16 blog posts are
// essays ("Algorithmic Gaslighting", "Digital Twin Anxiety") and the 11
// `/for/*` pages are audience segments ("for seniors", "for parents"). Both are
// organised around what Imotara wants to SAY. Nobody types either into a search
// box, and between them they produce no measurable non-brand impressions.
// This file is organised around what people ASK.
//
// ⚠️ 36 of those 111 impressions already came from Google's generative AI
// features — about a third. Clear question-and-answer pairs are what AI
// surfaces quote, which is why each answer below leads with a complete,
// quotable first sentence rather than building to a conclusion.
//
// ⛔ HOUSE RULES, enforced by src/__tests__/faqHonesty.test.ts:
//   · never claim to be therapy, and where therapy is mentioned, deny it
//   · the minimum age is 13, with parental consent under 18 — never imply lower
//   · no promotional vocabulary; this is a reference page, not a pitch
//   · every question ends in "?" and every answer stands alone out of context,
//     because an AI surface will quote one answer without the rest of the page

export type FaqItem = {
    /** Stable anchor id. */
    id: string;
    /** ⛔ Must end in "?" — this is the whole point of the page. */
    q: string;
    /** ⚠️ First sentence must answer it completely; the rest is elaboration. */
    a: string;
    section: FaqSection;
};

export type FaqSection =
    | "What Imotara is"
    | "Privacy"
    | "Languages"
    | "Using it"
    | "Difficult moments"
    | "Safety and age";

export const FAQ_SECTIONS: readonly FaqSection[] = [
    "What Imotara is", "Privacy", "Languages", "Using it", "Difficult moments", "Safety and age",
];

export const FAQ: FaqItem[] = [
    // ── What Imotara is ─────────────────────────────────────────────────────
    {
        id: "what-is-imotara",
        section: "What Imotara is",
        q: "What is Imotara?",
        a: "Imotara is a private companion you can talk to about how you actually feel, available on the web, iOS and Android in 22 languages. You write or speak, it replies, and it keeps a quiet record of how you have been over time so you can see patterns you cannot see from inside a single week. There are no ads and nothing is sold.",
    },
    {
        id: "is-imotara-therapy",
        section: "What Imotara is",
        q: "Is Imotara therapy?",
        a: "No. Imotara is not therapy, not a therapist, and not a crisis service, and it cannot replace a qualified person who knows you. It is somewhere to think out loud on an ordinary difficult day. If something is serious, please talk to a professional — and Imotara will say so rather than hold on to you.",
    },
    {
        id: "is-imotara-free",
        section: "What Imotara is",
        q: "Is Imotara free to use?",
        a: "Yes. You can use Imotara without paying and without creating an account. Paid plans add things like unlimited voice and cross-device sync, but conversations are never cut off mid-sentence because you have not paid — if you reach the daily limit for cloud replies, it quietly switches to on-device replies instead.",
    },
    {
        id: "who-built-imotara",
        section: "What Imotara is",
        q: "Who built Imotara?",
        a: "Imotara was built in India by M/S IMOTARA, a small team, and designed from the start for people who think in Indian languages as well as English. The name is meant as an immortal friend for your emotions — something that remembers and stays.",
    },

    // ── Privacy ─────────────────────────────────────────────────────────────
    {
        id: "is-it-private",
        section: "Privacy",
        q: "Is Imotara private?",
        a: "Yes. Without an account your conversations stay on your device and are not uploaded anywhere. With an account they sync so you can continue on another device — that is the only thing an account is for. There are no ads in Imotara, so nothing about you is worth selling.",
    },
    {
        id: "can-anyone-read-it",
        section: "Privacy",
        q: "Can anyone else read what I write to Imotara?",
        a: "No. Your conversations are not readable by anyone else, including your employer, your school or your family, even where an organisation has paid for your licence. An organisation can see that a licence is being used; it cannot see who said what, and there is no administrative view that shows conversation content to anybody.",
    },
    {
        id: "do-i-need-an-account",
        section: "Privacy",
        q: "Do I need an account to use Imotara?",
        a: "No. Open it and start typing. Chat, mood check-ins, your history and reflections all work without signing in, with your data stored on your own device. An account adds cross-device sync and backup, and nothing else is withheld to push you into one.",
    },
    {
        id: "can-i-delete-it",
        section: "Privacy",
        q: "Can I delete my conversations?",
        a: "Yes, and deleted means deleted. You can remove your history whenever you want, on every plan including the free one — deletion is not a paid feature. You can also export everything first if you would rather keep a copy.",
    },

    // ── Languages ───────────────────────────────────────────────────────────
    {
        id: "what-languages",
        section: "Languages",
        q: "What languages does Imotara speak?",
        a: "Imotara understands 22 languages, including 11 Indian ones: Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia and Urdu, alongside English, Spanish, French, German, Portuguese, Russian, Arabic, Hebrew, Chinese, Japanese and Indonesian. It replies in whichever language you wrote in.",
    },
    {
        id: "talk-in-my-language",
        section: "Languages",
        q: "Can I talk to Imotara in Hindi, Bengali or Tamil?",
        a: "Yes, and in eight other Indian languages. You can write in the native script or in Roman letters the way people actually type, and the reply comes back in the same form you used. Most people can describe a difficult feeling in English but only describe it accurately in the language they grew up in.",
    },
    {
        id: "switch-language",
        section: "Languages",
        q: "Can I switch language in the middle of a conversation?",
        a: "Yes. Write a sentence in another language and Imotara follows, including mixing two languages in one message the way people speak. If you would rather fix it, set a preferred language in Settings and it will stay there.",
    },

    // ── Using it ────────────────────────────────────────────────────────────
    {
        id: "what-do-i-say",
        section: "Using it",
        q: "What do I say to start?",
        a: "Whatever is already on your mind, however untidy. You do not need an opening line, a goal, or a tidy description of the problem — a few lines is a complete use of it. The people who get most from Imotara open it when something is already bothering them, rather than waiting for a calm moment to reflect properly.",
    },
    {
        id: "does-it-remember",
        section: "Using it",
        q: "Does Imotara remember what I told it before?",
        a: "Yes, within your own history. It can refer back to what you have said and show you how your mood has moved over weeks and months. If you are signed in, that history follows you between your phone and your computer; if you are not, it stays on the one device.",
    },
    {
        id: "works-offline",
        section: "Using it",
        q: "Does Imotara work without an internet connection?",
        a: "Mostly, yes. The core of it — somewhere to put a thought — keeps working on your device without a connection, so a train, a basement or a tight data month does not stop you. Some cloud features need a signal, but the conversation itself does not wait for one.",
    },
    {
        id: "what-devices",
        section: "Using it",
        q: "What devices does Imotara work on?",
        a: "Imotara runs in any web browser at www.imotara.com, and as an app on iOS and Android. If you sign in on more than one, your history follows you between them.",
    },
    {
        id: "speak-instead-of-type",
        section: "Using it",
        q: "Can I speak instead of typing?",
        a: "Yes. You can talk to Imotara out loud and have its replies read back to you, in your own language. Some things are easier spoken than written — typing makes you compose, while speaking lets you ramble, and the rambling version is often the more honest one.",
    },

    // ── Difficult moments ───────────────────────────────────────────────────
    {
        id: "ai-app-grief",
        section: "Difficult moments",
        q: "Can an AI app help with grief and loss?",
        a: "It can give you somewhere to say the things you have stopped saying out loud, which for many people is the part that has nowhere else to go. It is not grief counselling and will not pretend to be. Grief arrives long after people stop asking how you are, and at those hours Imotara is awake and will not change the subject.",
    },
    {
        id: "ai-app-anxiety",
        section: "Difficult moments",
        q: "Can I talk to an AI about anxiety?",
        a: "Yes, and many people find it easier than telling someone who will worry about them. Imotara will not diagnose you or tell you what you have, because it cannot and should not. What it can do is let you describe the thing accurately, which is often what makes it smaller.",
    },
    {
        id: "cant-stop-overthinking",
        section: "Difficult moments",
        q: "What can I do when I can't stop overthinking at night?",
        a: "Writing the thought down somewhere outside your head is the step that tends to interrupt the loop. The thought at 2am is rarely new — it is usually the one you were too busy to look at during the day, and it keeps circling because nothing has caught it. Imotara is available at that hour and does not need the thought to be tidy first.",
    },
    {
        id: "lonely-around-people",
        section: "Difficult moments",
        q: "Is it normal to feel lonely even when you're around people?",
        a: "Yes, and it is one of the most commonly described feelings there is. Loneliness is about not being known rather than not being accompanied, which is why a full house can be the loneliest place. Having somewhere to say the thing you cannot say at home is not a substitute for being known, but it is not nothing either.",
    },
    {
        id: "no-words-for-feelings",
        section: "Difficult moments",
        q: "How do I talk about my feelings when I don't have the words?",
        a: "Describe it badly. \"Like something is about to go wrong but nothing is\" or \"fine but flat\" is more useful than picking the nearest word from a list. Imotara works from what you actually wrote rather than asking you to choose a mood from a menu, and naming a feeling accurately is often most of the relief.",
    },
    {
        id: "exam-stress",
        section: "Difficult moments",
        q: "What helps with exam stress?",
        a: "Naming which part of it is actually heavy — the subject, the time, your family's expectations, or what happens afterwards — usually helps more than general advice about studying. Those pressures tend to arrive at night, when counselling services are closed. Imotara is available then, in your own language, and nobody has to know you used it.",
    },

    // ── Safety and age ──────────────────────────────────────────────────────
    {
        id: "crisis",
        section: "Safety and age",
        q: "What happens if I'm in crisis?",
        a: "Imotara will show you the crisis numbers for your own country and encourage you to use them, because it is not an emergency service and cannot contact one for you. In India, for example, that is Tele-MANAS on 14416 or 112 for emergencies; elsewhere it shows your country's own lines, and where it does not have them it points you to findahelpline.com, which lists free helplines worldwide. Please contact a real service — Imotara is not monitored in real time and may not recognise every expression of distress.",
    },
    {
        id: "is-it-safe",
        section: "Safety and age",
        q: "Is it safe to tell an AI how I feel?",
        a: "With Imotara, what you write stays private: it is not sold, not used to advertise to you, and not readable by anyone else. The honest caveat is that no AI is a substitute for a person who can act — if you are in danger, something that can only reply is not enough, and Imotara will tell you so rather than keep the conversation going.",
    },
    {
        id: "minimum-age",
        section: "Safety and age",
        q: "How old do you have to be to use Imotara?",
        a: "You must be 13 or older, and if you are under 18 a parent or guardian needs to agree to your use of Imotara. Where the law where you live sets a higher age, that higher age applies. Everyone is asked to accept this the first time they open it.",
    },
];
