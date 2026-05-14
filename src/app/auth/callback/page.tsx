"use client";

// src/app/auth/callback/page.tsx
//
// createBrowserClient has detectSessionInUrl:true by default, so it
// auto-exchanges the PKCE ?code= during initialize(). Calling
// exchangeCodeForSession() a second time always fails ("invalid grant").
//
// Fix: don't call it manually. Subscribe to onAuthStateChange, wait for
// SIGNED_IN or INITIAL_SESSION (whichever arrives first), then do a
// full-page navigation (window.location.href) to the destination.
// A full reload means the destination page starts with a fresh
// createBrowserClient that reads the session from cookies — reliable.

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function CallbackHandler() {
    const searchParams = useSearchParams();
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const rawRedirect = searchParams.get("redirectTo") ?? "";
        const redirectTo =
            rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
                ? rawRedirect
                : "/chat";

        // Creating the client triggers the auto-exchange of ?code= via detectSessionInUrl.
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        let done = false;

        const navigate = (path: string) => {
            if (done) return;
            done = true;
            // Full-page navigation so the destination starts with a clean JS
            // environment and reads the session from cookies.
            window.location.href = path;
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
                subscription.unsubscribe();
                clearTimeout(fallback);
                navigate(redirectTo);
            }
        });

        // Safety net: if the exchange never fires within 10 s, bail with an error.
        const fallback = setTimeout(() => {
            subscription.unsubscribe();
            navigate(`${redirectTo}?auth_error=timeout`);
        }, 10_000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(fallback);
        };
    }, [searchParams]);

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
