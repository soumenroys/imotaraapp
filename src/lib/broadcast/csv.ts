// src/lib/broadcast/csv.ts
// CSV escaping for the broadcast audit export (BC-15).

/** Excel needs a BOM to read UTF-8; without it Indic names render as mojibake. */
export const UTF8_BOM = "﻿";

/**
 * RFC 4180 quoting, plus formula-injection defence.
 *
 * A cell beginning =, +, - or @ is treated as a formula by Excel, Google
 * Sheets and LibreOffice. Two fields in this export are attacker-influenced:
 * `source_detail` is free text an admin types, and `error` carries a bounce
 * message written by a REMOTE MAIL SERVER. A value like
 * =HYPERLINK("http://x","click") would execute when the audit file is opened.
 *
 * Prefixing a single quote neutralises it — the cell displays as typed and is
 * inert. Escaping at export is the only place this can be caught, because by
 * then the data is already stored.
 */
export function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function row(values: unknown[]): string {
  return values.map(cell).join(",");
}
