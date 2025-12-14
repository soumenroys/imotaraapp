// src/lib/prodGuard.ts
/**
 * Central place to block dev-only routes and dev-only API switches in production.
 *
 * You can override in production by setting:
 *   IMOTARA_ADMIN_TOKEN=<some-long-random>
 * and providing header:
 *   x-imotara-admin: <token>
 *
 * In dev, everything is allowed by default.
 */
export function isProd(): boolean {
    return process.env.NODE_ENV === "production";
}

export function getAdminToken(): string | undefined {
    const t = process.env.IMOTARA_ADMIN_TOKEN;
    return t && t.trim().length > 0 ? t.trim() : undefined;
}

/**
 * Returns true if the request is allowed to use dev/admin capabilities.
 * - In dev: allowed
 * - In prod: allowed only when IMOTARA_ADMIN_TOKEN is set AND header matches
 *   (If token is not set: dev/admin capabilities are blocked)
 */
export function isAdminRequest(req: Request): boolean {
    if (!isProd()) return true;

    const token = getAdminToken();
    if (!token) return false;

    const header = req.headers.get("x-imotara-admin")?.trim();
    return header === token;
}

/**
 * For pages/routes: return a Response when blocked, otherwise null.
 */
export function blockIfProdNotAdmin(req: Request): Response | null {
    if (!isProd()) return null;
    if (isAdminRequest(req)) return null;

    // 404 is safer than 401 for hidden dev routes
    return new Response("Not Found", { status: 404 });
}
