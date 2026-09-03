/**
 * src/__tests__/broadcast/csv.test.ts
 *
 * The audit CSV carries two fields nobody on our side wrote:
 *
 *   source_detail — free text an admin types
 *   error         — a bounce message written by a REMOTE MAIL SERVER
 *
 * Excel, Google Sheets and LibreOffice treat a cell starting =, +, - or @ as a
 * formula. A remote server that returns a bounce beginning with
 * =HYPERLINK(...) gets that executed when the compliance export is opened.
 * Escaping at export is the only place this can be caught — by then the value
 * is already stored.
 */

import { describe, it, expect } from "vitest";
import { cell, row, UTF8_BOM } from "@/lib/broadcast/csv";

describe("cell — RFC 4180 quoting", () => {
  it("wraps every value in quotes", () => {
    expect(cell("plain")).toBe('"plain"');
  });

  it("doubles embedded quotes rather than breaking the row", () => {
    expect(cell('say "hi"')).toBe('"say ""hi"""');
  });

  it("keeps commas and newlines inside the cell", () => {
    expect(cell("a,b")).toBe('"a,b"');
    expect(cell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null and undefined as empty, not as the words", () => {
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
    // The bug this prevents: a column of literal "null" strings in an audit file.
    expect(cell(null)).not.toContain("null");
  });
});

describe("cell — formula injection", () => {
  it.each([
    ['=HYPERLINK("http://evil","click")', "="],
    ["+1+1", "+"],
    ["-2+3", "-"],
    ["@SUM(A1:A9)", "@"],
  ])("neutralises a value starting %s", (payload) => {
    const out = cell(payload);
    // A leading quote makes the spreadsheet treat it as text.
    expect(out.startsWith(`"'`)).toBe(true);
    expect(out).toContain(payload.replace(/"/g, '""'));
  });

  it("neutralises a bounce message that begins with a formula character", () => {
    // Plausible shape for a remote server's SMTP reply landing in `error`.
    const bounce = '=cmd|\' /C calc\'!A0';
    expect(cell(bounce).startsWith(`"'`)).toBe(true);
  });

  it("leaves ordinary values alone — no stray quote on safe text", () => {
    expect(cell("hard bounce: 550 5.1.1")).toBe('"hard bounce: 550 5.1.1"');
    expect(cell("priya.n@childcare.org")).toBe('"priya.n@childcare.org"');
    // A minus INSIDE the value is fine; only a leading one is dangerous.
    expect(cell("well-formed")).toBe('"well-formed"');
  });
});

describe("row / BOM", () => {
  it("joins cells with commas", () => {
    expect(row(["a", "b,c", null])).toBe('"a","b,c",');
  });

  it("exports a UTF-8 BOM so Excel does not mangle Indic text", () => {
    expect(UTF8_BOM).toBe("﻿");
    // The reason it exists: this product's names are frequently non-Latin.
    expect(cell("সুচিস্মিতা")).toBe('"সুচিস্মিতা"');
  });
});
