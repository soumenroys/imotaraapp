// src/lib/analytics/visitTallyClient.ts
//
// The web half of the anonymous visit tally. ⇒ lib/analytics/visitTally.ts
//
// Everything that would identify a device stays IN THIS BROWSER: the day it
// first opened Imotara, and the current visit's start time and message count.
// Only a kind, a bucket and ±1 ever leave it.
//
// A visit ends after 30 minutes without activity. It is reported when the page
// is hidden; if the person comes back inside 30 minutes the visit carries on,
// and the next report moves its single +1 to the new bucket (−1 old, +1 new),
// so each visit is counted once at its final size.

import {
    ageBucket,
    messagesBucket,
    minutesBucket,
    type TallyEvent,
} from "@/lib/analytics/visitTally";

const KEY = "imotara.visitTally.v1";
const GAP_MS = 30 * 60_000;
const ENDPOINT = "/api/metrics/visit";

type Visit = { start: number; last: number; messages: number; sent: { m: number; t: number } | null };
type State = { firstDay?: string; lastReportedDay?: string; visit?: Visit };

/** The device's own calendar day — age is counted in the person's days, not UTC's. */
export function localDay(now: number): string {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromDay: string, toDay: string): number {
    return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

function load(): State {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as State; } catch { return {}; }
}
function save(s: State) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: nothing is kept, nothing is sent twice */ }
}

function send(events: TallyEvent[]) {
    if (events.length === 0) return;
    const body = JSON.stringify({ events });
    try {
        if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    } catch { /* fall through */ }
    void fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

/** The ±1 events that bring this visit's reported buckets up to date. Pure — tested. */
export function visitEvents(v: Visit, end: number): { events: TallyEvent[]; sent: { m: number; t: number } } {
    const m = messagesBucket(v.messages);
    const t = minutesBucket((end - v.start) / 60_000);
    const events: TallyEvent[] = [];
    if (v.sent?.m !== m) {
        if (v.sent) events.push({ kind: "session_messages", bucket: v.sent.m, delta: -1 });
        events.push({ kind: "session_messages", bucket: m, delta: 1 });
    }
    if (v.sent?.t !== t) {
        if (v.sent) events.push({ kind: "session_minutes", bucket: v.sent.t, delta: -1 });
        events.push({ kind: "session_minutes", bucket: t, delta: 1 });
    }
    return { events, sent: { m, t } };
}

/** Start a new visit if the old one has lapsed; report a lapsed visit that was never reported. */
function touch(s: State, now: number): Visit {
    const v = s.visit;
    if (v && now - v.last <= GAP_MS) {
        v.last = now;
        return v;
    }
    if (v && !v.sent) send(visitEvents(v, v.last).events);
    s.visit = { start: now, last: now, messages: 0, sent: null };
    return s.visit;
}

/** On every page load: once per day, report "day N since first visit". */
export function noteVisit(now = Date.now()) {
    const s = load();
    const today = localDay(now);
    if (!s.firstDay) s.firstDay = today;
    if (s.lastReportedDay !== today) {
        send([{ kind: "visit_age", bucket: ageBucket(daysBetween(s.firstDay, today)), delta: 1 }]);
        s.lastReportedDay = today;
    }
    touch(s, now);
    save(s);
}

/** Each message the person sends. */
export function noteMessageSent(now = Date.now()) {
    const s = load();
    touch(s, now).messages += 1;
    save(s);
}

/** When the page is hidden: report (or correct) this visit's size. */
export function reportVisit(now = Date.now()) {
    const s = load();
    const v = s.visit;
    if (!v || now - v.last > GAP_MS) return;
    v.last = now;
    const { events, sent } = visitEvents(v, now);
    send(events);
    v.sent = sent;
    save(s);
}
