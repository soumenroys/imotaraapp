// src/app/faq/page.tsx
//
// The public FAQ — a server-rendered, statically generated page carrying
// FAQPage structured data.
//
// 🔑 WHY THIS PAGE EXISTS, measured rather than assumed. Search Console, three
// months to 2026-10-16: 111 impressions, average position **6.2**, CTR
// **17.1%** — and **seven queries in total**, six of them the brand name or a
// misspelling. So Imotara ranks well and converts well, and is simply never
// shown, because nothing on the site answers anything people type.
//
// The single non-brand query was *"can an ai therapy app help with grief and
// loss processing"* — long, conversational, question-shaped. That is the one
// proven shape, and this page is built entirely in it. There is a question
// here answering exactly that.
//
// ⚠️ **36 of the 111 impressions already came from Google's generative AI
// features** — roughly a third. FAQPage markup is both eligible for rich
// results and among the structures AI surfaces most readily quote, which is
// why the answers are written to stand alone: one may be lifted without the
// rest of the page.
//
// ⛔ DELIBERATELY A SERVER COMPONENT, and deliberately NOT bolted onto /help.
// /help is an interactive client-side assistant; adding to it would have put
// the owner's standing constraint — never degrade reply quality or user
// experience — at risk for no gain. This is additive: a new static route that
// touches nothing that already works.

import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, FAQ_SECTIONS } from "@/data/faq";
import { LANG_FAQ, LANG_FAQ_CODES } from "@/data/faqLang";

const SITE_URL = "https://www.imotara.com";
const URL = `${SITE_URL}/faq`;

export const metadata: Metadata = {
    title: "Imotara FAQ — questions people actually ask",
    description:
        "Straight answers about Imotara: whether it is therapy, what it costs, who can read your conversations, which languages it speaks, and what it does if you are in crisis.",
    // 🔑 RECIPROCAL hreflang. Each Indian-language question page names this
    // one and every sibling; without the return links Google treats the set as
    // unrelated near-duplicates rather than translations of one another.
    alternates: {
        canonical: URL,
        languages: {
            en: URL,
            ...Object.fromEntries(LANG_FAQ_CODES.map((c) => [c, `${URL}/${c}`])),
            "x-default": URL,
        },
    },
    openGraph: {
        title: "Imotara FAQ — questions people actually ask",
        description:
            "Is it therapy? Is it private? Which languages? Straight answers, including the ones that say no.",
        url: URL,
        type: "website",
    },
};

export default function FaqPage() {
    // ⚠️ Generated from the same data the page renders. Two hand-kept copies
    // would drift, and the one search engines read is the one nobody looks at.
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Imotara", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "FAQ", item: URL },
        ],
    };

    return (
        <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />

            <header className="mb-10">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Questions people ask about Imotara
                </h1>
                <p className="mt-3 text-base leading-relaxed text-zinc-400">
                    Straight answers, including the ones that say no. If something here is
                    unclear, write to{" "}
                    <a className="underline hover:text-zinc-200" href="mailto:info@imotara.com">
                        info@imotara.com
                    </a>{" "}
                    and we will answer properly.
                </p>
            </header>

            {FAQ_SECTIONS.map((section) => {
                const items = FAQ.filter((f) => f.section === section);
                if (items.length === 0) return null;
                return (
                    <section key={section} className="mb-10">
                        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                            {section}
                        </h2>
                        <div className="space-y-6">
                            {items.map((item) => (
                                // ⚠️ Real h3 + p, not an accordion. Collapsed content is
                                // weaker for both crawlers and anyone on a slow connection,
                                // and this page is short enough not to need hiding.
                                <div key={item.id} id={item.id} className="scroll-mt-24">
                                    <h3 className="text-base font-semibold text-zinc-100">
                                        {item.q}
                                    </h3>
                                    <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-400">
                                        {item.a}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}

            <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-zinc-500">
                {/* ⚠️ This page is indexed globally and quoted by AI surfaces, so
                    the footer must not read as though India were the only place
                    anyone opens it. India stays as a named example because most
                    readers are there; the directory is what serves the rest. */}
                <p>
                    Imotara is a companion for reflection — not a therapist or a doctor, and it
                    does not give medical advice. If you are in danger or thinking of harming
                    yourself, please contact a real service in your own country. In India that is
                    Tele-MANAS on <strong className="text-zinc-300">14416</strong>, free and around
                    the clock, or <strong className="text-zinc-300">112</strong> for emergencies.
                    Anywhere else,{" "}
                    <a
                        className="underline hover:text-zinc-300"
                        href="https://findahelpline.com"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        findahelpline.com
                    </a>{" "}
                    lists free helplines worldwide.
                </p>
                {/* The same questions in the eleven Indian languages. Internal
                    inbound links those pages would not otherwise have, and a
                    reader who thinks in one of them is one tap away. */}
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {LANG_FAQ_CODES.map((code) => (
                        <Link
                            key={code}
                            href={`/faq/${code}`}
                            hrefLang={code}
                            lang={code}
                            className="underline hover:text-zinc-300"
                        >
                            {LANG_FAQ[code].nativeName}
                        </Link>
                    ))}
                </p>
                <p className="mt-4">
                    <Link className="underline hover:text-zinc-300" href="/help">
                        Ask the help assistant
                    </Link>
                    {" · "}
                    <Link className="underline hover:text-zinc-300" href="/terms">
                        Terms
                    </Link>
                    {" · "}
                    <Link className="underline hover:text-zinc-300" href="/privacy">
                        Privacy
                    </Link>
                </p>
            </footer>
        </main>
    );
}
