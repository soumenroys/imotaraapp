/**
 * #38 (24 Nov 2026): Settings showed a fixed ₹49–₹999 ladder while the server charges
 * by the visitor's country band. Both donate surfaces now read ONE hook.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FALLBACK_DONATION_PRESETS } from "@/hooks/useDonationPresets";
import { tierForPresetId, donationPresetsForBand, bandForCountry } from "@/lib/imotara/pricingBands";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("one source for the donation buttons", () => {
  it("Settings and /donate both use useDonationPresets", () => {
    expect(src("src/app/settings/page.tsx")).toContain("const DONATION_PRESETS = useDonationPresets();");
    expect(src("src/app/donate/page.tsx")).toContain("const presets = useDonationPresets();");
  });

  it("⛔ no hard-coded rupee ladder left in Settings", () => {
    const s = src("src/app/settings/page.tsx");
    expect(s).not.toMatch(/id:\s*"inr_49"/);
    expect(s).not.toMatch(/label:\s*"₹49"/);
  });

  it("the hook asks the band endpoint, never caches it", () => {
    const h = src("src/hooks/useDonationPresets.ts");
    expect(h).toContain('fetch("/api/payments/donation-presets", { cache: "no-store" })');
  });

  it("every fallback id is a tier the server accepts", () => {
    for (const p of FALLBACK_DONATION_PRESETS) expect(tierForPresetId(p.id)).not.toBeNull();
  });

  it("the fallback equals the India ladder the server would send", () => {
    const india = donationPresetsForBand(bandForCountry("IN"));
    expect(FALLBACK_DONATION_PRESETS.map((p) => [p.id, p.amount])).toEqual(india.map((p) => [p.id, p.paise]));
  });
});

describe("⛔ no offline promise in the home-screen prompt (24 Nov 2026)", () => {
  it("replies need the internet, so the install prompt never says 'offline'", () => {
    const p = src("src/components/imotara/PWAInstallPrompt.tsx");
    expect(p).not.toMatch(/offline/i);
    expect(p).toContain("Open Imotara in one tap, like an app.");
  });
});
