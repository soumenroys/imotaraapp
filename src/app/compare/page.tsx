// src/app/compare/page.tsx
//
// The index for the decision pages. Exists so the five are not orphans: a page
// nothing links to is a page Google crawls late and an assistant never finds.
// ⇒ src/data/comparePages.ts carries the reasoning and every verified fact.

import type { Metadata } from "next";
import Link from "next/link";

import { COMPARE_PAGES, COMPARE_SLUGS } from "@/data/comparePages";
import { OG_IMAGE } from "@/lib/seo/ogImage";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
    title: "Honest comparisons — Imotara",
    description:
        "Is an AI companion the same as therapy? Should you talk to a person instead? What a free tier should include, how to choose an app, and which ones work in Indian languages.",
    alternates: { canonical: `${SITE_URL}/compare` },
    openGraph: {
            ...OG_IMAGE,
        type: "website",
        url: `${SITE_URL}/compare`,
        siteName: "Imotara",
        title: "Honest comparisons — Imotara",
    },
};

export default function CompareIndexPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="page-title">
            <p className="text-xs font-medium uppercase tracking-widest text-sky-400">
                Imotara · Honest comparison
            </p>
            <h1
                id="page-title"
                className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
            >
                Questions worth asking before you pick anything
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">
                Every one of these answers the question directly in the first paragraph, and every one
                says where Imotara is the wrong choice. If that costs us a sign-up, it was not a
                sign-up worth having.
            </p>

            <ul className="mt-8 space-y-4">
                {COMPARE_SLUGS.map((slug) => {
                    const page = COMPARE_PAGES[slug];
                    return (
                        <li key={slug}>
                            <Link
                                href={`/compare/${slug}`}
                                className="block rounded-2xl border border-zinc-800 px-5 py-4 transition hover:border-zinc-600"
                            >
                                <h2 className="text-lg font-semibold text-zinc-100">{page.question}</h2>
                                <p className="mt-2 text-sm leading-6 text-zinc-400">{page.shortAnswer}</p>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}
