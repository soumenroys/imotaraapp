// src/lib/analytics/consent.ts
//
// Consent state for Google Analytics on the WEBSITE. Deliberately separate from
// src/lib/imotara/consent.ts, which governs whether a chat message may be sent
// for AI analysis — a different question with different stakes, and conflating
// the two would let a person's answer about their own chat content silently
// decide whether a third-party tracker runs.
//
// ⚠️ THE DEFAULT IS "no analytics". GA must not fire until someone has actively
// said yes. That is the GDPR requirement for prior consent, and this app asks
// EVERYONE rather than only visitors it believes to be in the EU. Geo-guessing
// here would be client-side and heuristic (locale → language → timezone), and a
// wrong guess is not a lost data point — it is an unconsented tracker on an EU
// visitor. Asking everyone removes that failure mode entirely, at the price of
// less data. For a product whose privacy policy is part of the pitch, that is
// the right side to err on.

export type AnalyticsConsent = "granted" | "denied" | "unset";

export const ANALYTICS_CONSENT_KEY = "imotara.analytics.consent.v1";

/** Fired after the visitor chooses, so the GA loader can react without a reload. */
export const ANALYTICS_CONSENT_EVENT = "imotara:analytics-consent";

export function readAnalyticsConsent(): AnalyticsConsent {
    if (typeof window === "undefined") return "unset";
    try {
        const raw = localStorage.getItem(ANALYTICS_CONSENT_KEY);
        return raw === "granted" || raw === "denied" ? raw : "unset";
    } catch {
        // Private mode, blocked storage, or a browser that throws on access.
        // Treat as "not asked" rather than assuming permission.
        return "unset";
    }
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, "unset">): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    } catch {
        // If we cannot remember the answer we must not act on it either — the
        // banner will simply ask again next time, which is the safe failure.
    }
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: value }));
}

/**
 * The measurement id, or null when analytics is not configured.
 *
 * Env-gated exactly like every other optional integration here: with no
 * NEXT_PUBLIC_GA_MEASUREMENT_ID set, no script is injected, no banner is shown,
 * and the site behaves as it always has. That is what makes this safe to merge
 * before any GA property exists.
 */
export function gaMeasurementId(): string | null {
    const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
    return id ? id : null;
}

/** Should the consent banner be shown at all? */
export function shouldAskForAnalyticsConsent(consent: AnalyticsConsent): boolean {
    return gaMeasurementId() !== null && consent === "unset";
}

/** May GA actually load and send? */
export function analyticsAllowed(consent: AnalyticsConsent): boolean {
    return gaMeasurementId() !== null && consent === "granted";
}
