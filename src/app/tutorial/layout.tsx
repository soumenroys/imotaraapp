import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutorial — How to Use Imotara",
  description:
    "Complete step-by-step guide to every Imotara feature — chat, voice, emotion tracking, companion setup, TTS, cloud sync, data export, and more. For new and experienced users alike.",
  openGraph: {
    title: "Imotara Tutorial — Every Feature Explained",
    description:
      "Learn how to use Imotara: talk with your AI companion, track emotions, personalize your experience, and understand your data — in 3 levels of detail.",
    url: "https://imotara.com/tutorial",
    siteName: "Imotara",
    type: "website",
  },
  alternates: { canonical: "https://imotara.com/tutorial" },
};

export default function TutorialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
