"use client";
// src/hooks/useDonationPresets.ts
//
// #38 (24 Nov 2026): ONE source for the donation buttons on /donate AND Settings.
// Settings kept a hard-coded ₹49–₹999 ladder after /donate moved to country bands,
// so a visitor outside India saw one amount on the button and a different one at
// checkout (the server always charges by band — donation-intent re-derives it).
//
// ⚠️ The server decides the charge regardless; these labels can never cause a
// wrong charge, only a briefly wrong label while the fetch is in flight.

import { useEffect, useState } from "react";

export type DonationPreset = { id: string; label: string; amount: number };

/** Shown only until /api/payments/donation-presets answers (India / Band 3 ladder). */
export const FALLBACK_DONATION_PRESETS: DonationPreset[] = [
    { id: "t1", label: "₹49", amount: 4900 },
    { id: "t2", label: "₹99", amount: 9900 },
    { id: "t3", label: "₹199", amount: 19900 },
    { id: "t4", label: "₹499", amount: 49900 },
    { id: "t5", label: "₹999", amount: 99900 },
];

export function useDonationPresets(): DonationPreset[] {
    const [presets, setPresets] = useState<DonationPreset[]>(FALLBACK_DONATION_PRESETS);
    useEffect(() => {
        let alive = true;
        fetch("/api/payments/donation-presets", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!alive || !d?.presets?.length) return;
                setPresets(
                    d.presets.map((p: { id: string; label: string; paise: number }) => ({
                        id: p.id,
                        label: p.label,
                        amount: p.paise,
                    })),
                );
            })
            .catch(() => { /* keep the fallback — the server still charges correctly */ });
        return () => { alive = false; };
    }, []);
    return presets;
}
