// src/lib/imotara/cloudBackup.ts
//
// 🔑 #94 (owner, 14 Nov 2026): cloud backup of chat history is OPT-IN.
//
// Until now every web message was copied to /api/history automatically, while
// the site, the call guides and the talks promised "history stays on your
// device; backup is off unless you turn it on". The owner chose to make the
// PRODUCT match the promise (not the other way round), free for every
// signed-in user, and to keep existing cloud copies as they are.
//
// ⛔ ONE question, asked in ONE place. Every caller that writes to or pulls
// from the cloud history store asks `isCloudBackupOn()` — the chat page's push
// and pull, the History page's seed and sync, and Settings' "Back up now".
// A second, local copy of this check is how the default drifts back to "on".
//
// ⚠️ Default is OFF, including for people who used the site before this
// change: an absent key means off. Deleting a cloud copy is NOT gated — taking
// data away from us is always allowed.

const KEY = "imotara.cloudBackup.v1";

/** True only when this browser's user has switched backup on. */
export function isCloudBackupOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

/** Switch backup on or off for this browser. Off removes the key entirely. */
export function setCloudBackupOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "on");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — backup simply stays off */
  }
}

export const CLOUD_BACKUP_STORAGE_KEY = KEY;
