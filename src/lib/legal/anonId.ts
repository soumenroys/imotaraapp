// src/lib/legal/anonId.ts
//
// A stable per-device identifier for people who are not signed in.
//
// ⛔ NOT an authentication token and never treated as one. Its only job is to
// let an acceptance record, or a crisis event, be attributed to *somebody*
// rather than to nobody — because the person who never signs in is exactly the
// one an incident is most likely to involve.
//
// Random, opaque, and carries nothing about the person.

const ANON_ID_KEY = "imotara.anonId.v1";

function randomId(): string {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        }
    } catch {
        // fall through
    }
    // Last resort. Weaker, but a weak id beats an unattributable record.
    return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Returns this device's anon id, creating one on first call.
 *
 * Returns null when storage is unavailable rather than inventing a fresh id per
 * call — a different id each time would scatter one person's records across
 * many rows and be worse than none.
 */
export function getOrCreateAnonId(): string | null {
    try {
        const existing = window.localStorage.getItem(ANON_ID_KEY);
        if (existing && existing.length >= 8) return existing;
        const created = randomId();
        window.localStorage.setItem(ANON_ID_KEY, created);
        return created;
    } catch {
        return null;
    }
}
