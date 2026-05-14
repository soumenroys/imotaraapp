"use client";

// src/app/auth/callback/page.tsx
// Client-side OAuth callback — lets createBrowserClient handle the PKCE code
// exchange using the code_verifier it stored itself. Avoids the server-side
// cookie-on-redirect problem entirely.

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function CallbackHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const code = searchParams.get("code");
        const rawRedirect = searchParams.get("redirectTo") ?? "";
        const redirectTo =
            rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
                ? rawRedirect
                : "/chat";

        if (!code) {
            router.replace(`${redirectTo}?auth_error=missing_code`);
            return;
        }

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
                router.replace(
                    `${redirectTo}?auth_error=${encodeURIComponent(error.name ?? "exchange_failed")}`
                );
            } else {
                router.replace(redirectTo);
            }
        }).catch(() => {
            router.replace(`${redirectTo}?auth_error=exchange_failed`);
        });
    }, [searchParams, router]);

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
