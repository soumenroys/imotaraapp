// src/lib/imotara/enableDailyCheckIn.ts
// Turn on the daily check-in push at a chosen hour — the same three steps the
// Settings page performs (permission → push subscription with the time zone →
// the hour on the profile), for the one-time invite card ⇒ checkInInviteStrings.
//
// ⛔ The browser's permission prompt is raised here and nowhere else in the
//    invite — and this only runs after the person taps a time.

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

/** Can this browser receive the check-in at all, and has the person not already said no to it? */
export function pushPossible(): boolean {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    return Notification.permission !== "denied" && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

/** Already subscribed on this browser? Then there is nothing to invite them to. */
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
        const res = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...sub.toJSON(), timeZone: timeZone() }),
        });
        if (!res.ok) return { ok: false, reason: "failed" };
        // The hour lives on the profile — the push is a server cron that reads it.
        await fetch("/api/profile/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user: { reminderHour: hour } }),
        }).catch(() => {});
        try { localStorage.setItem(NOTIF_REMINDER_TIME_KEY, `${String(hour).padStart(2, "0")}:00`); } catch { /* private mode */ }
        return { ok: true };
    } catch {
        return { ok: false, reason: "failed" };
    }
}
