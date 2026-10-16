// The index for the answer pages — so none of them is an orphan in the HTML
// link graph. ⇒ src/data/answerPages.ts

import type { Metadata } from "next";
import Link from "next/link";

import { ANSWER_PAGES, ANSWER_SLUGS } from "@/data/answerPages";
import { OG_IMAGE } from "@/lib/seo/ogImage";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
    title: "Answers — Imotara",
    description:
        "Honest answers to the things people actually ask at 2am: grief, night-time anxiety, loneliness, overthinking, exam stress, anger, and whether it is time to talk to someone.",
    alternates: { canonical: `${SITE_URL}/answers` },
    openGraph: {
            ...OG_IMAGE, type: "website", url: `${SITE_URL}/answers`, siteName: "Imotara", title: "Answers — Imotara" },
};

export default function AnswersIndexPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="page-title">
            <p className="text-xs font-medium uppercase tracking-widest text-sky-400">Imotara</p>
            <h1 id="page-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
                Questions people actually ask at 2am
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">
                Each of these answers the question in the first paragraph and says when to talk to a
                person instead. None of it is therapy, and none of it pretends to be.
            </p>

            <ul className="mt-8 space-y-4">
                {ANSWER_SLUGS.map((slug) => {
                    const page = ANSWER_PAGES[slug];
                    return (
                        <li key={slug}>
                            <Link
                                href={`/answers/${slug}`}
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
