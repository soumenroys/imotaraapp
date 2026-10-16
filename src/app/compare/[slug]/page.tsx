// src/app/compare/[slug]/page.tsx
//
// The decision pages: /compare/ai-companion-vs-therapy and its four siblings.
//
// 🔑 WHY. Search Console, three months to 2026-10-16: 111 impressions across
// SEVEN queries, six of them the brand name. The site ranks at position 6.2
// with a 17.1% CTR and is simply never shown. The one non-brand query was
// question-shaped and conversational; these pages are that shape, aimed at the
// decision someone is actually making rather than at what Imotara wants to say.
//
// ⛔ NO NAMED-COMPETITOR CLAIMS — the reasoning is in src/data/comparePages.ts.
// Comparisons are against categories (therapy, a human, paid tiers), which is
// both what people search and the version nobody has to maintain or defend.
//
// 🔴 EVERY PAGE RENDERS ITS `notFor` LIST, prominently and not in a footnote.
// A page that only sells is the page an assistant declines to quote, and in a
// wellness product overclaiming is a safety problem before it is a marketing
// one.
//
// ⚠️ FAQPage markup is still emitted even though Google **deprecated FAQ rich
// results on 7 May 2026** for every site, government and health included. It
// stays because it is valid Schema.org and because structured question/answer
// pairs are what LLM retrieval quotes — and a third of this site's impressions
// already come from Google's generative features. ⛔ Do not add FAQ markup
// anywhere NEW expecting rich results; that return is now zero.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publisherNode, NOT_THERAPY_SCHEMA_NOTE } from "@/lib/seo/publisher";

import { COMPARE_PAGES, comparePageFor, type CompareSlug } from "@/data/comparePages";
import { OG_IMAGE } from "@/lib/seo/ogImage";

const SITE_URL = "https://www.imotara.com";

/**
 * ⛔ A REAL 404, not a 200 that renders the 404 page — the same soft-404 trap
 * fixed across /faq, /for and /blog on 2026-10-16. Anything outside
 * generateStaticParams is a genuine 404 and is never rendered.
 * ⇒ node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 *   02-route-segment-config/dynamicParams.md
 */
export const dynamicParams = false;

export function generateStaticParams() {
    return Object.keys(COMPARE_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const page = comparePageFor(slug);
    if (!page) return {};
    const url = `${SITE_URL}/compare/${page.slug}`;
    return {
        title: page.metaTitle,
        description: page.metaDescription,
        keywords: page.keywords,
        alternates: { canonical: url },
        openGraph: {
            ...OG_IMAGE,
            type: "article",
            url,
            siteName: "Imotara",
            title: page.metaTitle,
            description: page.metaDescription,
        },
    };
}

export default async function ComparePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const page = comparePageFor(slug as CompareSlug);
    if (!page) notFound();

    const url = `${SITE_URL}/compare/${page.slug}`;

    // ⚠️ Generated from the same data the page renders below. Two hand-kept
    // copies drift, and the one search engines read is the one nobody looks at.
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        // 🔑 Attribution lives INSIDE the schema, because an assistant quotes
        // one answer with no page around it. ⇒ src/lib/seo/publisher.ts
        publisher: publisherNode(),
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: "Imotara", url: SITE_URL },
        // 🔴 Travels with the quote, deliberately.
        disambiguatingDescription: NOT_THERAPY_SCHEMA_NOTE,
        mainEntity: [
            {
                "@type": "Question",
                name: page.question,
                acceptedAnswer: { "@type": "Answer", text: page.shortAnswer },
            },
            ...page.sections.map((s) => ({
                "@type": "Question",
                name: s.heading,
                acceptedAnswer: { "@type": "Answer", text: s.body.join(" ") },
            })),
        ],
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Imotara", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
            { "@type": "ListItem", position: 3, name: page.question, item: url },
        ],
    };

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="page-title">
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />

            <div className="space-y-8">
                <section>
                    <p className="text-xs font-medium uppercase tracking-widest text-sky-400">
                        Imotara · Honest comparison
                    </p>
                    <h1
                        id="page-title"
                        className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
                    >
                        {page.question}
                    </h1>

                    {/* 🔑 The direct answer, first and plainly. This is the
                        paragraph an assistant lifts, and the one a reader who
                        scrolls no further still leaves with. */}
                    <p className="mt-4 rounded-2xl border border-sky-500/25 bg-sky-500/8 px-5 py-4 text-base leading-7 text-zinc-100">
                        {page.shortAnswer}
                    </p>
                </section>

                <section aria-labelledby="at-a-glance">
                    <h2 id="at-a-glance" className="text-xl font-semibold text-zinc-100">
                        At a glance
                    </h2>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-700">
                                    <th scope="col" className="py-2 pr-4 font-medium text-zinc-400">
                                        &nbsp;
                                    </th>
                                    <th scope="col" className="py-2 pr-4 font-medium text-sky-300">
                                        {page.columns.imotara}
                                    </th>
                                    <th scope="col" className="py-2 font-medium text-zinc-400">
                                        {page.columns.other}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.rows.map((row) => (
                                    <tr key={row.criterion} className="border-b border-zinc-800 align-top">
                                        <th scope="row" className="py-3 pr-4 font-medium text-zinc-200">
                                            {row.criterion}
                                        </th>
                                        <td className="py-3 pr-4 leading-6 text-zinc-300">{row.imotara}</td>
                                        <td className="py-3 leading-6 text-zinc-400">{row.other}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {page.sections.map((section) => (
                    <section key={section.heading}>
                        <h2 className="text-xl font-semibold text-zinc-100">{section.heading}</h2>
                        {section.body.map((para) => (
                            <p key={para.slice(0, 40)} className="mt-3 text-base leading-7 text-zinc-300">
                                {para}
                            </p>
                        ))}
                    </section>
                ))}

                {/* 🔴 Where Imotara is the WRONG answer. Deliberately given the
                    same visual weight as everything above it, not tucked away. */}
                <section aria-labelledby="not-for" className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-4">
                    <h2 id="not-for" className="text-lg font-semibold text-amber-200">
                        When Imotara is not the right answer
                    </h2>
                    <ul className="mt-3 space-y-2">
                        {page.notFor.map((item) => (
                            <li key={item.slice(0, 40)} className="text-sm leading-6 text-amber-100/90">
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="flex flex-wrap gap-3">
                    <Link
                        href="/chat"
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
                    >
                        Try Imotara free
                    </Link>
                    {page.related.map((rel) => (
                        <Link
                            key={rel.href}
                            href={rel.href}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                        >
                            {rel.label}
                        </Link>
                    ))}
                </section>
            </div>
        </main>
    );
}
