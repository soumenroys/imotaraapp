// src/app/updates/confirm/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Email confirmed — Imotara",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, { icon: string; title: string; body: string }> = {
  ok: {
    icon: "✓",
    title: "Thank you — your address is confirmed.",
    body: "We write rarely, and only about Imotara. Every email carries a one-click unsubscribe link that works immediately.",
  },
  already: {
    icon: "✓",
    title: "That address was already confirmed.",
    body: "Nothing more to do. You will hear from us now and then, and every email has a one-click unsubscribe link.",
  },
  bad: {
    icon: "🔗",
    title: "This link did not work.",
    body: "Some email programs break long links across two lines. Try clicking it again from the message, or fill in the form once more.",
  },
  error: {
    icon: "…",
    title: "Something went wrong at our end.",
    body: "Nothing was lost. Please try the link again in a few minutes.",
  },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const m = MESSAGES[s ?? "bad"] ?? MESSAGES.bad;

  return (
    <main className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-2xl">{m.icon}</p>
        <h1 className="mt-2 text-base font-semibold text-zinc-100">{m.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{m.body}</p>
        <Link href="/" className="mt-4 inline-block text-xs text-indigo-400 hover:underline">
          Back to Imotara
        </Link>
      </div>
    </main>
  );
}
