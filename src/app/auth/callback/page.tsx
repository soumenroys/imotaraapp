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

        // Real bug, confirmed live: a user picked account A on Google's
        // consent screen but landed back on the app still signed in as
        // account B. Root cause was this page racing an immediate
        // getSession() (and accepting the subscription's INITIAL_SESSION
        // event, which fires synchronously with whatever CURRENT state
        // existed the instant we subscribed) against the actual PKCE code
        // exchange, which is an async network round-trip kicked off at
        // module load. Either of those early checks reads whatever session
        // this browser already had BEFORE the exchange completes — if this
        // browser had any prior session cached (this app's session storage
        // is shared across tabs via cookies), that stale, unrelated session
        // resolves first and navigate() fires with it, permanently winning
        // over the real, still-in-flight exchange for the account the user
        // actually just picked.
        //
        // Only a code param means an exchange is actually happening — in
        // that case, wait specifically for a genuine SIGNED_IN event (fired
        // when the exchange itself completes), not INITIAL_SESSION (which
        // reflects pre-exchange state) and not an immediate getSession()
        // call. With no code param, there's nothing to exchange, so any
        // existing/incoming session is legitimately the relevant one.
        const code = searchParams.get("code");

        if (!code) {
            supabaseCb.auth.getSession().then(({ data: { session } }) => {
                if (session) { navigate(redirectTo); }
            });
        }

        const { data: { subscription } } = supabaseCb.auth.onAuthStateChange((event, session) => {
            const relevant = code ? event === "SIGNED_IN" : (event === "SIGNED_IN" || event === "INITIAL_SESSION");
            if (relevant) {
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
