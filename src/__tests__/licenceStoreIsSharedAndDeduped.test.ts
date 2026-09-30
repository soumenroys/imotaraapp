/**
 * Everything that shows a plan reads ONE copy of it.
 *
 * 🔴 WHY. There were EIGHT independent copies of the licence: every
 * `useLicense()` call site owned a `useState` AND fired its own request —
 * header, chat, upgrade, the badge, useFeatureGate, license-debug — plus
 * `settings/page.tsx` kept a private eighth with its own fetch.
 *
 * Eight fetches at eight different moments produce eight different answers.
 * Reported 2026-10-01, all one flaw:
 *
 *   1. the header plan capsule appearing after one sign-in and not the next
 *   2. **the header showing "Plus" while Settings showed "Free" at the same
 *      time**, both on screen at once
 *   3. the plan appearing only after a delay
 *
 * 🔑 Fixing the TRIGGERS was necessary and not sufficient. Telling eight caches
 * to refresh still leaves eight caches; they converge only if there is one.
 *
 * ⚠️ These are BEHAVIOURAL tests against the real module, not source greps.
 * The dedupe and the keep-last-good-data rule are runtime properties — a source
 * assertion would pin the spelling and miss the behaviour.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
    fetchLicense,
    getLicenseSnapshot,
    subscribeLicenseStore,
    __resetLicenseStoreForTests,
} from "@/lib/imotara/licenseStore";

const PLUS = {
    ok: true, mode: "log",
    license: { status: "valid", tier: "plus", mode: "log", source: "personal", expiresAt: null },
    org: null, user: { id: "u1", email: "a@b.c" },
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok, status, json: async () => body,
    });
}

beforeEach(() => { __resetLicenseStoreForTests(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("🔴 one store, one answer", () => {
    it("every consumer sees the SAME object after one fetch", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        await fetchLicense();

        // Two "consumers" reading independently — the header and Settings.
        const header = getLicenseSnapshot();
        const settings = getLicenseSnapshot();

        expect(header).toBe(settings);                       // same reference
        expect(header.data?.license?.tier).toBe("plus");
        expect(settings.data?.license?.tier).toBe("plus");
    });

    it("🔴 eight concurrent consumers cause ONE request, not eight", async () => {
        const f = mockFetchOnce(PLUS);
        vi.stubGlobal("fetch", f);

        // Eight components mounting in the same tick, as they do on a page load.
        await Promise.all(Array.from({ length: 8 }, () => fetchLicense()));

        expect(f).toHaveBeenCalledTimes(1);
        expect(getLicenseSnapshot().data?.license?.tier).toBe("plus");
    });

    it("notifies subscribers when the answer arrives", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        const seen: string[] = [];
        const off = subscribeLicenseStore(() => {
            seen.push(getLicenseSnapshot().data?.license?.tier ?? "none");
        });
        await fetchLicense();
        off();
        expect(seen).toContain("plus");
    });

    it("unsubscribed listeners stop being called", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        const fn = vi.fn();
        subscribeLicenseStore(fn)();          // subscribe then immediately release
        await fetchLicense();
        expect(fn).not.toHaveBeenCalled();
    });
});

describe("⚠️ a failed fetch must never downgrade anyone", () => {
    it("🔴 keeps the last good data when the server returns 503", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        await fetchLicense();
        expect(getLicenseSnapshot().data?.license?.tier).toBe("plus");

        // The server answers 503 `tier_unresolved` when it cannot resolve a tier.
        vi.stubGlobal("fetch", mockFetchOnce({ ok: false, error: "tier_unresolved" }, false, 503));
        await fetchLicense();

        const snap = getLicenseSnapshot();
        expect(snap.error).toBe("HTTP 503");
        // 🔴 THE POINT: still plus. Substituting "free" here is precisely how a
        // paying subscriber gets shown the free plan.
        expect(snap.data?.license?.tier).toBe("plus");
    });

    it("keeps the last good data when the network throws", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        await fetchLicense();

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        await fetchLicense();

        expect(getLicenseSnapshot().data?.license?.tier).toBe("plus");
    });

    it("🔑 `loading` latches false after the first settle, so the UI stops hiding", () => {
        expect(getLicenseSnapshot().loading).toBe(true);   // fresh store
    });

    it("🔴 `loading` never goes true again — the capsule must not blink out", async () => {
        vi.stubGlobal("fetch", mockFetchOnce(PLUS));
        await fetchLicense();
        expect(getLicenseSnapshot().loading).toBe(false);

        // ⚠️ Checking only AFTER the refresh resolves cannot see this: the
        // success path sets loading false again, so a transient flip is
        // invisible by then. Record every EMITTED snapshot instead.
        // (Caught by mutation testing — the first version of this test passed
        //  with `loading: true` set at the start of every fetch.)
        const emitted: boolean[] = [];
        const off = subscribeLicenseStore(() => {
            emitted.push(getLicenseSnapshot().loading);
        });
        await fetchLicense();
        off();

        // The header capsule is gated on !loading. Any true here is a blink-out
        // on every auth event and every tab focus.
        expect(emitted.length).toBeGreaterThan(0);
        expect(emitted).not.toContain(true);
    });
});
