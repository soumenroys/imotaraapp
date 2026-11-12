// src/__tests__/auth/emailSignupCleanup.test.ts
// 🔑 #134 (12 Nov 2026): asking for a sign-in code creates the account first; one that never typed
// its code is removed after 24 h by the nightly job — and NOTHING else ever is.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { looksAbandoned, ABANDON_AFTER_MS } from "@/lib/auth/cleanupUnconfirmed";

const NOW = Date.parse("2026-11-13T03:00:00Z");
const old = new Date(NOW - ABANDON_AFTER_MS - 60_000).toISOString();
const fresh = new Date(NOW - 60 * 60 * 1000).toISOString();
const base = { email_confirmed_at: undefined, last_sign_in_at: undefined, created_at: old, identities: [{ provider: "email" }], is_anonymous: false };
type U = Parameters<typeof looksAbandoned>[0];

describe("only a never-finished email sign-up is removed", () => {
  it("email-only, never confirmed, never signed in, older than a day ⇒ removed", () => {
    expect(looksAbandoned(base as unknown as U, NOW)).toBe(true);
  });
  it.each([
    ["confirmed its email", { email_confirmed_at: old }],
    ["has signed in", { last_sign_in_at: old }],
    ["is less than a day old (the code is still usable)", { created_at: fresh }],
    ["signed up with Google", { identities: [{ provider: "google" }] }],
    ["also has Apple", { identities: [{ provider: "email" }, { provider: "apple" }] }],
    ["is a guest (anonymous) account", { is_anonymous: true, identities: [] }],
  ])("kept: %s", (_n, patch) => {
    expect(looksAbandoned({ ...base, ...patch } as unknown as U, NOW)).toBe(false);
  });
});

describe("the database checks", () => {
  const SRC = readFileSync("src/lib/auth/cleanupUnconfirmed.ts", "utf8");
  it("anyone in an organisation (admin-invited, waiting to accept) or with a paid licence is kept", () => {
    expect(SRC).toMatch(/from\("org_members"\)/);
    expect(SRC).toMatch(/l\.tier !== "free"/);
    expect(SRC.indexOf("keep.has(id)")).toBeLessThan(SRC.indexOf("deleteUser(id)"));
  });
  it("capped per night", () => {
    expect(SRC).toMatch(/MAX_DELETES_PER_RUN = 200/);
  });
  it("runs in the nightly retention job, and its failure never stops that job", () => {
    const job = readFileSync("src/app/api/cron/data-retention/route.ts", "utf8");
    expect(job).toMatch(/try \{\s*const c = await cleanupUnconfirmedEmailAccounts\(admin\)/);
  });
});

describe("the words people read", () => {
  it("privacy: account mail comes from our own mailbox (Hostinger); Resend only sends opted-in updates", () => {
    const p = readFileSync("src/app/privacy/page.tsx", "utf8");
    expect(p).toMatch(/sent from our own imotara\.com mailbox, hosted by\{" "\}\s*<strong>Hostinger<\/strong>/);
    expect(p).not.toMatch(/Resend[^.]*delivers the email we\s+send you — account messages/);
    expect(p).not.toMatch(/in the\s+future \(where available\), we may collect an email/);
  });
  it("help: no 'magic link' left — codes and passwords", () => {
    for (const f of ["src/content/help/getting-started.md", "src/content/help/troubleshooting.md"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/magic link/i);
    }
  });
  it("/login is for anyone with a password, not organisation accounts only", () => {
    expect(readFileSync("src/app/login/page.tsx", "utf8")).not.toContain("For organisation accounts set up by an Imotara admin.");
  });
});
