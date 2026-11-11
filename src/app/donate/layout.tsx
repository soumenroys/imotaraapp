// src/app/donate/layout.tsx
// The donate page is a client page, so it cannot export metadata — this layout gives it
// its OWN canonical (#128, 11 Nov 2026). Without it the page inherited "canonical = homepage".
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.imotara.com/donate" },
};

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
