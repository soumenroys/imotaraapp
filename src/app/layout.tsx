// src/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SyncStatusBar from "@/components/imotara/SyncStatusBar";
import LocalDataNotice from "@/components/imotara/LocalDataNotice";
import FirstVisitBanner from "@/components/imotara/FirstVisitBanner";
import ServiceWorkerRegistration from "@/components/imotara/ServiceWorkerRegistration";
import OnboardingTour from "@/components/imotara/OnboardingTour";
import OfflineIndicator from "@/components/imotara/OfflineIndicator";
import PWAInstallPrompt from "@/components/imotara/PWAInstallPrompt";
import AppearanceInit from "@/components/imotara/AppearanceInit";
import PageTransition from "@/components/imotara/PageTransition";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = (() => {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = (process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  // ✅ Production-safe fallback (prevents localhost leaking into canonical/og/JSON-LD)
  if (process.env.NODE_ENV === "production") {
    return "https://imotaraapp.vercel.app";
  }

  // Local dev fallback only
  return "http://localhost:3000";
})();


export const viewport: Viewport = {
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
    "AI emotional wellness app",
    "AI companion app",
    "mental health app",
    "emotional support app",
    "mood tracker",
    "AI mental health",
    "emotional wellbeing",
    "digital companion",
    "ethical AI",
    "multilingual mental health",
    "AI friend",
    "emotional diary",
    "mood journal app",
    "anxiety support app",
    "mindfulness app",
    "AI therapy companion",
    "emotional intelligence app",
    "free mental health app",
    "mental wellness Android app",
    "emotional health tracker",
    "AI chat for mental health",
  ],
  authors: [{ name: "Soumen Roy", url: "https://soumenroy.com" }],
  category: "AI Companion",
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
    creator: "@imotara4x",
    site: "@imotara4x",
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
      "x-default": siteUrl,
      "en":    siteUrl,
      "bn":    `${siteUrl}?lang=bn`,
      "hi":    `${siteUrl}?lang=hi`,
      "ta":    `${siteUrl}?lang=ta`,
      "te":    `${siteUrl}?lang=te`,
      "kn":    `${siteUrl}?lang=kn`,
      "ml":    `${siteUrl}?lang=ml`,
      "gu":    `${siteUrl}?lang=gu`,
      "pa":    `${siteUrl}?lang=pa`,
      "or":    `${siteUrl}?lang=or`,
      "mr":    `${siteUrl}?lang=mr`,
      "ar":    `${siteUrl}?lang=ar`,
      "zh":    `${siteUrl}?lang=zh`,
      "ja":    `${siteUrl}?lang=ja`,
      "es":    `${siteUrl}?lang=es`,
      "fr":    `${siteUrl}?lang=fr`,
      "de":    `${siteUrl}?lang=de`,
      "pt":    `${siteUrl}?lang=pt`,
      "ru":    `${siteUrl}?lang=ru`,
      "id":    `${siteUrl}?lang=id`,
      "he":    `${siteUrl}?lang=he`,
    },
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

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Imotara",
    url: site,
    logo: { "@type": "ImageObject", url: `${site}/og-image.png` },
    sameAs: [
      "https://twitter.com/imotara4x",
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: site,
    name: "Imotara",
    description:
      "Imotara is a free AI emotional wellness companion. Talk about how you feel, track your mood, and get gentle AI support — in your language, at your pace.",
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
    name: "Imotara — AI Emotional Wellness",
    operatingSystem: ["ANDROID", "IOS"],
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Mental Health",
    description:
      "Imotara is your private AI emotional wellness companion. Talk about how you feel, track your mood, and get gentle AI support in 22 languages — with no ads, no surveillance.",
    url: site,
    downloadUrl: [
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
      "https://apps.apple.com/app/imotara/id6756697569",
    ],
    installUrl: [
      "https://play.google.com/store/apps/details?id=com.imotara.imotara",
      "https://apps.apple.com/app/imotara/id6756697569",
    ],
    screenshot: `${site}/og-image.png`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: { "@type": "Organization", name: "Imotara", url: site },
    inLanguage: [
      "en","es","hi","fr","bn","ar","pt","de","ja","ko","tr","it","zh",
      "ta","te","ml","kn","mr","gu","pa","ur","or",
    ],
    keywords:
      "AI companion, emotional wellness, mental health, mood tracker, multilingual AI, anxiety support, mindfulness",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileApp) }}
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
      <body
        className={`${inter.className} flex min-h-screen flex-col pb-24 text-zinc-900 dark:text-zinc-100`}
      >
        <SiteHeader />

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 pb-28">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* Global sync bar + local-storage notice overlays */}
        <SyncStatusBar />
        <LocalDataNotice />
        <AppearanceInit />
        <FirstVisitBanner />
        <OnboardingTour />
        <OfflineIndicator />
        <PWAInstallPrompt />
        <ServiceWorkerRegistration />

        <JsonLd />
        <SiteFooter />
      </body>
    </html>
  );
}
