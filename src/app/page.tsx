// src/app/page.tsx
// The homepage. Its body is a client component (HomeClient.tsx); this server wrapper exists
// only so the homepage can declare ITS OWN canonical and language links (#128, 11 Nov 2026).
// ⛔ They used to live in the root layout, which made every page without its own canonical
//    claim to be the homepage.
import type { Metadata } from "next";
import Home from "./HomeClient";

const SITE = "https://www.imotara.com";

export const metadata: Metadata = {
  alternates: {
    canonical: SITE,
    languages: { en: SITE, hi: `${SITE}/hi`, bn: `${SITE}/bn`, ta: `${SITE}/ta`, "x-default": SITE },
  },
};

export default function Page() {
  return <Home />;
}
