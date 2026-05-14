// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    // Where to send the user after successful login.
    // Only allow same-origin relative paths to prevent open-redirect abuse.
    const rawRedirect = url.searchParams.get("redirectTo") ?? "";
    const redirectTo =
        rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
            ? rawRedirect
            : "/chat";

    // If no code, return to the intended destination with an error param
    if (!code) {
        return NextResponse.redirect(new URL(`${redirectTo}?auth_error=missing_code`, url));
    }

    const cookieStore = await cookies();

    // Build the redirect response first so we can attach session cookies to it.
    // cookieStore.set() cookies are NOT forwarded through NextResponse.redirect(),
    // so we must call response.cookies.set() directly.
    const response = NextResponse.redirect(new URL(redirectTo, url));

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(
            new URL(
                `${redirectTo}?auth_error=${encodeURIComponent(error.name ?? "exchange_failed")}`,
                url
            )
        );
    }

    return response;
}
