import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isProd() {
    return process.env.NODE_ENV === "production";
}

// Block internal/dev-only routes in production (defense-in-depth).
export function middleware(req: NextRequest) {
    if (!isProd()) return NextResponse.next();

    const { pathname } = req.nextUrl;

    // Keep this list conservative: only block clearly dev-only routes.
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

    return NextResponse.next();
}

// Apply to all routes except Next internals + static assets.
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
