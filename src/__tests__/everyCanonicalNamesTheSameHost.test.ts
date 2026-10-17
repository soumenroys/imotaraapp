/**
 * Every canonical and og:url names www.imotara.com.
 *
 * 🔴 WHY THIS EXISTS, AND WHY IT IS NOT A STYLE RULE. Search Console holds TWO
 * properties for this site: `imotara.com` and `www.imotara.com`. The sitemap,
 * `sameAs`, the Wikidata item and every indexed URL use **www**. A canonical
 * naming the bare host tells Google the OTHER property is preferred — which is
 * the one mistake a canonical can make that is worse than having none, because
 * it actively splits the ranking signal it exists to consolidate.
 *
 * 🔴 FOUND LIVE ON 2026-10-17, after the same defect was fixed in the blog
 * route that morning and guarded only there:
 *     /guide     canonical → https://imotara.com/guide
 *     /tutorial  canonical → https://imotara.com/tutorial
 * Plus the blog SHARE BUTTONS, which built bare-host links — so every share to
 * X or LinkedIn created a backlink to the wrong property.
 *
 * 🔑 THE LESSON: fixing one route and guarding one route are the same action
 * only if you check the others. This guard is repo-wide for that reason.
 *
 * ⛔ WHAT IS DEFENSIBLY BARE-HOST. `process.env.NEXT_PUBLIC_SITE_URL ?? "..."`
 * fallbacks in API routes and emails are not canonicals; prod sets the env var
 * to www, proven by the live robots.txt and sitemap. They are out of scope.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

const ROOT = process.cwd();

/** Lines that set a canonical or an og:url, anywhere under src/app. */
function metadataUrlLines(): string[] {
    const out = execSync(
        `grep -rnE '(canonical:|url: ")' src/app --include='*.tsx' --include='*.ts' || true`,
        { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    return out
        .split("\n")
        .filter(Boolean)
        // Only lines that actually carry an imotara.com literal.
        .filter((l) => /https:\/\/(www\.)?imotara\.com/.test(l));
}

describe("every canonical names the www host", () => {
    it("finds canonical/og:url lines at all", () => {
        // ⛔ A grep that matches nothing makes the next test vacuously pass.
        expect(metadataUrlLines().length).toBeGreaterThan(3);
    });

    it("no canonical or og:url uses the bare host", () => {
        const bare = metadataUrlLines()
            .filter((l) => /https:\/\/imotara\.com/.test(l))
            .map((l) => l.split(":").slice(0, 2).join(":"));
        expect(
            bare,
            `canonical/og:url on the bare host — Search Console treats it as a different property: ${bare.join(", ")}`,
        ).toEqual([]);
    });

    it("the blog share links use the derived site URL, not a literal", () => {
        // A share is a backlink. Hardcoding the host here leaks equity to the
        // wrong property on every share, invisibly.
        const src = execSync(`sed -n '/function ShareButtons/,/^}/p' 'src/app/blog/[slug]/page.tsx'`, {
            cwd: ROOT, encoding: "utf8",
        });
        expect(src).toContain("${SITE_URL}/blog/");
        expect(src).not.toMatch(/https:\/\/imotara\.com\/blog/);
    });
});
