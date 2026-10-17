// src/app/admin/social/layout.tsx
//
// ⚠️ THIS FILE EXISTS ONLY TO CARRY THE TITLE. The pages under it are
// `"use client"`, and a client component cannot export `metadata` — Next.js
// does not warn, it silently inherits the root title. Seven public pages were
// invisible in search for exactly this reason until 17 Oct 2026; these are
// behind a login and will never be indexed, but a browser tab reading
// "Imotara" on every admin screen is the same bug with a smaller blast radius.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Social posting — Imotara admin",
  // ⛔ Behind a login, and nothing here should ever reach an index.
  robots: { index: false, follow: false },
};

export default function SocialAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
