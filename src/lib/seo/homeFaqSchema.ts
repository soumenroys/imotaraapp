// src/lib/seo/homeFaqSchema.ts
//
// The FAQPage schema for the HOMEPAGE, and only the homepage.
//
// 🔴 WHY IT MOVED HERE, 2026-10-16. It used to live in the root layout, which
// meant EVERY page on the site emitted it — /privacy, /blog, /terms, all of
// them claimed to be an FAQ page. Measured against production: the first
// question, "What is Imotara?", is visible on the homepage (legitimate) and
// NOT visible on /privacy (markup describing content that is not there).
//
// ⚠️ It also collided. /answers/*, /compare/* and /faq/<lang> each emit their
// OWN FAQPage, so those URLs carried two FAQPage entities at once and a
// crawler had no way to tell which described the page.
//
// ⛔ Google requires FAQPage markup to match content VISIBLE on that page.
// Since FAQ rich results were deprecated for every site on 7 May 2026, a
// site-wide FAQPage bought nothing and risked exactly that mismatch. It is
// kept at all only because structured Q&A is what LLM retrieval quotes.

export const HOME_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Imotara?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Imotara is a free, private emotional wellness companion available on web, Android, and iOS. It helps you talk about your feelings, track your mood over time, and receive gentle, thoughtful reflections — in 22 languages, with no ads, no social feed, and full privacy control.",
      },
    },
    {
      "@type": "Question",
      name: "Is Imotara free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Imotara is free to use and no subscription is required. Free includes 20 full replies a day (simpler replies made on your phone after that) and your last 7 days of history; Imotara Plus adds unlimited replies, full history and deeper insights.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private on Imotara?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your conversations are saved securely in Imotara's cloud — when you're signed in, they follow you to your other devices. You can delete your account and everything in it anytime in Settings. To reply, messages go to our service providers. Imotara has no ads, no tracking and never sells your data.",
      },
    },
    {
      "@type": "Question",
      name: "What languages does Imotara support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Imotara supports 22 languages including English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, Spanish, French, German, Portuguese, Russian, Arabic, Chinese, Japanese, Hebrew, and Indonesian.",
      },
    },
    {
      "@type": "Question",
      name: "Is there an Imotara mobile app?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Imotara is available on Android via Google Play and on iOS via the App Store, in addition to the web app at https://imotara.com.",
      },
    },
    {
      "@type": "Question",
      name: "Is Imotara a replacement for therapy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Imotara is a private wellness companion for self-reflection and emotional awareness, not a medical or therapeutic service. It is designed to complement — not replace — professional mental health care.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Imotara offline?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Partly. Without a connection the app can still give simpler replies made on your phone; full replies need the internet.",
      },
    },
    {
      "@type": "Question",
      name: "How does Imotara work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Replies are written by software at our service providers, in the language you use. In Settings you can choose simpler replies made on your phone instead.",
      },
    },
  ],
};
