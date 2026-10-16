// Why this exists.
//
// Measured against production on 2026-10-16: /faq/zz, /for/zzbogus and
// /blog/zzbogus every one returned **HTTP 200** while rendering the not-found
// body, whereas /xyzzy123 correctly returned 404. notFound() chooses the right
// UI but not the right status, so each of these routes exposed an unbounded
// set of indexable 200 URLs all serving the same thin page — a soft 404, which
// Google reports and then drops the pages over.
//
// ⛔ THIS IS NOT A TEXT ASSERTION ON THE LINE THAT FIXES IT. Reading the file
// back for the string "dynamicParams = false" would pass even if the export
// were commented out, moved into dead code or shadowed — a mirror test, which
// stays green through anything (see trap_a_mirror_test_cannot_catch_a_refactor).
// These import the modules and assert on the RUNTIME exports Next actually
// reads.
//
// 🔑 generateStaticParams is asserted non-empty in the same breath, because
// dynamicParams=false is only safe while that list is populated: an empty list
// plus this flag would 404 every one of these pages instead of just the bogus
// ones. The two must be checked together or the fix becomes the outage.

import { describe, it, expect } from "vitest";

import * as faqRoute from "@/app/faq/[lang]/page";
import * as forRoute from "@/app/for/[audience]/page";
import * as blogRoute from "@/app/blog/[slug]/page";

const ROUTES = [
    { name: "/faq/[lang]", mod: faqRoute as Record<string, unknown> },
    { name: "/for/[audience]", mod: forRoute as Record<string, unknown> },
    { name: "/blog/[slug]", mod: blogRoute as Record<string, unknown> },
];

describe("public SEO routes 404 for real", () => {
    for (const { name, mod } of ROUTES) {
        it(`${name} exports dynamicParams === false`, () => {
            // Strict false, not merely falsy: undefined is the Next DEFAULT
            // (true), which is exactly the broken state this guards against.
            expect(mod.dynamicParams).toBe(false);
        });

        it(`${name} still generates a non-empty static param list`, async () => {
            const gen = mod.generateStaticParams as () => unknown;
            expect(typeof gen).toBe("function");
            const params = await gen();
            expect(Array.isArray(params)).toBe(true);
            expect((params as unknown[]).length).toBeGreaterThan(0);
        });
    }
});
