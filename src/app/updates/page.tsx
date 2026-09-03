// src/app/updates/page.tsx
import type { Metadata } from "next";
import UpdatesForm from "./UpdatesForm";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Get updates from Imotara",
  description:
    "Hear from Imotara now and then — new features, quiet improvements, and occasional offers. Rarely, never sold on, and one click to stop.",
  alternates: { canonical: `${SITE_URL}/updates` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/updates`,
    siteName: "Imotara",
    title: "Get updates from Imotara",
    description: "Hear from us now and then. Rarely, never sold on, one click to stop.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara" }],
  },
};

export default function UpdatesPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14 sm:py-20">
      <div className="mb-8 text-center">
        <p className="text-3xl">✉️</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          Hear from us now and then
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          We only email people who asked us to. If you have met us at an event, spoken
          to us, or simply want to know when something changes, leave your address here.
        </p>
      </div>

      <UpdatesForm />

      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        {[
          { t: "Rarely", d: "Weeks apart, not days. We would rather say nothing than fill your inbox." },
          { t: "Only us", d: "Your address stays with Imotara. It is never sold, rented or shared." },
          { t: "One click", d: "Every email has an unsubscribe link that works immediately." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <p className="text-xs font-semibold text-zinc-200">{c.t}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{c.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
