// src/lib/broadcast/listName.ts
// The default name offered when creating a recipient list.
//
// Format: "yyyymmddhhnn (dd mmm yy hh nn)" — 202609042345 (04 Sep 26 23 45).
//
// The numeric part leads so that sorting the lists by name sorts them by when
// they were made; the part in brackets is there because nobody reads a twelve
// digit number at a glance.
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
  const yyyy = String(now.getFullYear());
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const nn = pad(now.getMinutes());

  const sortable = `${yyyy}${mm}${dd}${hh}${nn}`;
  const readable = `${dd} ${MONTHS[now.getMonth()]} ${pad(now.getFullYear() % 100)} ${hh} ${nn}`;

  return `${sortable} (${readable})`;
}
