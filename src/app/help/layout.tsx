import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo/ogImage";

/**
 * 🔴 WHY THIS FILE EXISTS. /help is a `"use client"` page, and Next.js reads
 * `export const metadata` only from a Server Component — so the page had NO
 * title of its own and fell back to the site default, "Imotara — An Immortal
 * Friend for Your Emotions". A page with no distinct title cannot rank for its
 * own topic, because there is nothing for a query to match.
 *
 * ⚠️ The same trap caught /pricing/corporate. Any `"use client"` page needs a
 * sibling layout like this one, or it is invisible to search by default.
 */
export const metadata: Metadata = {
    title: "Help — Ask anything about Imotara",
    description:
        "Answers about Imotara: how conversations work, which languages are supported, what stays on your device, voice input, mood history, and what to do in a crisis. Ask a question and get a direct answer.",
    openGraph: {
        ...OG_IMAGE,
        title: "Imotara Help — Ask anything",
        description:
            "Direct answers about how Imotara works — languages, privacy, voice, mood history, and crisis support.",
        url: "https://www.imotara.com/help",
        siteName: "Imotara",
        type: "website",
    },
    // 🔴 www, not the bare host ⇒ see guide/page.tsx.
    alternates: { canonical: "https://www.imotara.com/help" },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
