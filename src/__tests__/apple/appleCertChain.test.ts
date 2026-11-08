// src/__tests__/apple/appleCertChain.test.ts
// #80 (8 Nov 2026): verifyAppleJWS trusted the certificate INSIDE Apple's
// answer. These tests use a TEST chain (fixtures/apple-chain — NOT Apple's, see
// its README) shaped like Apple's: root → intermediate (WWDR OID) → leaf
// (receipt-signing OID). The real Apple root is pinned in the module; the test
// root is injected through `rootDerB64`.
import { describe, it, expect, vi, afterEach } from "vitest";
import { X509Certificate } from "node:crypto";
import {
    verifyAppleCertChain,
    APPLE_ROOT_CA_G3_DER_B64,
    APPLE_ROOT_CA_G3_SHA256,
} from "@/lib/apple/appleCertChain";

import { ROOT, INT, LEAF, LEAF_NO_OID, EVIL_ROOT, EVIL_LEAF, TEST_JWS } from "../fixtures/apple-chain/testChain";

const NOW = new Date("2027-06-01T00:00:00Z");
const opts = { now: NOW, rootDerB64: ROOT };

describe("the Apple root is pinned correctly", () => {
    it("the embedded certificate IS Apple Root CA - G3 (fingerprint from apple.com, 8 Nov 2026)", () => {
        const c = new X509Certificate(Buffer.from(APPLE_ROOT_CA_G3_DER_B64, "base64"));
        expect(c.fingerprint256).toBe(APPLE_ROOT_CA_G3_SHA256);
        expect(c.subject).toContain("CN=Apple Root CA - G3");
    });
});

describe("verifyAppleCertChain", () => {
    it("✅ accepts leaf → intermediate → pinned root, with Apple's OIDs", () => {
        expect(verifyAppleCertChain([LEAF, INT, ROOT], opts)).toEqual({ ok: true });
    });

    it("⛔ an attacker's own complete chain (their root) is rejected — the whole point", () => {
        const evil = [EVIL_LEAF, EVIL_ROOT, EVIL_ROOT];
        const r = verifyAppleCertChain(evil, opts);
        expect(r.ok).toBe(false);
    });

    it("⛔ the real chain checked against the REAL Apple pin is rejected (it is a test root)", () => {
        expect(verifyAppleCertChain([LEAF, INT, ROOT], { now: NOW }).ok).toBe(false);
    });

    it("⛔ a leaf without Apple's receipt-signing OID is rejected", () => {
        const r = verifyAppleCertChain([LEAF_NO_OID, INT, ROOT], opts);
        expect(r).toEqual({ ok: false, reason: "leaf lacks Apple's receipt-signing OID" });
    });

    it("⛔ links out of order (leaf not signed by the next) are rejected", () => {
        expect(verifyAppleCertChain([LEAF, ROOT, INT], opts).ok).toBe(false);
    });

    it("⛔ a chain checked after its certificates expire is rejected", () => {
        expect(verifyAppleCertChain([LEAF, INT, ROOT], { ...opts, now: new Date("2060-01-01T00:00:00Z") }).ok).toBe(false);
    });

    it("⛔ too short, missing, or garbage ⇒ rejected, never throws", () => {
        expect(verifyAppleCertChain([LEAF, ROOT], opts).ok).toBe(false);
        expect(verifyAppleCertChain(undefined, opts).ok).toBe(false);
        expect(verifyAppleCertChain(["not-a-cert", INT, ROOT], opts).ok).toBe(false);
    });
});

describe("verifyAppleJWS uses it — report-only until switched", () => {
    afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

    // A JWS signed by the TEST leaf, carrying the TEST chain (so the real Apple pin fails it).
    const testJws = () => TEST_JWS;

    it("report mode (default): a non-Apple chain is LOGGED but still accepted (nothing breaks yet)", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { verifyAppleJWS } = await import("@/lib/apple/storeServer");
        expect(verifyAppleJWS(testJws())).toBe(true);
        expect(warn.mock.calls.flat().join(" ")).toMatch(/chain check failed \(report-only/);
    });

    it("enforce mode: the same answer is REJECTED", async () => {
        vi.stubEnv("APPLE_JWS_CHAIN_MODE", "enforce");
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { verifyAppleJWS } = await import("@/lib/apple/storeServer");
        expect(verifyAppleJWS(testJws())).toBe(false);
    });

    it("a bad SIGNATURE is still rejected in either mode (the old check is unchanged)", async () => {
        const { verifyAppleJWS } = await import("@/lib/apple/storeServer");
        const j = testJws();
        const tampered = j.slice(0, j.lastIndexOf(".") + 1) + "A".repeat(86);
        expect(verifyAppleJWS(tampered)).toBe(false);
    });
});
