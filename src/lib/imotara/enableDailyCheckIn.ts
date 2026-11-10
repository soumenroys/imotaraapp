// src/lib/imotara/enableDailyCheckIn.ts
// Turn on the daily check-in push at a chosen hour — the same three steps the
// Settings page performs (permission → push subscription with the time zone →
// the hour on the profile), for the one-time invite card ⇒ checkInInviteStrings.
//
// ⛔ The browser's permission prompt is raised here and nowhere else in the
//    invite — and this only runs after the person taps a time.

import { guestChatToken } from "@/lib/imotara/guestChatIdentity";

export type EnableResult = { ok: true } | { ok: false; reason: "unsupported" | "permission" | "failed" };

/** Keep in step with settings/page.tsx — the Settings screen shows this value. */
const NOTIF_REMINDER_TIME_KEY = "imotara.notif.reminderTime.v1";

function timeZone(): string | undefined {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return tz && tz.trim() ? tz.trim() : undefined;
    } catch {
        return undefined;
    }
}

/**
 * ✅ ON again (25 Oct 2026) now that web push has its own table, push_reminders.
 * It was off while subscriptions lived in user_memory — whose live constraints
 * rejected every one (none was ever saved) and which the AI reads whole.
 * Kept as a switch: if push breaks again, false hides the invite at once.
 */
export const WEB_PUSH_READY = true;

/** Can this browser receive the check-in at all, and has the person not already said no to it? */
export function pushPossible(): boolean {
    if (!WEB_PUSH_READY) return false;
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    return Notification.permission !== "denied" && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

/** Already subscribed on this browser? Then there is nothing to invite them to. */
/**
 * #16 A: who the reminder belongs to. A signed-in person is identified by their
 * cookie (nothing to add). A guest is identified by their anonymous chat
 * identity ⇒ sent as a Bearer token, which /api/push/subscribe and
 * /api/profile/sync already accept. No identity ⇒ no header (the call then
 * fails as before — never a reminder saved against nobody).
 */
export async function reminderAuthHeaders(): Promise<Record<string, string>> {
    try {
        const token = await guestChatToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

export async function alreadySubscribed(): Promise<boolean> {
    try {
        const reg = await navigator.serviceWorker.ready;
        return Boolean(await reg.pushManager.getSubscription());
    } catch {
        return false;
    }
}

export async function enableDailyCheckIn(hour: number): Promise<EnableResult> {
    if (!pushPossible()) return { ok: false, reason: "unsupported" };
    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return { ok: false, reason: "permission" };
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription())
            ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
        const who = await reminderAuthHeaders();
        const res = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...who },
            body: JSON.stringify({ ...sub.toJSON(), timeZone: timeZone() }),
        });
        if (!res.ok) return { ok: false, reason: "failed" };
        // The hour lives on the profile — the push is a server cron that reads it.
        await fetch("/api/profile/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...who },
            body: JSON.stringify({ user: { reminderHour: hour } }),
        }).catch(() => {});
        try { localStorage.setItem(NOTIF_REMINDER_TIME_KEY, `${String(hour).padStart(2, "0")}:00`); } catch { /* private mode */ }
        return { ok: true };
    } catch {
        return { ok: false, reason: "failed" };
    }
}
