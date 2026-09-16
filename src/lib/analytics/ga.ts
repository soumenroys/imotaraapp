// src/lib/analytics/ga.ts
//
// Google Analytics 4 configuration for the WEBSITE.
//
// ⚠️ THERE IS NO CONSENT GATE. Owner decision, 2026-09-16: no banner, analytics
// runs for every visitor. The trade-off was put to them explicitly — EU/UK
// visitors are tracked without the prior consent that GDPR/ePrivacy requires —
// and they chose this. Do not re-litigate it here; if it is ever revisited, the
// reliable lever is `x-vercel-ip-country` (already used by the TTS region
// router), which would let a banner be shown to EEA/UK visitors only while
// leaving everyone else untouched.
//
// What DOES still constrain this, and must not be quietly dropped:
//   - advertising features are off (see GoogleAnalytics.tsx), which is what
//     keeps the privacy policy's "No ad-tech" line true;
//   - the mobile apps carry no analytics SDK, which is what keeps the Play
//     Data Safety declaration true;
//   - the privacy policy states plainly that the website uses GA, with no
//     claim that it is opt-in.

/**
 * The measurement id, or null when analytics is not configured.
 *
 * Env-gated like every other optional integration here: with no
 * NEXT_PUBLIC_GA_MEASUREMENT_ID set, no script is injected and the site behaves
 * exactly as it did before. ⚠️ It is a NEXT_PUBLIC_ variable, so it is baked in
 * at BUILD time — setting it in Vercel without redeploying changes nothing.
 */
export function gaMeasurementId(): string | null {
    const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
    return id ? id : null;
}

/** May GA load and send? True whenever it is configured. */
export function analyticsEnabled(): boolean {
    return gaMeasurementId() !== null;
}
