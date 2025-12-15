// src/lib/supabaseServer.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment"
    );
}

/**
 * Server-side Supabase client.
 * - Uses Service Role key
 * - Bypasses RLS
 * - NEVER import this in client/browser code
 */
export const supabaseServer = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);
