// src/app/admin/layout.tsx
//
// ⚠️ A SERVER LAYOUT, because a client component cannot export `metadata` —
// Next.js does not warn, it silently inherits the root title. The appearance
// work has to happen in the browser, so it lives in a client child.
//
// 🔑 Everything under /admin inherits both: no admin page has to remember to
// neutralise the consumer theme, and none can forget. That is the whole point
// — the five social screens forgot, and looked broken for any admin whose
// machine was in light mode.

import type { Metadata } from "next";
import { AdminChrome } from "@/app/admin/_components/AdminChrome";

export const metadata: Metadata = {
  title: "Imotara admin",
  // ⛔ Behind a login, and nothing here should ever reach an index.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
