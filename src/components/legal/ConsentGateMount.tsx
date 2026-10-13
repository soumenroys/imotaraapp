"use client";
// src/components/legal/ConsentGateMount.tsx
//
// Mounts the first-use acceptance gate app-wide and persists the acceptance.
//
// ⛔ ROUTES THAT MUST NEVER BE GATED: /terms and /privacy. The gate links to
// both, so gating them would mean a person cannot read what they are being
// asked to agree to — the links would loop back into the gate. /admin is
// excluded too: it is Imotara's own internal panel, not a product surface.

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ConsentGate from "./ConsentGate";
import { getOrCreateAnonId } from "@/lib/legal/anonId";
import type { TermsAcceptance } from "@/lib/legal/termsVersion";

const PROFILE_STORAGE_KEY = "imotara.profile.v1";

/** Prefixes the gate must never cover. */
const UNGATED = ["/terms", "/privacy", "/admin"];

function readStoredLang(): string | undefined {
    try {
        const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        const lang = parsed?.user?.preferredLang;
        // ⛔ "auto" is not a language. Passing it through would render the gate
        // in English for the very people it most needs to reach — the same
        // trap that put the crisis card in English (a6f167f).
        return typeof lang === "string" && lang && lang !== "auto" ? lang : undefined;
    } catch {
        return undefined;
    }
}

export default function ConsentGateMount() {
    const pathname = usePathname();
    const [lang, setLang] = useState<string | undefined>(undefined);

    useEffect(() => {
        setLang(readStoredLang());
        // Settings broadcasts this when the language changes; the gate should
        // follow it rather than keep a stale language for the session.
        const onProfile = () => setLang(readStoredLang());
        window.addEventListener("imotara:profile-updated", onProfile);
        return () => window.removeEventListener("imotara:profile-updated", onProfile);
    }, []);

    const persist = useCallback((record: TermsAcceptance) => {
        const anonId = getOrCreateAnonId();
        // Fire-and-forget: the person has already been let through. A failed
        // write is logged server-side, never shown to them, and never blocks.
        void fetch("/api/legal/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                anonId,
                locale: record.locale,
                surface: record.surface,
                acceptedAt: record.acceptedAt,
            }),
            keepalive: true,
        }).catch(() => {});
    }, []);

    if (UNGATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

    return <ConsentGate lang={lang} onAccepted={persist} />;
}
