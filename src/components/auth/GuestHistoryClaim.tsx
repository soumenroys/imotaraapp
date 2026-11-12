// src/components/auth/GuestHistoryClaim.tsx — #135 (owner chose A, 12 Nov 2026).
// When a real account is signed in, ask the server to move THIS browser's guest history into it
// (api/history/claim). Runs on load and on every sign-in; cheap and idempotent — nothing to move
// means nothing happens. Renders nothing.
// ⛔ Sends only this browser's own guest id (lib/imotara/userScope.ts) — never a Link Key.
"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getUserScopeId } from "@/lib/imotara/userScope";

const DONE_KEY = "imotara.guestHistoryClaim.v1"; // "<userId>|<deviceScope>|<day>" — once a day is plenty

export default function GuestHistoryClaim() {
  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let running = false;

    async function claim(userId: string, anonymous: boolean, force: boolean) {
      if (anonymous || running) return;
      const deviceScope = getUserScopeId();
      if (!deviceScope || deviceScope === userId) return;
      const mark = `${userId}|${deviceScope}|${new Date().toISOString().slice(0, 10)}`;
      try { if (!force && localStorage.getItem(DONE_KEY) === mark) return; } catch { /* private mode */ }
      running = true;
      try {
        const r = await fetch("/api/history/claim", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceScope }),
        });
        if (r.ok) { try { localStorage.setItem(DONE_KEY, mark); } catch { /* ignore */ } }
      } catch { /* never in the way — next load tries again */ }
      finally { running = false; }
    }

    void sb.auth.getUser().then(({ data }) => {
      if (data.user) void claim(data.user.id, !!data.user.is_anonymous, false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // A fresh sign-in always tries, even if this browser already moved things today.
      if (event === "SIGNED_IN" && session?.user) void claim(session.user.id, !!session.user.is_anonymous, true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
