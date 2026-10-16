// src/app/faq/[lang]/page.tsx
//
// The Indian-language question pages: /faq/hi, /faq/bn, /faq/ta, … eleven in
// all. Statically generated server components carrying FAQPage structured data
// in the page's own language.
//
// 🔑 WHY THESE AND NOT MORE OF /hi /bn /ta. Measured in Search Console, three
// months to 2026-10-16: 111 impressions, position 6.2, CTR 17.1% — and SEVEN
// queries in total, six of them the brand name. The site ranks and converts and
// is never shown. The existing /hi /bn /ta pages are brand pages, organised
// around what Imotara wants to SAY; nobody types that. These are organised
// around what people ASK, which is the one shape that has ever produced a
// non-brand impression here.
//
// ⚠️ AND WHY THE INDIAN LANGUAGES FIRST. "मानसिक स्वास्थ्य ऐप" and its ten
// siblings have a fraction of the competition of their English equivalents, in
// markets where Imotara is one of very few options at all. 11 of the 22
// languages are Indian and only 3 had any page of their own.
//
// ⛔ ADDITIVE ONLY. /faq, /hi, /bn, /ta and /help are untouched. The owner's
// standing constraint is that nothing may degrade reply quality or user
// experience, so none of this is bolted onto a surface that already works.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LANG_FAQ, LANG_FAQ_CODES, langFaqFor } from "@/data/faqLang";

const SITE_URL = "https://www.imotara.com";

/** ⚠️ Derived from the data, so a twelfth language needs no edit here. */
/**
 * ⛔ A REAL 404, not a 200 that happens to render the 404 page.
 *
 * Measured against production 2026-10-16: `/faq/zz` returned **HTTP 200** with the
 * not-found body, while `/xyzzy123` correctly returned 404. `notFound()` below
 * picks the right UI but not the right status, so every invented slug under
 * this route was an indexable 200 — an unbounded set of URLs all serving the
 * same thin page. Google calls this a **soft 404**, reports it in Search
 * Console and drops the pages; a crawler cannot tell the real pages from the
 * noise.
 *
 * 🔑 `dynamicParams = false` makes anything outside generateStaticParams a
 * genuine 404 that is never rendered — the documented behaviour in this
 * version, see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/02-route-segment-config/dynamicParams.md.
 * ⚠️ It is unavailable if Cache Components is ever turned on; this project
 * does not enable it (next.config.ts).
 *
 * ⛔ The notFound() call below STAYS. It is the guard for a param that IS in
 * the static list but whose data has gone missing — a different failure.
 */
export const dynamicParams = false;

export function generateStaticParams() {
    return LANG_FAQ_CODES.map((lang) => ({ lang }));
}

/**
 * 🔑 Every language page points at every other one AND at the English /faq.
 * Google needs the set to be reciprocal, or it treats the pages as unrelated
 * near-duplicates rather than translations of one another.
 */
function hreflangMap(): Record<string, string> {
    const map: Record<string, string> = { en: `${SITE_URL}/faq` };
    for (const code of LANG_FAQ_CODES) map[code] = `${SITE_URL}/faq/${code}`;
    map["x-default"] = `${SITE_URL}/faq`;
    return map;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: string }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const faq = langFaqFor(lang);
    if (!faq) return {};
    const url = `${SITE_URL}/faq/${faq.lang}`;
    return {
        title: faq.title,
        description: faq.description,
        alternates: { canonical: url, languages: hreflangMap() },
        openGraph: {
            type: "website",
            url,
            siteName: "Imotara",
            title: faq.title,
            description: faq.description,
            locale: faq.ogLocale,
        },
    };
}

export default async function LangFaqPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const faq = langFaqFor(lang);
    if (!faq) notFound();

    // ⚠️ Generated from the same data the page renders. Two hand-kept copies
    // drift, and the one search engines read is the one nobody looks at.
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: faq.lang,
        mainEntity: faq.items.map((item) => ({
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
            { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE_URL}/faq` },
            { "@type": "ListItem", position: 3, name: faq.nativeName, item: `${SITE_URL}/faq/${faq.lang}` },
        ],
    };

    const others = LANG_FAQ_CODES.filter((c) => c !== faq.lang);

    return (
        <main
            lang={faq.lang}
            dir={faq.dir}
            className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16"
        >
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
                    {faq.heading}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-zinc-400">{faq.intro}</p>
            </header>

            <div className="space-y-6">
                {faq.items.map((item) => (
                    // ⚠️ Real h2 + p, not an accordion. Collapsed content is weaker
                    // for both crawlers and anyone on a slow connection, and these
                    // pages are short enough not to need hiding.
                    <div key={item.id} id={item.id} className="scroll-mt-24">
                        <h2 className="text-base font-semibold text-zinc-100">{item.q}</h2>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-400">
                            {item.a}
                        </p>
                    </div>
                ))}
            </div>

            {/* 🔑 A visible switcher, not only hreflang metadata. A reader who
                lands on the wrong language should be one tap from theirs, and
                the links give each page internal inbound links it would not
                otherwise have. */}
            <nav className="mt-12 border-t border-white/10 pt-6" aria-label="Languages">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
                    {others.map((code) => (
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
                    <Link href="/faq" hrefLang="en" lang="en" className="underline hover:text-zinc-300">
                        English
                    </Link>
                </p>
            </nav>
        </main>
    );
}
