import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo/ogImage";

/**
 * 🔴 THE THIRD `"use client"` PAGE FOUND WITHOUT A TITLE, 2026-10-17 — after
 * /help and /pricing/corporate. It inherited the site default, so the page
 * people reach when they are deciding whether to pay had nothing for a search
 * query to match. robots.txt explicitly ALLOWS /upgrade, which makes the
 * omission worse: we invited crawlers to a page we had not described.
 *
 * ⚠️ THE PATTERN, worth saying once: a `"use client"` page cannot export
 * metadata, and Next.js does not warn. It silently inherits the root title.
 * ⇒ Every client page needs a sibling layout like this one.
 *
 * ⛔ No regulated title here either: this sells a plan, not care.
 */
export const metadata: Metadata = {
    title: "Plans and pricing",
    description:
        "What Imotara costs, and what is free. Unlimited cloud replies, history backup, cross-device access and voice options on the paid plan — or keep using the free one. Prices in INR.",
    openGraph: {
        ...OG_IMAGE,
        title: "Imotara — plans and pricing",
        description:
            "What is free, what the paid plan adds, and what it costs. No ads on either.",
        url: "https://www.imotara.com/upgrade",
        siteName: "Imotara",
        type: "website",
    },
    alternates: { canonical: "https://www.imotara.com/upgrade" },
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
