"use client";

// src/app/auth/callback/page.tsx
//
// createBrowserClient has detectSessionInUrl:true by default — it auto-exchanges
// the PKCE ?code= on initialization. We must NOT call exchangeCodeForSession()
// manually (double-exchange always fails with "invalid grant").
//
// React Strict Mode (active in dev) runs effects TWICE with a cleanup in between.
// The old "ran.current" guard caused the auth subscription to be killed by the
// first cleanup before the SIGNED_IN event fired, leaving the page stuck.
//
// Fix: use a single module-level Supabase client (created once per page load)
// so the PKCE exchange isn't repeated. The "done" flag prevents double-navigation.
// No cleanup needed — the component unmounts immediately after navigate() fires.

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// Module-level client — created once regardless of Strict Mode re-renders.
// detectSessionInUrl:true (default) starts the PKCE exchange on first creation.
const supabaseCb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

let navigated = false; // module-level flag — survives Strict Mode double-run

function CallbackHandler() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const rawRedirect = searchParams.get("redirectTo") ?? "";
        const redirectTo =
            rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
                ? rawRedirect
                : "/chat";

        // Fast-fail: Supabase itself returned an OAuth error.
        const oauthError = searchParams.get("error");
        if (oauthError) {
            const desc = searchParams.get("error_description") || oauthError;
            if (!navigated) {
                navigated = true;
                window.location.href = `${redirectTo}?auth_error=${encodeURIComponent(desc)}`;
            }
            return;
        }

        const navigate = (path: string) => {
            if (navigated) return;
            navigated = true;
            window.location.href = path;
        };

        // The module-level client may have already exchanged the code and have
        // a session — check immediately before subscribing.
        supabaseCb.auth.getSession().then(({ data: { session } }) => {
            if (session) { navigate(redirectTo); }
        });

        const { data: { subscription } } = supabaseCb.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
                clearTimeout(fallback);
                if (session) {
                    navigate(redirectTo);
                } else {
                    navigate(`${redirectTo}?auth_error=no_session`);
                }
            }
        });

        // Safety net: redirect after 10 s even if the exchange never fires.
        const fallback = setTimeout(() => {
            navigate(`${redirectTo}?auth_error=timeout`);
        }, 10_000);

        // Only unsubscribe when the component actually unmounts (navigation done).
        // Do NOT unsubscribe in the Strict Mode cleanup — the subscription must
        // stay alive until SIGNED_IN fires.
        return () => {
            subscription.unsubscribe();
            clearTimeout(fallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

export default function AuthCallbackPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
            <Suspense>
                <CallbackHandler />
            </Suspense>
            Signing you in…
        </div>
    );
}
