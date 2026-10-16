// src/app/answers/[slug]/page.tsx
//
// One question, answered properly. ⇒ src/data/answerPages.ts for the editorial
// line and the measured reason these exist.
//
// 🔴 THE `whenToGetHelp` PANEL IS NOT OPTIONAL FURNITURE. Every page here is
// read by someone in the middle of the thing it describes. It renders with the
// same weight as the body, never collapsed and never below the fold of the
// content, and it always names a real service — country-aware, not India-only.
// ⇒ the lesson of imotaraapp 3ef1937, where an undetected country was shown
// Indian numbers and ~140 countries were shown none at all.
//
// ⚠️ FAQPage markup is emitted but NOT for Google: FAQ rich results were
// deprecated for every site on 7 May 2026. It stays because structured Q&A is
// what LLM retrieval quotes, and a third of this site's impressions already
// come from Google's generative features.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publisherNode, NOT_THERAPY_SCHEMA_NOTE } from "@/lib/seo/publisher";

import { ANSWER_PAGES, answerPageFor, type AnswerSlug } from "@/data/answerPages";
import { OG_IMAGE } from "@/lib/seo/ogImage";

const SITE_URL = "https://www.imotara.com";

/** ⛔ A real 404, never a 200 rendering the 404 body. ⇒ commit e011869. */
export const dynamicParams = false;

export function generateStaticParams() {
    return Object.keys(ANSWER_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const page = answerPageFor(slug);
    if (!page) return {};
    const url = `${SITE_URL}/answers/${page.slug}`;
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

export default async function AnswerPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const page = answerPageFor(slug as AnswerSlug);
    if (!page) notFound();

    const url = `${SITE_URL}/answers/${page.slug}`;

    // Generated from the same data rendered below — two hand-kept copies drift,
    // and the one search engines read is the one nobody looks at.
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
            { "@type": "ListItem", position: 2, name: "Answers", item: `${SITE_URL}/answers` },
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
                    <p className="text-xs font-medium uppercase tracking-widest text-sky-400">Imotara</p>
                    <h1
                        id="page-title"
                        className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
                    >
                        {page.question}
                    </h1>
                    {/* The answer, first and plainly. */}
                    <p className="mt-4 rounded-2xl border border-sky-500/25 bg-sky-500/8 px-5 py-4 text-base leading-7 text-zinc-100">
                        {page.shortAnswer}
                    </p>
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

                <section aria-labelledby="try-now">
                    <h2 id="try-now" className="text-xl font-semibold text-zinc-100">
                        Things you could try now
                    </h2>
                    <ul className="mt-3 space-y-2">
                        {page.tryNow.map((item) => (
                            <li key={item.slice(0, 40)} className="text-base leading-7 text-zinc-300">
                                • {item}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 🔴 Always present, always full weight, always names a real service. */}
                <section
                    aria-labelledby="when-to-get-help"
                    className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-4"
                >
                    <h2 id="when-to-get-help" className="text-lg font-semibold text-amber-200">
                        When to talk to someone
                    </h2>
                    <ul className="mt-3 space-y-2">
                        {page.whenToGetHelp.map((item) => (
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
                        Talk it through
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
