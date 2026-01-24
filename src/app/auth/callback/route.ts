// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
    console.log("🔥 AUTH CALLBACK HIT", request.url);
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    // Where to send the user after successful login
    const redirectTo = url.searchParams.get("redirectTo") ?? "/chat";

    // If no code, go back to login
    if (!code) {
        return NextResponse.redirect(new URL("/dev/login?error=missing_code", url));
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    // IMPORTANT: must set cookies on the response
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(
            new URL(
                `/dev/login?error=access_denied&error_code=${encodeURIComponent(
                    error.name ?? "exchange_failed"
                )}&error_description=${encodeURIComponent(error.message)}`,
                url
            )
        );
    }

    // Success → redirect into the app
    return NextResponse.redirect(new URL(redirectTo, url));
}
