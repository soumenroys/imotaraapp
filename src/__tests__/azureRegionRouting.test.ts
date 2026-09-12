/**
 * Azure is chosen by where the FUNCTION runs, not where the user is.
 *
 * The request to Azure is made by the function. Measured against production
 * 2026-09-12: `x-vercel-id: bom1::iad1::…` — a request from India entered at
 * Mumbai, executed in Washington DC, and called Azure centralindia, so the
 * audio crossed the Pacific twice. Only the Azure -> function leg is
 * controllable here; the function -> user leg is fixed by where compute runs.
 *
 * Country routing is kept as the fallback for anywhere VERCEL_REGION is unset
 * (local dev, tests, any non-Vercel host).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAzureConfig } from "@/lib/azure-tts/regionRouter";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });
beforeEach(() => {
    process.env = { ...ENV };
    for (const s of ["IN", "EU", "US", "AP"]) {
        process.env[`AZURE_SPEECH_KEY_${s}`] = `key-${s}`;
        process.env[`AZURE_SPEECH_REGION_${s}`] = `region-${s}`;
    }
});

// getAzureConfig reads process.env when CALLED, not at import, so a plain
// static import is enough — the env changes between tests take effect.
describe("the function's region decides", () => {
    it("a function in iad1 uses the US resource, even for an Indian visitor", () => {
        process.env.VERCEL_REGION = "iad1";
        // The exact case measured in production.
        expect(getAzureConfig("IN").region).toBe("region-US");
    });

    it("a function in bom1 uses the India resource — the fully-local case", () => {
        process.env.VERCEL_REGION = "bom1";
        expect(getAzureConfig("US").region).toBe("region-IN");
    });

    it("a function in fra1 uses the EU resource", () => {
        process.env.VERCEL_REGION = "fra1";
        expect(getAzureConfig("IN").region).toBe("region-EU");
    });

    it("a function in sin1 uses the AP resource", () => {
        process.env.VERCEL_REGION = "sin1";
        expect(getAzureConfig("GB").region).toBe("region-AP");
    });
});

describe("country routing still covers everywhere VERCEL_REGION is not set", () => {
    it("falls back to the user's country off-Vercel", () => {
        delete process.env.VERCEL_REGION;
        expect(getAzureConfig("IN").region).toBe("region-IN");
        expect(getAzureConfig("DE").region).toBe("region-EU");
        expect(getAzureConfig("US").region).toBe("region-US");
        expect(getAzureConfig("JP").region).toBe("region-AP");
    });

    it("falls back rather than guessing when the Vercel region is unrecognised", () => {
        // A new Vercel region should degrade to the old behaviour, not to a
        // wrong resource or a crash.
        process.env.VERCEL_REGION = "xyz9";
        expect(getAzureConfig("DE").region).toBe("region-EU");
    });

    it("still defaults to India for an unknown country", () => {
        delete process.env.VERCEL_REGION;
        expect(getAzureConfig(null).region).toBe("region-IN");
        expect(getAzureConfig("ZZ").region).toBe("region-IN");
    });
});

describe("a missing credential is still a loud failure", () => {
    it("throws rather than silently using another region", () => {
        process.env.VERCEL_REGION = "iad1";
        delete process.env.AZURE_SPEECH_KEY_US;
        expect(() => getAzureConfig("IN")).toThrow(/not configured for region US/);
    });
});
