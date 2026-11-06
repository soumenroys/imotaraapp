// src/lib/seo/brandTitle.ts
// One "Imotara" per page title.
//
// 🔴 6 Nov 2026: the root layout's template is "%s · Imotara", and 46 pages
// already name Imotara in their own title ⇒ Google showed our best-ranking
// answer as "How to stop overthinking at night — Imotara · Imotara". A
// doubled brand reads as spam in a results list and wastes the characters a
// search result has.
//
// ✅ A title that already names Imotara is marked ABSOLUTE, so the template
// leaves it alone; any other title still gets " · Imotara".
// ⇒ src/__tests__/seo/oneBrandInATitle.test.ts holds every page to it.

import type { Metadata } from "next";

export function brandTitle(title: string): NonNullable<Metadata["title"]> {
  return /imotara/i.test(title) ? { absolute: title } : title;
}
