// src/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SyncStatusBar from "@/components/imotara/SyncStatusBar";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Imotara — An Immortal Friend for Your Emotions",
  description:
    "A quiet, charitable exploration at the edge of feeling, memory and meaning. A companion that notices — without surveillance or ads.",
  keywords: [
    "Imotara",
    "AI friend",
    "emotional wellbeing",
    "digital companion",
    "ethical AI",
    "mental health",
    "empathy",
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
    creator: "@imotara",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: siteUrl,
  },
};

function JsonLd() {
  const site = siteUrl;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: site,
    name: "Imotara",
    description: "An immortal friend for your emotions.",
    publisher: {
      "@type": "Organization",
      name: "Imotara",
      url: site,
      logo: {
        "@type": "ImageObject",
        url: `${site}/og-image.png`,
      },
    },
    inLanguage: "en",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
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
        className={`${inter.className} flex min-h-screen flex-col text-zinc-900 dark:text-zinc-100`}
      >
        <SiteHeader />

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          {children}
        </main>

        {/* Existing global sync bar (keep for now; remove later if redundant) */}
        <SyncStatusBar />

        <JsonLd />
        <SiteFooter />
      </body>
    </html>
  );
}
