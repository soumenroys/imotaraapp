"use client";

// src/components/auth/GoogleIdButton.tsx
//
// #169 — Google's OWN sign-in button (Google Identity Services).
//
// Why: our old button sent people through Supabase's authorize page, so Google's
// account chooser said "to continue to rfsbvbqtiesswnplslln.supabase.co" — a
// name nobody recognises, on the step where trust matters most. Google's button
// opens Google's pop-up for THIS site (imotara.com) and hands the ID token back
// to the page; Supabase then signs in with it (signInWithIdToken), exactly like
// the iPhone app's Apple sign-in.
//
// ⛔ NEVER WORSE THAN BEFORE: until Google's script has loaded and drawn its
// button, and on any host Google has not been told about (imotara.net/.org,
// previews, localhost without setup), the OLD button is shown instead and does
// the OLD redirect. A blocked script, an ad-blocker or an outage costs nothing
// but the old wording.
//
// 🔒 A fresh nonce per page: Google signs its SHA-256 into the token, Supabase is
// given the raw value and checks they match — a stolen token cannot be replayed.

import { useEffect, useRef, useState } from "react";

/** The web client in Google Cloud project "imotara" — public by design (it is in every page that uses it). */
export const GOOGLE_WEB_CLIENT_ID = "425826097896-980pi64uoif2o4jflm68chlf39lsdbre.apps.googleusercontent.com";

/**
 * Hosts listed as "Authorised JavaScript origins" on that client. Google refuses
 * any other origin, so anywhere else we never even try.
 */
export const GIS_HOSTS = new Set(["www.imotara.com", "imotara.com", "localhost"]);

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
/**
 * Give Google this long to draw its button before the old one takes its place.
 * 🔴 21 Nov 2026: the owner's first live sign-in went through the OLD redirect
 * (Supabase logged grant_type=pkce, not id_token) — the old button used to sit in
 * this slot WHILE Google's loaded, and a quick click landed on it. Now the slot
 * shows a quiet placeholder while waiting, and the script is preloaded with the
 * page (preloadGis) so the wait is normally nil.
 */
const LOAD_BUDGET_MS = 2500;

type Gis = {
    accounts: {
        id: {
            initialize: (o: Record<string, unknown>) => void;
            renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
    };
};

declare global {
    interface Window {
        google?: Gis;
    }
}

let scriptPromise: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
    if (window.google?.accounts?.id) return Promise.resolve(window.google);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise<Gis>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = SCRIPT_SRC;
        s.async = true;
        s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error("gis missing")));
        s.onerror = () => {
            scriptPromise = null; // allow a later retry
            reject(new Error("gis blocked"));
        };
        document.head.appendChild(s);
    });
    return scriptPromise;
}

async function sha256Hex(s: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Start fetching Google's script early (page idle), so the panel's button is ready when opened. */
export function preloadGis(): void {
    if (typeof window === "undefined" || !canUseGis(window.location.hostname)) return;
    loadGis().catch(() => {});
}

/** Pure — may this page use Google's button at all? */
export function canUseGis(hostname: string): boolean {
    return GIS_HOSTS.has(hostname);
}

type Props = {
    /** Google handed us a token: sign in with it. Throwing/returning false shows the fallback. */
    onToken: (idToken: string, rawNonce: string) => Promise<void>;
    /** The old button — shown until (and unless) Google's own button is ready. */
    fallback: React.ReactNode;
    /** Disable while another sign-in is running. */
    disabled?: boolean;
};

export default function GoogleIdButton({ onToken, fallback, disabled }: Props) {
    const holder = useRef<HTMLDivElement>(null);
    // waiting: Google's button is loading (placeholder, nothing clickable) ·
    // ready: Google's button · fallback: the old button (blocked, slow, or not our host)
    const [phase, setPhase] = useState<"waiting" | "ready" | "fallback">("waiting");
    const ready = phase === "ready";
    // Latest onToken for Google's callback, which fires long after render. Updated in an
    // effect, not during render (react-hooks/refs — this line broke CI lint from 21 Nov).
    const onTokenRef = useRef(onToken);
    useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

    useEffect(() => {
        if (!canUseGis(window.location.hostname)) { setPhase("fallback"); return; }
        let alive = true;
        const giveUp = window.setTimeout(() => { alive = false; setPhase((p) => (p === "ready" ? p : "fallback")); }, LOAD_BUDGET_MS);
        (async () => {
            try {
                const raw = randomNonce();
                const hashed = await sha256Hex(raw);
                const g = await loadGis();
                if (!alive || !holder.current) return;
                g.accounts.id.initialize({
                    client_id: GOOGLE_WEB_CLIENT_ID,
                    nonce: hashed,
                    // The pop-up, not a redirect: the person stays on this page.
                    ux_mode: "popup",
                    // Never sign anyone in without a click.
                    auto_select: false,
                    itp_support: true,
                    use_fedcm_for_button: true,
                    callback: (r: { credential?: string }) => {
                        if (r?.credential) void onTokenRef.current(r.credential, raw);
                    },
                });
                // Match the panel: full width up to Google's 400 px maximum.
                const width = Math.min(400, Math.max(240, Math.round(holder.current.getBoundingClientRect().width || 320)));
                g.accounts.id.renderButton(holder.current, {
                    type: "standard",
                    theme: "filled_black",
                    size: "large",
                    text: "continue_with",
                    shape: "pill",
                    logo_alignment: "center",
                    width,
                });
                window.clearTimeout(giveUp);
                if (alive) setPhase("ready");
            } catch {
                // blocked / offline / Google down — the old button takes the slot
                window.clearTimeout(giveUp);
                if (alive) setPhase("fallback");
            }
        })();
        return () => {
            alive = false;
            window.clearTimeout(giveUp);
        };
    }, []);

    return (
        <div className="relative w-full">
            {/* Google draws into this; hidden until it has. */}
            <div
                ref={holder}
                // Google's frame paints an opaque WHITE canvas on a dark-scheme page (white
                // corners round the pill). "light" here lets it stay transparent.
                style={{ colorScheme: "light" }}
                aria-hidden={!ready}
                className={ready ? `flex w-full justify-center ${disabled ? "pointer-events-none opacity-50" : ""}` : "absolute h-0 w-full overflow-hidden opacity-0"}
            />
            {phase === "waiting" && (
                <div
                    role="status"
                    aria-label="Loading Google sign-in"
                    className="h-11 w-full animate-pulse rounded-full border border-white/10 bg-white/5"
                />
            )}
            {phase === "fallback" && fallback}
        </div>
    );
}
