/**
 * "Sign in with a different account" must actually switch accounts.
 *
 * 🔴 WHY THIS EXISTS. On the org invite and domain-join pages this was:
 *
 *     <Link href="/settings">Sign in with a different account</Link>
 *
 * which was broken in two ways at once:
 *   1. It dropped the destination. After signing in, the person never returned
 *      to the invite — the link they had been emailed was simply lost.
 *   2. It did not sign anyone OUT. Someone already signed in as the wrong
 *      account landed on /settings still signed in as that account, with no
 *      route to the Google account chooser. Clicking it left you with the same
 *      account, every time.
 *
 * This matters more than it looks: inviting members is how an organisation
 * admin onboards their people (NGO requirements 3 and 8). Found during the
 * 2026-10-05 NGO dry run, on the real onboarding path.
 *
 * 🔑 The signed-OUT path on both pages was always correct — it carries
 * ?redirect= — so the fix is simply to do the same thing after a sign-out.
 * These tests pin both halves: the sign-out, and the preserved destination.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PAGES = [
  {
    label: "org invite",
    file: "src/app/org/invite/[token]/page.tsx",
    param: "token",
    dest: "/org/invite/${token}",
  },
  {
    label: "org domain-join",
    file: "src/app/org/join/[slug]/page.tsx",
    param: "slug",
    dest: "/org/join/${slug}",
  },
];

const readRaw = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * Strip comments before asserting. The fix's own explanatory comment QUOTES the
 * dead link it replaced, so a naive search matches the explanation instead of
 * the code — the same trap as in quotaCountsOnlyChatReplies and
 * orgLicenceInvariants.
 */
const read = (rel: string) =>
  readRaw(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe.each(PAGES)("$label — the account switch works", ({ file, dest, param }) => {
  const src = () => read(file);

  it("is no longer a bare <Link href=\"/settings\">", () => {
    // The exact dead link that shipped. If it ever comes back, so does the bug.
    expect(src()).not.toContain('<Link href="/settings"');
  });

  it("signs the user OUT — otherwise the chooser is unreachable", () => {
    const s = src();
    expect(s).toContain("auth.signOut()");
    expect(s).toMatch(/switchAccount/);
  });

  it("preserves the destination so the invite is not lost", () => {
    // Template literal, so compare on the raw source text.
    expect(src()).toContain(`/settings?redirect=${dest}`);
  });

  it("navigates even if signOut throws", () => {
    // Being stranded on a page whose only escape hatch failed silently is
    // worse than a redundant sign-in.
    const s = src();
    const fn = s.slice(s.indexOf("const switchAccount"), s.indexOf("}, [router"));
    expect(fn).toContain("catch");
    // the redirect must sit AFTER the try/catch, not inside the try
    const afterCatch = s.slice(s.indexOf("catch", s.indexOf("const switchAccount")));
    expect(afterCatch).toContain("router.replace");
  });

  it("still offers the email & password route as a second option", () => {
    // The fallback that already worked — do not lose it while fixing the other.
    expect(src()).toMatch(/\/login\?redirect=/);
  });

  it(`keeps the ${param} in scope for the redirect`, () => {
    expect(src()).toContain(`}, [router, ${param}]);`);
  });
});

describe("the signed-out path that was already correct is untouched", () => {
  it.each(PAGES)("$label still carries ?redirect= on its sign-in link", ({ file, dest }) => {
    // This is the path a brand-new invitee takes. It was never broken, and a
    // fix to the "wrong account" link must not disturb it.
    const s = read(file);
    const occurrences = s.split(`/settings?redirect=${dest}`).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // the sign-in link + switchAccount
  });
});

/**
 * 🟠 DRY-RUN BUG #2 — the plan capsule was stale right after joining.
 *
 * Observed 2026-10-05 on the real onboarding path: the invite success screen
 * said "Your account has been upgraded to the organisation plan" while the
 * header capsule beside it still read **Free**. The server was correct
 * throughout — /api/license/status already returned the org tier — and it
 * resolved on reload. Only the client never re-asked.
 *
 * refreshLicense()'s own doc comment names this exact case ("a completed
 * checkout, a redeemed key, AN ORG JOIN"), but nothing called it on join. The
 * subscriber chain already existed: useLicense() subscribes, and SiteHeader
 * reuses useLicense(). Only the emit was missing.
 *
 * 🔑 Same family as the payment badge bug of 2026-09-26, where someone who had
 * just paid still saw "Free" and could reasonably conclude it had failed and
 * pay again. A stale entitlement badge on the first screen a new member sees
 * contradicts the success message printed next to it.
 */
describe("joining an org refreshes the licence without a reload", () => {
  const PAGES = [
    { label: "invite accept", file: "src/app/org/invite/[token]/page.tsx", success: 'setStep("accepted")' },
    { label: "domain join",   file: "src/app/org/join/[slug]/page.tsx",    success: 'setStep("joined")' },
  ];

  it.each(PAGES)("$label emits refreshLicense on success", ({ file, success }) => {
    const src = read(file);                  // comment-stripped by the helper
    expect(src).toContain("refreshLicense()");
    // It must fire on the SUCCESS path, not somewhere incidental.
    const i = src.indexOf(success);
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(Math.max(0, i - 200), i)).toContain("refreshLicense()");
  });

  it.each(PAGES)("$label imports it from the shared module", ({ file }) => {
    // Not a local re-implementation — the throttle and auth handling live there.
    expect(read(file)).toContain('from "@/lib/imotara/licenseRefresh"');
  });

  it("the subscriber chain still exists, or the emit is pointless", () => {
    // ⚠️ NOT toContain("onLicenseRefresh") — "onLicenseRefreshDisabled"
    // contains it, so renaming the subscription slipped straight through.
    // Mutation-caught. Assert the import AND a real call.
    const src = read("src/hooks/useLicense.ts");
    expect(src).toMatch(/import\s*\{[^}]*\bonLicenseRefresh\b[^}]*\}\s*from\s*"@\/lib\/imotara\/licenseRefresh"/);
    expect(src).toMatch(/\bonLicenseRefresh\s*\(/);
  });
});
