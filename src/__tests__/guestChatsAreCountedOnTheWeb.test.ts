/**
 * 👤 WEB GUESTS ARE COUNTED LIKE THE PHONE'S — 20 cloud replies a day, recorded
 * (owner, 25 Oct 2026, option A). ⛔ The guest identity is NOT the site's sign-in:
 * its own storage, its own header, accepted only when nobody is signed in and
 * only when it really is anonymous.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signedInCookiePresent } from "@/lib/imotara/guestChatIdentity";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the web only asks for a guest identity when nobody is signed in", () => {
  it("sees the sign-in cookie, plain or chunked", () => {
    expect(signedInCookiePresent("a=1; sb-rfsbv-auth-token=base64-xyz")).toBe(true);
    expect(signedInCookiePresent("sb-rfsbv-auth-token.0=abc; other=2")).toBe(true);
  });
  it("is not fooled by the PKCE verifier or unrelated cookies", () => {
    expect(signedInCookiePresent("sb-rfsbv-auth-token-code-verifier=abc")).toBe(false);
    expect(signedInCookiePresent("theme=dark; _ga=1")).toBe(false);
    expect(signedInCookiePresent("")).toBe(false);
  });
  it("keeps it apart from the site's session: own storage key, own header, never Authorization", () => {
    const g = src("src/lib/imotara/guestChatIdentity.ts");
    expect(g).toMatch(/storageKey: STORAGE_KEY/);
    expect(g).toMatch(/if \(signedInCookiePresent\(document\.cookie\)\) return null;/);
    const r = src("src/lib/imotara/respondRemote.ts");
    expect(r).toMatch(/"x-imotara-guest-token": guestToken/);
    expect(r).not.toMatch(/Authorization[^\n]*guestToken/);
  });
});

describe("the server trusts it only as a last resort, and only if anonymous", () => {
  it("chat-reply: Bearer, then the cookie, THEN the guest header — anonymous only", () => {
    const c = src("src/app/api/chat-reply/route.ts");
    const auth = c.slice(c.indexOf("// ── auth verification"), c.indexOf("// ── memory fetch"));
    expect(auth.indexOf("Authorization")).toBeLessThan(auth.indexOf("getSupabaseUserServerClient"));
    expect(auth.indexOf("getSupabaseUserServerClient")).toBeLessThan(auth.indexOf("x-imotara-guest-token"));
    expect(auth).toMatch(/data\.user\.is_anonymous\) return data\.user\.id/);
  });
  it("respond: the guest identity reaches the QUOTA only, never memories", () => {
    const r = src("src/app/api/respond/route.ts");
    expect(r).toMatch(/if \(g\?\.user\?\.id && g\.user\.is_anonymous\) quotaUserId = g\.user\.id;/);
    expect(r).not.toMatch(/authUserId = g\.user\.id/);
  });
});
