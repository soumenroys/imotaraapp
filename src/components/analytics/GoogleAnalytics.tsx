// src/components/analytics/GoogleAnalytics.tsx
//
// Loads Google Analytics 4 — but only when BOTH are true:
//   1. NEXT_PUBLIC_GA_MEASUREMENT_ID is set, and
//   2. the visitor has actively granted consent.
//
// Until then nothing is injected, no request leaves the browser, and no cookie
// is written. Denying is not "load it and tell it to behave"; the script is
// never added to the page at all.
//
// ⚠️ The CSP in next.config.ts must allow googletagmanager.com in script-src and
// the analytics endpoints in connect-src. Without those the browser blocks this
// silently — GA appears installed and simply never reports.
"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
    ANALYTICS_CONSENT_EVENT,
    analyticsAllowed,
    gaMeasurementId,
    readAnalyticsConsent,
    type AnalyticsConsent,
} from "@/lib/analytics/consent";

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

/**
 * Sends a page_view on client-side navigation.
 *
 * GA's own SPA detection is unreliable with the App Router, so automatic
 * page_view is turned OFF in the config below and fired from here instead —
 * otherwise a visitor moving between routes is either missed or double-counted.
 *
 * Reads useSearchParams, which forces a Suspense boundary at build time; the
 * parent wraps it.
 */
function PageViews({ measurementId }: { measurementId: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window.gtag !== "function") return;
        const qs = searchParams?.toString();
        window.gtag("event", "page_view", {
            page_path: qs ? `${pathname}?${qs}` : pathname,
            send_to: measurementId,
        });
    }, [pathname, searchParams, measurementId]);

    return null;
}

export default function GoogleAnalytics() {
    const measurementId = gaMeasurementId();
    const [consent, setConsent] = useState<AnalyticsConsent>("unset");

    useEffect(() => {
        setConsent(readAnalyticsConsent());
        const handler = (e: Event) => setConsent((e as CustomEvent).detail as AnalyticsConsent);
        window.addEventListener(ANALYTICS_CONSENT_EVENT, handler);
        return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, handler);
    }, []);

    if (!measurementId || !analyticsAllowed(consent)) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    // anonymize_ip: GA4 does this by default, set explicitly so the
                    // intent survives anyone reading this config later.
                    // ad_storage denied: this is measurement, not advertising — it
                    // keeps the privacy policy's "no ad-tech" line true as written.
                    gtag('consent', 'default', {
                        ad_storage: 'denied',
                        ad_user_data: 'denied',
                        ad_personalization: 'denied',
                        analytics_storage: 'granted'
                    });
                    gtag('config', '${measurementId}', {
                        anonymize_ip: true,
                        allow_google_signals: false,
                        allow_ad_personalization_signals: false,
                        send_page_view: false
                    });
                `}
            </Script>
            <Suspense fallback={null}>
                <PageViews measurementId={measurementId} />
            </Suspense>
        </>
    );
}
