// src/app/bn/page.tsx — Bengali multilingual landing page (server component, SSR)
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Imotara — আপনার আবেগের একজন অমর বন্ধু",
  description:
    "Imotara একটি শান্ত, ব্যক্তিগত AI সঙ্গী যা আপনার আবেগ শোনে, মনে রাখে এবং বিচার ছাড়াই সাড়া দেয়। কোনো বিজ্ঞাপন নেই, কোনো নজরদারি নেই।",
  keywords: [
    "Imotara বাংলা",
    "AI মানসিক সঙ্গী",
    "মানসিক স্বাস্থ্য অ্যাপ",
    "আবেগ ট্র্যাকার",
    "AI মুড ট্র্যাকার",
    "ভাবনার ডায়েরি",
    "ব্যক্তিগত AI চ্যাট",
    "মানসিক সুস্থতা অ্যাপ",
  ],
  alternates: {
    canonical: `${SITE_URL}/bn`,
    languages: {
      en: `${SITE_URL}/`,
      hi: `${SITE_URL}/hi`,
      bn: `${SITE_URL}/bn`,
      ta: `${SITE_URL}/ta`,
      "x-default": `${SITE_URL}/`,
    },
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/bn`,
    siteName: "Imotara",
    title: "Imotara — আপনার আবেগের একজন অমর বন্ধু",
    description:
      "একজন AI সঙ্গী যে শোনে, মনে রাখে এবং আপনার সাথে বাড়ে — নিঃশব্দে, নৈতিকভাবে এবং চিরকালের জন্য।",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara" }],
    locale: "bn_BD",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imotara — আপনার আবেগের একজন অমর বন্ধু",
    description:
      "একজন AI সঙ্গী যে শোনে, মনে রাখে এবং আপনার সাথে বাড়ে — নিঃশব্দে, নৈতিকভাবে এবং চিরকালের জন্য।",
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function BengaliPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Imotara — আপনার আবেগের একজন অমর বন্ধু",
    url: `${SITE_URL}/bn`,
    inLanguage: "bn",
    description:
      "Imotara একটি শান্ত, ব্যক্তিগত AI আবেগ সঙ্গী। এটি আপনার অনুভূতি শোনে, মনে রাখে এবং আপনার প্যাটার্ন বোঝে — বিজ্ঞাপন ছাড়া, নজরদারি ছাড়া।",
    isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Imotara" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        lang="bn"
        className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-4 py-16 sm:py-24"
      >
        <div className="w-full space-y-10">
          {/* Hero */}
          <div className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              <span>Imotara · আবেগ সঙ্গী</span>
            </div>

            <h1 className="mt-4 text-left text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
              আপনার আবেগের
              <br />
              <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
                একজন অমর বন্ধু
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-left text-base leading-7 text-zinc-300 sm:text-lg">
              Imotara নিঃশব্দে শোনে, কোমলভাবে মনে রাখে এবং আপনার আবেগের
              প্যাটার্ন আপনাকে ফিরিয়ে দেয় — কোনো বিচার ছাড়াই, আপনার
              গোপনীয়তার গভীর সম্মানের সাথে।
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/70"
                  aria-label="Imotara-র সাথে চ্যাট শুরু করুন"
                >
                  <span>শুরু করুন</span>
                  <span className="text-xs opacity-80">/chat</span>
                </Link>

                <Link
                  href="/history"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-100 shadow-sm transition hover:bg-white/10"
                  aria-label="আপনার আবেগ ইতিহাস দেখুন"
                >
                  <span>ইতিহাস দেখুন</span>
                </Link>
              </div>

              <p className="max-w-sm text-xs text-zinc-400">
                ডিফল্টে লোকাল-ফার্স্ট। আপনার কথাগুলো এই ব্রাউজারেই সংরক্ষিত।
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                চ্যাট
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                যেকোনো কিছু শেয়ার করুন — Imotara একটি সহজ, ব্যক্তিগত চ্যাটে
                কোমল ও প্রাসঙ্গিক সাড়া দেয়।
              </p>
              <Link
                href="/chat"
                className="mt-3 inline-block text-[11px] font-medium text-sky-300 underline-offset-2 hover:underline"
              >
                চ্যাট খুলুন →
              </Link>
            </div>

            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                আবেগ ইতিহাস
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                একটি শান্ত টাইমলাইন ও মিনি-ভিজ্যুয়ালাইজেশনের সাথে দেখুন
                দিন ও সপ্তাহ ধরে আপনার অনুভূতি কীভাবে পরিবর্তিত হয়।
              </p>
              <Link
                href="/history"
                className="mt-3 inline-block text-[11px] font-medium text-emerald-300 underline-offset-2 hover:underline"
              >
                ইতিহাস দেখুন →
              </Link>
            </div>

            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                গোপনীয়তা প্রথমে
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                কোনো বিজ্ঞাপন নেই। কোনো নজরদারি নেই। ডিফল্টে ডিভাইসে —
                দূরবর্তী বিশ্লেষণ শুধুমাত্র আপনার সম্মতিতে।
              </p>
            </div>
          </div>

          {/* Why different */}
          <div className="imotara-glass-soft px-6 py-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Imotara কেন আলাদা
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-sky-300">◆</span>
                <span>সোশ্যাল মিডিয়া নয় — কোনো ফিড, লাইক, ফলোয়ার বা সর্বজনীন প্রদর্শন নেই।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-300">◆</span>
                <span>সাধারণ চ্যাটবট নয় — ইতিহাস ও টাইমলাইনের সাথে সময়ের সাথে আপনার প্যাটার্ন প্রতিফলিত করে।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-indigo-300">◆</span>
                <span>২২টি ভাষায় পাওয়া যায় — বাংলা, হিন্দি, তামিল এবং আরো অনেক।</span>
              </li>
            </ul>
          </div>

          {/* App download */}
          <div className="imotara-glass-soft px-5 py-6 sm:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              অ্যাপ ডাউনলোড করুন
            </p>
            <p className="mt-1.5 text-sm text-zinc-300">
              Imotara সাথে নিয়ে যান — ভয়েস ইনপুট, অফলাইন সাপোর্ট এবং
              মোবাইলে মুড ট্রেন্ড।
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.imotara.imotara"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google Play-তে Imotara ডাউনলোড করুন"
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700/60 to-sky-700/60 text-emerald-200 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M3.18 23.76a2 2 0 0 0 2.05-.22l11.59-6.7-2.83-2.83-10.81 9.75ZM.5 1.05A2 2 0 0 0 0 2.4v19.2a2 2 0 0 0 .5 1.35L.6 23l10.76-10.76v-.25L.6 1.13l-.1-.08ZM20.33 10.54l-2.77-1.6-3.15 3.14 3.15 3.15 2.79-1.61a2.01 2.01 0 0 0 0-3.08ZM3.18.24 13.99 6.94l-2.83 2.83L.6 1.05l.07-.07A2 2 0 0 1 3.18.24Z"/>
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-500">Get it on</p>
                  <p className="text-xs font-semibold text-zinc-200">Google Play</p>
                </div>
              </a>

              <a
                href="https://apps.apple.com/app/imotara/id6756697569"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="App Store-এ Imotara ডাউনলোড করুন"
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-200 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z"/>
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-500">Download on the</p>
                  <p className="text-xs font-semibold text-zinc-200">App Store</p>
                </div>
              </a>
            </div>
          </div>

          {/* Language switcher */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span>ভাষা পরিবর্তন করুন:</span>
            <Link href="/" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">English</Link>
            <Link href="/hi" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">हिंदी</Link>
            <Link href="/ta" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">தமிழ்</Link>
          </div>
        </div>
      </section>
    </>
  );
}
