// src/app/unsubscribe/page.tsx
import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

// Kept out of search results: the page is meaningless without a token, and an
// indexed unsubscribe URL is a magnet for crawlers pressing buttons.
export const metadata: Metadata = {
  title: "Unsubscribe — Imotara",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <UnsubscribeClient token={t ?? ""} />
    </main>
  );
}
