// src/app/hi/page.tsx — Hindi multilingual landing page (server component, SSR)
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Imotara — आपकी भावनाओं का एक अमर दोस्त",
  description:
    "Imotara एक शांत, निजी AI साथी है जो आपकी भावनाओं को सुनता है, याद रखता है, और बिना किसी निर्णय के प्रतिक्रिया देता है। कोई विज्ञापन नहीं, कोई निगरानी नहीं।",
  keywords: [
    "Imotara हिंदी",
    "AI भावनात्मक साथी",
    "मानसिक स्वास्थ्य ऐप",
    "भावनाओं का ट्रैकर",
    "AI मूड ट्रैकर",
    "भावनात्मक डायरी",
    "निजी AI चैट",
    "मानसिक कल्याण ऐप",
  ],
  alternates: {
    canonical: `${SITE_URL}/hi`,
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
    url: `${SITE_URL}/hi`,
    siteName: "Imotara",
    title: "Imotara — आपकी भावनाओं का एक अमर दोस्त",
    description:
      "एक AI साथी जो सुनता है, याद रखता है, और आपके साथ बढ़ता है — चुपचाप, नैतिक रूप से, और हमेशा के लिए।",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara" }],
    locale: "hi_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imotara — आपकी भावनाओं का एक अमर दोस्त",
    description:
      "एक AI साथी जो सुनता है, याद रखता है, और आपके साथ बढ़ता है — चुपचाप, नैतिक रूप से, और हमेशा के लिए।",
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function HindiPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Imotara — आपकी भावनाओं का एक अमर दोस्त",
    url: `${SITE_URL}/hi`,
    inLanguage: "hi",
    description:
      "Imotara एक शांत, निजी AI भावनात्मक साथी है। यह आपकी भावनाओं को सुनता है, याद रखता है, और आपके पैटर्न को समझता है — बिना विज्ञापन, बिना निगरानी।",
    isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Imotara" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        lang="hi"
        className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-4 py-16 sm:py-24"
      >
        <div className="w-full space-y-10">
          {/* Hero */}
          <div className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              <span>Imotara · भावनात्मक साथी</span>
            </div>

            <h1 className="mt-4 text-left text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
              आपकी भावनाओं का
              <br />
              <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
                एक अमर दोस्त
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-left text-base leading-7 text-zinc-300 sm:text-lg">
              Imotara चुपचाप सुनता है, कोमलता से याद रखता है, और आपके भावनात्मक
              पैटर्न को बिना किसी निर्णय के दर्शाता है — आपकी गोपनीयता के प्रति
              गहरे सम्मान के साथ।
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/70"
                  aria-label="Imotara के साथ चैट शुरू करें"
                >
                  <span>शुरू करें</span>
                  <span className="text-xs opacity-80">/chat</span>
                </Link>

                <Link
                  href="/history"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-100 shadow-sm transition hover:bg-white/10"
                  aria-label="अपना भावना इतिहास देखें"
                >
                  <span>इतिहास देखें</span>
                </Link>
              </div>

              <p className="max-w-sm text-xs text-zinc-400">
                डिफ़ॉल्ट रूप से लोकल-फर्स्ट। आपके शब्द इसी ब्राउज़र में संग्रहीत हैं।
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                चैट
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                कुछ भी साझा करें — Imotara एक सरल, निजी चैट में कोमल और
                संदर्भ-संवेदनशील प्रतिक्रिया देता है।
              </p>
              <Link
                href="/chat"
                className="mt-3 inline-block text-[11px] font-medium text-sky-300 underline-offset-2 hover:underline"
              >
                चैट खोलें →
              </Link>
            </div>

            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                भावना इतिहास
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                एक शांत टाइमलाइन और मिनी-विज़ुअलाइज़ेशन के साथ देखें कि आपकी
                भावनाएँ दिनों और हफ्तों में कैसे बदलती हैं।
              </p>
              <Link
                href="/history"
                className="mt-3 inline-block text-[11px] font-medium text-emerald-300 underline-offset-2 hover:underline"
              >
                इतिहास देखें →
              </Link>
            </div>

            <div className="imotara-glass-soft p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                गोपनीयता पहले
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                कोई विज्ञापन नहीं। कोई निगरानी नहीं। डिफ़ॉल्ट रूप से डिवाइस पर —
                रिमोट विश्लेषण केवल आपकी सहमति से।
              </p>
            </div>
          </div>

          {/* Why different */}
          <div className="imotara-glass-soft px-6 py-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Imotara अलग क्यों है
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-sky-300">◆</span>
                <span>सोशल मीडिया नहीं — कोई फीड, लाइक्स, फॉलोअर्स या सार्वजनिक प्रदर्शन नहीं।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-300">◆</span>
                <span>सामान्य चैटबॉट नहीं — यह इतिहास और टाइमलाइन के साथ आपके पैटर्न को समय के साथ दर्शाता है।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-indigo-300">◆</span>
                <span>22 भाषाओं में उपलब्ध — हिंदी, बंगाली, तमिल, और अधिक।</span>
              </li>
            </ul>
          </div>

          {/* App download */}
          <div className="imotara-glass-soft px-5 py-6 sm:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              ऐप डाउनलोड करें
            </p>
            <p className="mt-1.5 text-sm text-zinc-300">
              Imotara को अपने साथ ले जाएं — वॉयस इनपुट, ऑफलाइन सपोर्ट और
              मोबाइल पर मूड ट्रेंड।
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.imotara.imotara"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google Play पर Imotara डाउनलोड करें"
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
                href="https://apps.apple.com/in/app/imotara/id6756697569"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="App Store पर Imotara डाउनलोड करें"
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
            <span>भाषा बदलें:</span>
            <Link href="/" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">English</Link>
            <Link href="/bn" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">বাংলা</Link>
            <Link href="/ta" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">தமிழ்</Link>
          </div>
        </div>
      </section>
    </>
  );
}
