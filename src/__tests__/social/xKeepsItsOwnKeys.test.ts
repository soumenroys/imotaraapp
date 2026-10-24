/**
 * 🔑 X — CONNECTED ONCE, MINTED PER POST, AND THE ROTATING REFRESH TOKEN IS KEPT.
 *
 * X rotates its refresh token on every use: the old one dies the moment a new
 * one is issued. The one failure that would break X quietly is forgetting to
 * store the new token — the next weekly run would then find a dead one. These
 * pin the PKCE flow, the rotation, and that the stored row is updated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pkceChallenge, pkcePair, xConsentUrl, xOAuthConfig, exchangeXCode, refreshXAccessToken, X_SCOPES,
} from "@/lib/social/adapters/xAuth";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://www.imotara.com/api/admin/social/x/callback" };
const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("PKCE", () => {
  // Verifier and challenge from RFC 7636 Appendix B (checked against rfc-editor.org, 24 Oct 2026).
  it("matches the RFC 7636 test vector", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes a verifier X accepts (43–128 characters)", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toBe(pkceChallenge(verifier));
  });
});

describe("the consent URL", () => {
  const u = new URL(xConsentUrl(config, "STATE", "CHAL"));
  it("asks for offline.access — without it there is no refresh token and posting dies in 2 hours", () => {
    expect(u.searchParams.get("scope")!.split(" ")).toEqual([...X_SCOPES]);
    expect(X_SCOPES).toContain("offline.access");
    expect(X_SCOPES).toContain("tweet.write");
  });
  it("uses S256 and our exact redirect URI", () => {
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toBe("CHAL");
    expect(u.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  });
});

describe("config", () => {
  it("names what is missing and never echoes a value", () => {
    const r = xOAuthConfig({ X_OAUTH_CLIENT_ID: "abc" } as unknown as NodeJS.ProcessEnv, "https://www.imotara.com");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("X_OAUTH_CLIENT_SECRET");
      expect(r.message).not.toContain("abc");
    }
  });
});

describe("tokens", () => {
  it("an exchange without a refresh token stores nothing", async () => {
    const r = await exchangeXCode({ config, code: "c", verifier: "v", fetchImpl: reply(200, { access_token: "a" }) });
    expect(r.ok).toBe(false);
  });

  it("a refresh returns the NEW refresh token (rotation)", async () => {
    const r = await refreshXAccessToken({ config, refreshToken: "old", fetchImpl: reply(200, { access_token: "a2", refresh_token: "new" }) });
    expect(r).toMatchObject({ ok: true, accessToken: "a2", refreshToken: "new" });
  });

  it("if X ever omits it, the old one is kept rather than blanked", async () => {
    const r = await refreshXAccessToken({ config, refreshToken: "old", fetchImpl: reply(200, { access_token: "a2" }) });
    expect(r).toMatchObject({ ok: true, refreshToken: "old" });
  });

  it("authenticates as a confidential client (Basic), and sends the verifier at exchange", async () => {
    const f = reply(200, { access_token: "a", refresh_token: "r" });
    await exchangeXCode({ config, code: "c", verifier: "VERIFIER", fetchImpl: f });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
    expect(String(init.body)).toContain("code_verifier=VERIFIER");
  });
});

// ── The rotation must reach the database ────────────────────────────────────
const updates: Record<string, unknown>[] = [];
vi.mock("@/lib/social/tokenCrypto", () => ({
  tokenStorageReady: () => ({ ok: true }),
  decryptToken: (p: string) => p.replace(/^enc:/, ""),
  encryptToken: (p: string) => `enc:${p}`,
  tokenAad: (a: string, b: string) => `${a}:${b}`,
  tokenTail: (p: string) => p.slice(-4),
  tokenFingerprint: (p: string) => `fp-${p}`,
}));

function fakeDb(refreshToken: string) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "acc1", platform: "x", external_id: "123", display_name: "@ImotaraOfficial", refresh_token: `enc:${refreshToken}` },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({ eq: async () => { updates.push(patch); return { error: null }; } }),
    }),
  };
}

describe("loadCredentialFor('x') stores the rotated refresh token", () => {
  beforeEach(() => { updates.length = 0; });

  it("writes the new token back before handing out the access token", async () => {
    process.env.X_OAUTH_CLIENT_ID = "cid";
    process.env.X_OAUTH_CLIENT_SECRET = "secret";
    vi.stubGlobal("fetch", reply(200, { access_token: "fresh-access", refresh_token: "rotated" }));
    const { loadCredentialFor } = await import("@/lib/social/channelCredentials");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cred = await loadCredentialFor(fakeDb("first") as any, "acc1", "x", "https://www.imotara.com");
    expect(cred).toMatchObject({ ok: true, token: "fresh-access", externalId: "123" });
    expect(updates[0]).toMatchObject({ refresh_token: "enc:rotated", token_tail: "ated" });
    vi.unstubAllGlobals();
  });
});
