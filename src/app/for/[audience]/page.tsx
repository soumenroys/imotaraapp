// One renderer for all ten audience landing pages.
//
// The content lives in src/data/audiencePages.ts, deliberately — these began
// as ten separate PDFs and the facts in them had already drifted apart (the
// Seniors sheet lost the Pro tier, "22 languages" became "all languages",
// Connect moved in and out of the pricing table). One template plus one
// pricing constant means a correction lands everywhere at once.
//
// Statically generated via generateStaticParams, so these are real, indexable
// HTML pages — which is the whole point. All 27 PDFs in docs/ currently 404 on
// the live site, and nothing on imotara.com targets seniors, teenagers,
// parents, NGOs or institutions.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AUDIENCE_PAGES, type AudienceSlug } from "@/data/audiencePages";

const SITE_URL = "https://www.imotara.com";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.imotara.imotara";
const APPSTORE_URL = "https://apps.apple.com/in/app/imotara/id6756697569";

export function generateStaticParams() {
  return Object.keys(AUDIENCE_PAGES).map((audience) => ({ audience }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ audience: string }>;
}): Promise<Metadata> {
  const { audience } = await params;
  const page = AUDIENCE_PAGES[audience as AudienceSlug];
  if (!page) return {};
  const url = `${SITE_URL}/for/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Imotara",
      title: page.metaTitle,
      description: page.metaDescription,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara" }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function AudienceLandingPage({
  params,
}: {
  params: Promise<{ audience: string }>;
}) {
  const { audience } = await params;
  const page = AUDIENCE_PAGES[audience as AudienceSlug];
  if (!page) notFound();

  const url = `${SITE_URL}/for/${page.slug}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="page-title">
      {/* Breadcrumbs help both the reader and the crawler place the page. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Imotara", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Who it's for", item: `${SITE_URL}/for` },
              { "@type": "ListItem", position: 3, name: page.label, item: url },
            ],
          }),
        }}
      />

      <div className="space-y-6">
        {/* Hero */}
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-sky-400">
            Imotara · {page.label}
          </p>
          <h1
            id="page-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
          >
            {page.hook}
          </h1>
          <p className="mt-3 max-w-2xl text-base italic leading-7 text-sky-200/90">
            {page.standfirst}
          </p>
          {page.intro.map((para) => (
            <p key={para.slice(0, 40)} className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              {para}
            </p>
          ))}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
            >
              Start talking →
            </Link>
            <a
              href={PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Get on Android
            </a>
            <a
              href={APPSTORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Get on iOS
            </a>
          </div>
        </section>

        {/* The four cards */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">{page.cardsHeading}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {page.cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <h3 className="text-sm font-semibold text-sky-300">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{card.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-300">{page.afterCards}</p>
        </section>

        {/* Moments */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">{page.momentsHeading}</h2>
          <ul className="mt-4 space-y-3 text-sm text-zinc-300">
            {page.moments.map(([lead, rest]) => (
              <li key={lead} className="flex gap-3">
                <span className="mt-0.5 text-sky-400">◆</span>
                <span>
                  <strong className="text-zinc-200">{lead}</strong> {rest}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Plans */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">What it costs</h2>
          {/* ⚠️ A three-column pricing table does not fit a phone.
              Found in the Android emulator on 2026-09-15: inside an
              overflow-x-auto container the COST column — the entire point of
              the table — sat off-screen, reachable only by a sideways scroll
              nobody discovers. Worst of all on the Seniors page, whose readers
              are the least likely to go looking for it.
              So: stacked blocks on a phone, a real table from sm up. */}
          <ul className="mt-4 space-y-3 sm:hidden">
            {page.plans.map((row) => (
              <li key={row.name} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-sky-300">{row.name}</span>
                  <span className="text-sm font-medium text-zinc-100">{row.cost}</span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-zinc-300">{row.who}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden sm:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/15">
                  <th scope="col" className="py-2 pr-4 font-semibold text-zinc-200">Plan</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-zinc-200">What you get</th>
                  <th scope="col" className="py-2 font-semibold text-zinc-200">Cost</th>
                </tr>
              </thead>
              <tbody>
                {page.plans.map((row) => (
                  <tr key={row.name} className="border-b border-white/8 align-top">
                    <th scope="row" className="py-3 pr-4 font-medium text-sky-300">{row.name}</th>
                    <td className="py-3 pr-4 leading-6 text-zinc-300">{row.who}</td>
                    <td className="py-3 font-medium leading-6 text-zinc-100">{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs italic leading-5 text-zinc-400">{page.plansNote}</p>
          <Link href="/upgrade" className="mt-3 inline-block text-xs font-medium text-sky-400 hover:text-sky-300">
            See all plans and what is in each →
          </Link>
        </section>

        {/* Closing */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">{page.closing.title}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{page.closing.body}</p>
        </section>

        {/* Institutional pages get a real contact route; consumer ones do not
            need one — the app is the call to action. */}
        {page.institutional && (
          <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
            <h2 className="text-lg font-semibold text-zinc-100">Getting started</h2>
            <ol className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex gap-3"><span className="text-sky-400">1.</span><span><strong className="text-zinc-200">Write to us</strong> at <a href="mailto:info@imotara.com" className="text-sky-400 hover:text-sky-300">info@imotara.com</a> with a line about where you would like to start.</span></li>
              <li className="flex gap-3"><span className="text-sky-400">2.</span><span><strong className="text-zinc-200">We set you up</strong> with a small pilot at no cost, and a short orientation for your team.</span></li>
              <li className="flex gap-3"><span className="text-sky-400">3.</span><span><strong className="text-zinc-200">Invite your members</strong> in minutes from your dashboard — we stay with you throughout.</span></li>
            </ol>
          </section>
        )}

        {/* Pull quote + CTA */}
        <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/8 px-6 py-7 text-center sm:px-8">
          {page.pullQuote.map((line, i) => (
            <p
              key={line.slice(0, 30)}
              className={i === 0 ? "text-sm italic text-zinc-300" : "mt-1 text-base font-medium text-zinc-100"}
            >
              {line}
            </p>
          ))}
          <Link
            href="/chat"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-8 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
          >
            Open Imotara →
          </Link>
          <p className="mt-3 text-xs text-zinc-400">
            Free, private, no account needed ·{" "}
            <a href="mailto:info@imotara.com" className="text-sky-400 hover:text-sky-300">info@imotara.com</a>
          </p>
        </section>

        <p className="text-center text-xs text-zinc-500">
          <Link href="/for" className="hover:text-zinc-300">← Imotara for other people</Link>
        </p>
      </div>
    </main>
  );
}
