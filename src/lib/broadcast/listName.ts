// src/lib/broadcast/listName.ts
// The default name offered when creating a recipient list.
//
// Format: "dd mmm yy hh nn" — 04 Sep 26 23 45.
//
// Month names are a fixed table rather than toLocaleString, because the name
// is stored and later read by whoever runs the platform. A machine set to a
// different locale would otherwise write "04 sept. 26 23 45" into the database
// and the lists would no longer sort or read consistently.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function defaultListName(now: Date = new Date()): string {
  return [
    pad(now.getDate()),
    MONTHS[now.getMonth()],
    pad(now.getFullYear() % 100),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join(" ");
}
