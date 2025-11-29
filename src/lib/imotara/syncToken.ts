// src/lib/imotara/syncToken.ts

const KEY = "imotara.syncToken";

/**
 * Load the sync token stored on this device.
 * Always returns a string (may be empty).
 */
export function loadSyncToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(KEY) || "";
}

/**
 * Save a new sync token from the server.
 */
export function saveSyncToken(token: string) {
    if (typeof window === "undefined") return;
    if (!token) return;
    localStorage.setItem(KEY, token);
}

/**
 * Reset token when server requests a full resync.
 */
export function clearSyncToken() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY);
}
