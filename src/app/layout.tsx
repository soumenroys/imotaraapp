// src/app/layout.tsx
import "./globals.css";
import { BUSINESS } from "@/lib/imotara/businessIdentity";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import SiteHeader from "@/components/SiteHeader";
import MobileTabBar from "@/components/imotara/MobileTabBar";
import SiteFooter from "@/components/SiteFooter";
import SiteFooterSlot from "@/components/SiteFooterSlot";
import LocalDataNotice from "@/components/imotara/LocalDataNotice";
import FirstVisitBanner from "@/components/imotara/FirstVisitBanner";
import ServiceWorkerRegistration from "@/components/imotara/ServiceWorkerRegistration";
import OnboardingTour from "@/components/imotara/OnboardingTour";
import OfflineIndicator from "@/components/imotara/OfflineIndicator";
import PWAInstallPrompt from "@/components/imotara/PWAInstallPrompt";
import AppearanceInit from "@/components/imotara/AppearanceInit";
import RtlInit from "@/components/imotara/RtlInit";
import ConsentGateMount from "@/components/legal/ConsentGateMount";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import PageTransition from "@/components/imotara/PageTransition";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = (() => {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = (process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  // ✅ Production-safe fallback (prevents localhost leaking into canonical/og/JSON-LD)
  if (process.env.NODE_ENV === "production") {
    return "https://imotara.com";
  }

  // Local dev fallback only
  return "http://localhost:3000";
})();


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // ⬇️ Title template so child pages can just set "About", "History", etc.
  title: {
    default: "Imotara — An Immortal Friend for Your Emotions",
    template: "%s · Imotara",
  },
  description:
    "A quiet, charitable exploration at the edge of feeling, memory and meaning. A companion that notices — without surveillance or ads.",
  keywords: [
    "Imotara",
    "emotional wellness app",
    "private companion app",
    "mental health app",
    "emotional support app",
    "mood tracker",
    "mental wellness",
    "emotional wellbeing",
    "digital companion",
    "private companion",
    "multilingual mental health",
    "private companion",
    "emotional diary",
    "mood journal app",
    "anxiety support app",
    "mindfulness app",
    "therapy alternative companion",
    "emotional intelligence app",
    "free mental health app",
    "mental wellness Android app",
    "emotional health tracker",
    "private chat for mental health",
  ],
  authors: [{ name: "Soumen Roy", url: "https://soumenroy.com" }],
  category: "Health & Fitness",
  applicationName: "Imotara",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Imotara",
    title: "Imotara — An Immortal Friend for Your Emotions",
    description:
      "A companion that listens, remembers, and grows with your emotions — quietly, ethically, and forever.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Imotara — An Immortal Friend for Your Emotions",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imotara — An Immortal Friend for Your Emotions",
    description:
      "An emotion-aware companion that listens, learns, and grows with you — quietly, ethically, and forever.",
    // ⇒ businessIdentity.ts — never retype a handle here.
    creator: BUSINESS.social.xHandle,
    site: BUSINESS.social.xHandle,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      en: siteUrl,
      hi: `${siteUrl}/hi`,
      bn: `${siteUrl}/bn`,
      ta: `${siteUrl}/ta`,
      "x-default": siteUrl,
    },
    types: { "application/rss+xml": `${siteUrl}/rss.xml` },
  },
  verification: {
    other: { "msvalidate.01": "4D1BBE1B8C26A4D773C28607EF863177" },
  },
  // 🔓 Allow search engines to index and follow links (public release)
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

function JsonLd() {
  const site = siteUrl;

  // 🔑 E-E-A-T, and every field below is VERIFIABLE.
  //
  // For a health-adjacent site Google wants to know who stands behind the
  // content: a real legal entity, a real postal address, a real way to reach a
  // human. Those are also the signals an AI assistant uses when deciding
  // whether a page is worth citing — a site that will not say who it is does
  // not get quoted.
  //
  // ⛔ EVERY STRING COMES FROM businessIdentity.ts, never retyped here. That
  // module is matched to the firm PAN and the bank account because a payment
  // aggregator rejects a mismatch outright, which makes it the most carefully
  // checked set of facts in this repository. Hardcoding them here would create
  // a second copy that drifts, and the drifting one would be the public one.
  //
  // ⛔ NO `Person` AND NO MEDICAL REVIEWER. Health sites routinely carry
  // "reviewed by Dr X" markup, and it is the single most tempting thing to
  // fabricate for E-E-A-T. Nobody clinical reviews this content, so claiming it
  // would be a lie told in machine-readable form on a mental-health site.
  // `author` stays the organisation, which is true.
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BUSINESS.brand,
    legalName: BUSINESS.legalName,
    url: site,
    logo: { "@type": "ImageObject", url: `${site}/og-image.png` },
    email: BUSINESS.email,
    // 🔴 CITY LEVEL ONLY, AND NO TELEPHONE. Owner's instruction, 2026-10-16:
    // keep the registered address and phone out of the public domain as far as
    // possible.
    //
    // ⚠️ They are NOT secret — /contact and /refunds publish both in full
    // because Razorpay will not enable payments for a site that does not, and
    // those strings must match the KYC record exactly. What this avoids is
    // RE-publishing them in machine-readable form, where they are trivially
    // scraped at scale and end up in data brokers rather than read by a person
    // who needed to contact us.
    //
    // 🔑 City, region and country are enough for the E-E-A-T signal: they tell
    // a search engine the entity is a real organisation operating from a real
    // place. The street line and the phone add nothing a crawler needs.
    // ⛔ Do not "complete" this block by adding them back.
    address: {
      "@type": "PostalAddress",
      addressLocality: BUSINESS.address.city,
      addressRegion: BUSINESS.address.state,
      addressCountry: "IN",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: BUSINESS.email,
      availableLanguage: ["English", "Hindi", "Bengali"],
    },
    // 🔴 Said plainly, in the markup, because this is the sentence that most
    // needs to survive being quoted without the page around it.
    description:
      "Imotara is a private emotional wellness companion available in 22 languages. It is not therapy, it does not diagnose, and it is not a crisis service.",
    // 🔑 sameAs is how a search engine ties this entity to its profiles. A
    // WRONG entry is worse than none — it claims a stranger's account is ours.
    // All of these come from businessIdentity.ts. ⇒ owner's social table.
    sameAs: [
      BUSINESS.social.x,
      BUSINESS.social.instagram,
      BUSINESS.social.youtube,
      BUSINESS.social.linkedin,
      BUSINESS.social.facebook,
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
      "https://apps.apple.com/in/app/imotara/id6756697569",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: site,
    name: "Imotara",
    description:
      "Imotara is a free private emotional wellness companion. Talk about how you feel, track your mood, and get gentle support — in your language, at your pace.",
    publisher: { "@type": "Organization", name: "Imotara", url: site },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site}/blog?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  const mobileApp = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "Imotara — Emotional Wellness Companion",
    operatingSystem: ["ANDROID", "IOS"],
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Mental Health",
    description:
      "Imotara is your private emotional wellness companion. Talk about how you feel, track your mood, and get gentle support in 22 languages — with no ads, no surveillance.",
    url: site,
    downloadUrl: [
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
      "https://apps.apple.com/in/app/imotara/id6756697569",
    ],
    installUrl: [
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
      "https://apps.apple.com/in/app/imotara/id6756697569",
    ],
    screenshot: `${site}/og-image.png`,
    featureList: [
      "Private companion chat for emotional support",
      "Mood history timeline and trend analysis",
      "22 languages supported",
      "Local-first — data stays on your device by default",
      "Optional cloud sync with explicit consent",
      "Voice input",
      "No ads, no social feed, no public profiles",
      "Offline support",
      "Breathing and mindfulness exercises",
      "Conversation bookmarks and search",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: { "@type": "Organization", name: "Imotara", url: site },
    // 🔑 The Wikidata item is typed "mobile app / web application", which is
    // exactly this node. It is what an assistant reads to learn what Imotara
    // IS, rather than what it says about itself. ⇒ businessIdentity.ts
    sameAs: [BUSINESS.wikidata],
    inLanguage: [
      "en","es","hi","fr","bn","ar","pt","de","ja","ru","he","id","zh",
      "ta","te","ml","kn","mr","gu","pa","ur","or",
    ],
    keywords:
      "emotional wellness companion, mental health, mood tracker, multilingual, anxiety support, mindfulness, therapy alternative, talk about feelings, private mental health app",
  };

  const webApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Imotara — Emotional Wellness Companion",
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Mental Health",
    operatingSystem: "Web",
    description:
      "Imotara is a free private companion for emotional wellness. Talk about your feelings, track your mood, and get gentle reflections — privately, in 22 languages, with no ads.",
    url: site,
    featureList: [
      "Private companion chat for emotional support",
      "Mood history timeline",
      "22 languages supported",
      "Works offline as a PWA",
      "Local-first storage — no account needed",
      "Optional cloud sync",
      "No ads or social feed",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: { "@type": "Organization", name: "Imotara", url: site },
    // Same item as the MobileApplication node above: Wikidata records one
    // Imotara that is both a mobile app and a web application, so both nodes
    // point at it rather than inventing a second entity for the web build.
    sameAs: [BUSINESS.wikidata],
  };


  // ⛔ ALL FOUR ARE EMITTED HERE. On 2026-10-16 a regex meant to remove ONLY
  // the site-wide faqSchema <script> removed every <script> in this return,
  // leaving the objects defined and nothing rendering them — the site shipped
  // with no Organization, WebSite or app schema at all for one deploy. The
  // tests passed, the build passed, and the check that caught it was reading
  // the PRODUCTION html and counting what was actually there.
  // 🔑 The lesson: verify what survived, not only what you meant to delete.
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileApp) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
      />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="bg-zinc-50 dark:bg-black"
      suppressHydrationWarning
    >
      <head>
        {/*
          Apply the saved appearance BEFORE first paint (UX-21).

          AppearanceInit does the same thing from a useEffect, which by
          definition runs after the browser has already painted — so someone who
          chose light mode watched roughly 150ms of dark page on every
          navigation. Measured, not assumed: 4 of 24 sampled frames were dark,
          with data-theme still null.

          This stays alongside AppearanceInit rather than replacing it. If the
          script is ever blocked or throws, the effect still applies the theme a
          moment later, which is the behaviour we have today. Both write the
          same values, so running twice changes nothing.

          Deliberately tiny and dependency-free: it blocks the first paint, so
          every byte here is a byte before anything appears.

          It also resolves the three-way appearance preference (UX-20). An
          unset preference means "system" for a NEW visitor and "dark" for a
          returning one — someone who has been reading a dark site should not
          arrive one day to find it light because their OS was always light and
          they never touched the setting. That decision is made once and
          written to localStorage so it cannot change under them later. The
          logic here mirrors src/lib/theme/themePref.ts, which is the tested
          copy; this one is inlined because it has to run before paint.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement,s=localStorage,g=function(k,f){var v=s.getItem(k);return v||f},t=s.getItem("imotara.theme.v1");if(t!=="light"&&t!=="dark"&&t!=="system"){var e=false;for(var i=0;i<s.length;i++){var k=s.key(i);if(k&&k.indexOf("imotara.")===0){e=true;break}}t=e?"dark":"system";s.setItem("imotara.theme.v1",t)}var m=t==="system"?((window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark"):t;d.setAttribute("data-theme",m);d.setAttribute("data-theme-pref",t);d.setAttribute("data-accent",g("imotara.accent.v1","indigo"));d.setAttribute("data-fontsize",g("imotara.fontsize.v1","md"))}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} flex min-h-screen flex-col overflow-x-hidden pb-24 text-zinc-900 dark:text-zinc-100`}
      >
        <SiteHeader />
        <MobileTabBar />

        <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-8 sm:px-6 sm:py-10">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* local-storage notice overlays */}
        <LocalDataNotice />
        {/* First-use Terms/Privacy acceptance. Renders nothing once accepted. */}
        <ConsentGateMount />
        <AppearanceInit />
        <RtlInit />
        <FirstVisitBanner />
        <OnboardingTour />
        <OfflineIndicator />
        <PWAInstallPrompt />
        <ServiceWorkerRegistration />
        {/* Renders nothing unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set. */}
        <GoogleAnalytics />

        <JsonLd />
        {/* Hidden on full-height app routes (/chat) — see SiteFooterSlot.
            Passed as children so SiteFooter stays a server component. */}
        <SiteFooterSlot>
          <SiteFooter />
        </SiteFooterSlot>
      </body>
    </html>
  );
}
