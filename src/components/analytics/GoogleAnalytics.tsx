// src/components/analytics/GoogleAnalytics.tsx
//
// Loads Google Analytics 4 whenever NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
//
// ⚠️ No consent gate — owner decision 2026-09-16, see lib/analytics/ga.ts for
// the reasoning and for the reliable lever if it is ever revisited.
//
// ⚠️ The CSP in next.config.ts must allow googletagmanager.com in script-src and
// the analytics endpoints in connect-src. Without those the browser blocks this
// silently — GA appears installed and simply never reports.
"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { gaMeasurementId } from "@/lib/analytics/ga";

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
 * The web stream also has Enhanced Measurement disabled, so this is the single
 * source of page views; turning that back on in the GA console would duplicate
 * every navigation.
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
    if (!measurementId) return null;

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
                    // ⚠️ Advertising features stay DENIED. This is not decoration:
                    // it is what keeps the privacy policy's "No ad-tech" line
                    // true, and it is the reason this can be measurement without
                    // becoming profiling. Do not "enable ads features" without
                    // changing the policy first.
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
