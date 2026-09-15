// The index for the ten audience landing pages.
//
// Exists for two reasons: it gives the crawler one place that links to all ten
// (so they are discovered even before the sitemap is re-read), and it gives a
// reader who arrives from one page a way to find the one that actually fits
// them — a parent who lands on the teenager page often wants the 40–60 page.

import type { Metadata } from "next";
import Link from "next/link";
import { AUDIENCE_PAGES, type AudiencePage } from "@/data/audiencePages";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Who Imotara is for — Imotara",
  description:
    "Imotara for young people, young adults, adults, seniors and parents — and for NGOs, schools, hospitals and homes for the elderly. Private, 22 languages, free to start.",
  keywords: [
    "imotara for seniors", "imotara for teenagers", "imotara for NGOs",
    "imotara for schools", "imotara for hospitals", "wellbeing companion for organisations",
  ],
  alternates: { canonical: `${SITE_URL}/for` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/for`,
    siteName: "Imotara",
    title: "Who Imotara is for — Imotara",
    description: "A private wellbeing companion, written for the person actually reading it.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara" }],
  },
};

const all = Object.values(AUDIENCE_PAGES) as AudiencePage[];
const people = all.filter((p) => !p.institutional);
const organisations = all.filter((p) => p.institutional);

function Group({ title, blurb, pages }: { title: string; blurb: string; pages: AudiencePage[] }) {
  return (
    <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{blurb}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/for/${p.slug}`}
              className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-sky-400/30 hover:bg-white/[0.06]"
            >
              <span className="text-xs font-medium uppercase tracking-widest text-sky-400">{p.label}</span>
              <span className="mt-1 block text-sm font-medium text-zinc-100">{p.hook}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-400">{p.standfirst}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AudienceIndexPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="page-title">
      <div className="space-y-6">
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-sky-400">Imotara</p>
          <h1 id="page-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Who Imotara is for
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            The same private companion, described for the person actually reading. Pick whichever
            sounds most like you — nothing behind these links is different software, only a different
            way of explaining it.
          </p>
        </section>

        <Group
          title="For people"
          blurb="Free to start, private by default, and available in 22 languages."
          pages={people}
        />
        <Group
          title="For organisations"
          blurb="Dashboards show anonymised wellbeing trends across your community — never anyone's private words."
          pages={organisations}
        />

        <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/8 px-6 py-6 text-center sm:px-8">
          <p className="text-base font-medium text-zinc-100">Not sure which one?</p>
          <p className="mt-1 text-sm text-zinc-400">Start anywhere. It is the same companion.</p>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-8 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
          >
            Open Imotara →
          </Link>
        </section>
      </div>
    </main>
  );
}
