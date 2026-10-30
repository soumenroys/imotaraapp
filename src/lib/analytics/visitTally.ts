// src/lib/analytics/visitTally.ts
//
// Anonymous visit tallies — do people come back, and how long do they stay —
// for everyone, guests included. ⇒ docs/sql/visit_tallies.sql for the design.
//
// 🔑 Owner, 31 Oct 2026: yes to "an anonymous count — no message text, no name,
// no account". What makes it anonymous is what the device SENDS: a kind, a
// bucket and +1/-1. No identifier exists anywhere in the flow, so no two rows
// can ever be joined into a person.
//
// Shared by the route (validation) and the web client (bucketing), so both
// sides agree on exactly the same buckets.

export const TALLY_KINDS = ["visit_age", "session_messages", "session_minutes"] as const;
export type TallyKind = (typeof TALLY_KINDS)[number];
export type TallyEvent = { kind: TallyKind; bucket: number; delta: 1 | -1 };

/** Days since first visit: 0–30 exact (day-1 / day-7 / day-30 return), then 31 = 31–90, 91 = 91+. */
export function ageBucket(days: number): number {
    const d = Math.max(0, Math.floor(days));
    return d <= 30 ? d : d <= 90 ? 31 : 91;
}

/** Messages sent in one visit: 0–5 exact, 6 = 6–10, 11 = 11+. */
export function messagesBucket(n: number): number {
    const m = Math.max(0, Math.floor(n));
    return m <= 5 ? m : m <= 10 ? 6 : 11;
}

/** Minutes in one visit: 0 = under 1, 1, 2, 3 = 3–5, 6 = 6–10, 11 = 11–20, 21 = 21+. */
export function minutesBucket(minutes: number): number {
    const m = Math.max(0, minutes);
    if (m < 1) return 0;
    if (m < 2) return 1;
    if (m < 3) return 2;
    if (m < 6) return 3;
    if (m < 11) return 6;
    if (m < 21) return 11;
    return 21;
}

const ALLOWED: Record<TallyKind, ReadonlySet<number>> = {
    visit_age: new Set([...Array.from({ length: 31 }, (_, i) => i), 31, 91]),
    session_messages: new Set([0, 1, 2, 3, 4, 5, 6, 11]),
    session_minutes: new Set([0, 1, 2, 3, 6, 11, 21]),
};

/** At most this many events in one request — a visit moving buckets sends 4. */
export const MAX_EVENTS = 4;

/**
 * The only shape the endpoint accepts. Anything else — an unknown kind, a
 * bucket that no device could produce, a delta other than ±1, an extra field —
 * is dropped, so the table can only ever hold what the design allows.
 */
export function parseTallyEvents(body: unknown): TallyEvent[] {
    const list = (body as { events?: unknown })?.events;
    if (!Array.isArray(list)) return [];
    const out: TallyEvent[] = [];
    for (const e of list.slice(0, MAX_EVENTS)) {
        const { kind, bucket, delta } = (e ?? {}) as Record<string, unknown>;
        if (typeof kind !== "string" || !(TALLY_KINDS as readonly string[]).includes(kind)) continue;
        if (typeof bucket !== "number" || !ALLOWED[kind as TallyKind].has(bucket)) continue;
        if (delta !== 1 && delta !== -1) continue;
        out.push({ kind: kind as TallyKind, bucket, delta });
    }
    return out;
}
