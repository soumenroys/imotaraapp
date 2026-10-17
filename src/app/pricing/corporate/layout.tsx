import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo/ogImage";

/**
 * 🔴 WHY THIS FILE EXISTS. This page had no title of its own — a `"use client"`
 * page cannot export metadata, so it inherited the site default. It is the page
 * the NGO and institutional conversations send people to, and the one most
 * likely to be searched for by name of need rather than by brand.
 *
 * ⛔ No regulated title and no claim of care: organisations buy SEATS for a
 * wellbeing companion, not a clinical service ⇒ the note in
 * trap_marketing_copy_claims_a_regulated_title.
 */
export const metadata: Metadata = {
    title: "Seats for organisations — NGOs, schools, companies",
    description:
        "Buy Imotara seats for a team, an NGO, a school or a department. Per-seat annual pricing in INR, an admin dashboard, and no per-person paperwork. Imotara is a wellbeing companion, not a clinical service.",
    openGraph: {
        ...OG_IMAGE,
        title: "Imotara for organisations — seats for teams, NGOs and schools",
        description:
            "Per-seat annual pricing, an admin dashboard, and onboarding without per-person paperwork.",
        url: "https://www.imotara.com/pricing/corporate",
        siteName: "Imotara",
        type: "website",
    },
    alternates: { canonical: "https://www.imotara.com/pricing/corporate" },
};

export default function CorporatePricingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
