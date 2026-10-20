/**
 * Every public page is either in the sitemap or explicitly excluded.
 *
 * 🔴 THE DEFECT THIS PINS, found 2026-10-17 by listing the routes and diffing
 * them against the live sitemap. Four public pages — HTTP 200, no `noindex`,
 * nothing blocking them — had never been added to the hand-maintained list in
 * sitemap.ts, so search engines were never told they exist:
 *
 *     /help   /tutorial   /pricing/corporate   /careers
 *
 * ⚠️ /pricing/corporate is where the NGO and institutional conversations send
 * people. The commercial driver was unlisted.
 *
 * 🔑 THE ROOT CAUSE IS THE HAND-MAINTAINED LIST, not the four omissions. A list
 * someone must remember to update drifts from the thing it describes — the
 * same shape as the store screenshots that kept advertising a merged tier.
 * ⇒ So this does not check for those four pages. It checks that EVERY route
 * has been decided about, and fails on a new one nobody has classified.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/** Every static page route the app actually has. */
function staticRoutes(): string[] {
    const out: string[] = [];
    const walk = (dir: string, url: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            if (e.name.startsWith("[") || e.name.startsWith("(") || e.name === "api") continue;
            const next = path.join(dir, e.name);
            const nextUrl = `${url}/${e.name}`;
            if (fs.existsSync(path.join(next, "page.tsx"))) out.push(nextUrl);
            walk(next, nextUrl);
        }
    };
    const appDir = path.join(ROOT, "src/app");
    if (fs.existsSync(path.join(appDir, "page.tsx"))) out.push("/");
    walk(appDir, "");
    return out.sort();
}

/**
 * Routes deliberately kept OUT of the sitemap, each with a reason. ⛔ Adding a
 * route here is a decision to make it invisible to search — never a way to
 * silence this test.
 */
const EXCLUDED: Record<string, string> = {
    "/admin": "staff only", "/admin/analytics": "staff only",
    "/admin/crisis-events": "staff only", "/admin/guide": "staff only",
    // Social posting. ⛔ Staff only, and its own layout sets
    // robots: { index: false } as well — belt and braces, because an admin
    // screen appearing in search would expose the shape of the queue.
    "/admin/social": "staff only", "/admin/social/compose": "staff only",
    "/admin/social/channels": "staff only", "/admin/social/schedules": "staff only",
    "/admin/social/languages": "staff only", "/admin/social/stats": "staff only",
    "/admin/social/scripts": "staff only", "/admin/social/illustration": "staff only",
    "/auth/accept": "auth flow", "/auth/callback": "auth flow",
    "/auth/callback-mobile": "auth flow", "/auth/forgot-password": "auth flow",
    "/login": "auth flow",
    "/chat": "signed-in app", "/history": "signed-in app",
    "/profile": "signed-in app", "/settings": "signed-in app",
    "/feel": "signed-in app", "/grow": "signed-in app",
    "/imotara/history": "signed-in app",
    "/connect": "robots-disallowed", "/connect/age-restricted": "robots-disallowed",
    "/connect/register": "robots-disallowed", "/connect/session/new": "robots-disallowed",
    "/connect/wallet-terms": "robots-disallowed",
    "/org/dashboard": "customer dashboard", "/org/dashboard/analytics": "customer dashboard",
    "/org/dashboard/audit": "customer dashboard", "/org/dashboard/licenses": "customer dashboard",
    "/org/dashboard/members": "customer dashboard", "/org/dashboard/overview": "customer dashboard",
    "/org/dashboard/pool": "customer dashboard", "/org/dashboard/settings": "customer dashboard",
    "/org/dashboard/teams": "customer dashboard", "/org/new": "customer dashboard",
    "/dev/modal-preview": "developer tool", "/license-debug": "developer tool",
    "/family/view": "reached by private link", "/unsubscribe": "reached by email link",
    // ⚠️ Verified noindex on the live page — a confirmation screen, not content.
    "/updates/confirm": "noindexed confirmation page",
};

const SITEMAP_SRC = fs.readFileSync(path.join(ROOT, "src/app/sitemap.ts"), "utf8");

describe("the sitemap covers every public page", () => {
    it("lists routes at all (the walker works)", () => {
        // ⛔ A broken walker returns [] and every assertion below passes.
        const routes = staticRoutes();
        expect(routes.length).toBeGreaterThan(40);
        expect(routes).toContain("/about");
    });

    it("every static route is either in the sitemap or explicitly excluded", () => {
        const unclassified = staticRoutes().filter((r) => {
            if (r in EXCLUDED) return false;
            // The sitemap builds urls as `${base}/x`, so match the path.
            return !new RegExp(`\\\`\\$\\{base\\}${r.replace(/\//g, "\\/")}\\\``).test(SITEMAP_SRC);
        });
        expect(
            unclassified,
            `public route(s) neither listed nor excluded — add to sitemap.ts, or to EXCLUDED with a reason: ${unclassified.join(", ")}`,
        ).toEqual([]);
    });

    it("nothing is both excluded and listed", () => {
        const both = Object.keys(EXCLUDED).filter((r) =>
            new RegExp(`\\\`\\$\\{base\\}${r.replace(/\//g, "\\/")}\\\``).test(SITEMAP_SRC),
        );
        expect(both, `excluded yet in the sitemap: ${both.join(", ")}`).toEqual([]);
    });
});
