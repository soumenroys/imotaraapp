// src/lib/supabaseServer.ts
import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Public envs (safe to expose)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-only secret
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

// 🔴 Moved to @/lib/supabase/cookieOptions — and `httpOnly` was REMOVED there,
// because it made the session invisible to @supabase/ssr's browser client and
// broke signing in entirely. Read that file before changing anything here.
// Re-exported under the old name so existing imports keep working.
export { SUPABASE_COOKIE_OPTIONS as SECURE_COOKIE_OPTIONS } from "@/lib/supabase/cookieOptions";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookieOptions";

/**
 * Admin client (service role) — bypasses RLS.
 * Use ONLY for trusted server-side operations where you explicitly intend admin access.
 */
export function getSupabaseAdmin() {
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/**
 * User-bound server client — respects RLS and reads auth from cookies.
 * This is what we should use to identify the anonymous user (auth.uid()) on server routes.
 */
export async function getSupabaseUserServerClient() {
    const cookieStore = await cookies();

    return createServerClient(supabaseUrl, anonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value;
            },
            set() {
                // no-op for route handlers
            },
            remove() {
                // no-op
            },
        },
        cookieOptions: SUPABASE_COOKIE_OPTIONS,
    });
}

// -----------------------------------------------------------------------------
// Backward-compatible export (do not remove yet)
// Many routes still import { supabaseServer }.
// Keep it as an alias of the admin client for now.
// -----------------------------------------------------------------------------
export const supabaseServer = getSupabaseAdmin();


