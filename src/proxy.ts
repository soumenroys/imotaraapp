import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isProd() {
    return process.env.NODE_ENV === "production";
}

export async function middleware(req: NextRequest) {
    // Block internal/dev-only routes in production (defense-in-depth).
    if (isProd()) {
        const { pathname } = req.nextUrl;
        const blockedPrefixes = [
            "/dev",
            "/debug",
            "/_debug",
            "/admin/dev",
            "/internal",
            "/license-debug",
        ];
        if (blockedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
            return new NextResponse("Not found", { status: 404 });
        }
    }

    // Refresh the Supabase session so server-side auth reads valid cookies.
    let response = NextResponse.next({ request: req });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
                    response = NextResponse.next({ request: req });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    await supabase.auth.getUser();

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

export default middleware;
