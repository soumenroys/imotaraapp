// src/lib/seo/publisher.ts
//
// The publisher node every content page attaches to its structured data.
//
// 🔑 WHY IT MATTERS ON THESE PAGES. An AI surface quotes ONE answer with no
// page around it. Whatever identifies the source has to be inside the markup
// of that answer, not in a footer the assistant never reads — and for
// health-adjacent content "who says this" is most of whether it gets quoted at
// all.
//
// ⛔ BUILT FROM businessIdentity.ts, never retyped. That module is matched to
// the firm PAN and bank account, which makes it the most carefully verified set
// of facts here. A second hardcoded copy would drift, and the drifting one
// would be the one the public and the crawlers see.
//
// ⛔ NO MEDICAL REVIEWER, EVER. Health pages routinely carry "reviewed by Dr X"
// markup and it is the most tempting thing to fabricate for E-E-A-T. Nobody
// clinical reviews this content. Claiming otherwise would be a lie told in
// machine-readable form, on a mental-health site, to win a ranking.

import { BUSINESS } from "@/lib/imotara/businessIdentity";

/** The Organization node, as a nested reference inside a page's schema. */
export function publisherNode() {
    return {
        "@type": "Organization",
        name: BUSINESS.brand,
        legalName: BUSINESS.legalName,
        url: BUSINESS.website,
        email: BUSINESS.email,
        logo: { "@type": "ImageObject", url: `${BUSINESS.website}/og-image.png` },
    };
}

/**
 * 🔴 The disclaimer, in the markup.
 *
 * Attached to every health-adjacent page so that an answer lifted on its own
 * still carries the one sentence that must never be separated from it.
 */
export const NOT_THERAPY_SCHEMA_NOTE =
    "Imotara is a wellness companion for self-reflection. It is not therapy, it does not diagnose, and it is not a crisis service.";
