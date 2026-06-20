// src/lib/connect/auth.ts
// Shared auth helper for all /api/connect/* routes.
// Returns the authenticated user's ID via Bearer token (mobile) or cookie (web).

import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";

export interface ConnectUser {
  id: string;
  email?: string;
}

/**
 * Resolves the authenticated user from a request.
 * Tries: Bearer token → Supabase cookie session → null.
 */
export async function getConnectUser(req: Request): Promise<ConnectUser | null> {
  // 1. Bearer token (mobile)
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const { data } = await supabaseServer.auth.getUser(token);
    if (data?.user?.id) {
      return { id: data.user.id, email: data.user.email };
    }
    // Bearer token present but invalid/expired — fail immediately.
    // Do NOT fall through to cookie auth: that would allow an expired mobile token
    // combined with a valid web cookie to silently authenticate as the cookie's user.
    return null;
  }

  // 2. Cookie session (web)
  try {
    const supabase = await supabaseUserServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return { id: user.id, email: user.email };
  } catch {
    // no cookie session
  }

  return null;
}
