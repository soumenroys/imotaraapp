// src/__tests__/connect/languages.test.ts
// One list, checked against the one the backend validates against. Four
// hand-written copies existed before this; the shortest held 16 of 22, so six
// languages printed a raw code where a name belonged.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CONNECT_LANGUAGES, CONNECT_LANGUAGE_CODES, languageLabel } from "@/lib/connect/languages";

// Read the API's own list rather than restating it, so the two cannot drift.
const API_LANGS: string[] = (() => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/connect/consultant/profile/route.ts"), "utf8");
  const m = /const SUPPORTED_LANGS\s*=\s*\[([^\]]+)\]/.exec(src);
  if (!m) throw new Error("SUPPORTED_LANGS not found — did the API list move?");
  return [...m[1].matchAll(/"([a-z]{2})"/g)].map((x) => x[1]);
})();

describe("the UI list matches what the backend accepts", () => {
  it("covers every language the API allows", () => {
    expect(API_LANGS.filter((l) => !CONNECT_LANGUAGE_CODES.includes(l))).toEqual([]);
  });

  it("offers nothing the API would reject", () => {
    // A code here that the backend refuses is a filter returning nothing,
    // forever, with no error to explain it.
    expect(CONNECT_LANGUAGE_CODES.filter((l) => !API_LANGS.includes(l))).toEqual([]);
  });

  it("has 22, the number the product advertises", () => {
    expect(CONNECT_LANGUAGES).toHaveLength(22);
  });
});

describe("labels", () => {
  it("names every code", () => {
    for (const { code, label } of CONNECT_LANGUAGES) {
      expect(label.trim().length).toBeGreaterThan(0);
      expect(languageLabel(code)).toBe(label);
    }
  });

  it("has no duplicate codes or labels", () => {
    expect(new Set(CONNECT_LANGUAGE_CODES).size).toBe(CONNECT_LANGUAGES.length);
    expect(new Set(CONNECT_LANGUAGES.map((l) => l.label)).size).toBe(CONNECT_LANGUAGES.length);
  });

  it("names the six that ConsultantCard used to print as raw codes", () => {
    // or/he/ru/zh/ja/id were absent from that map until 2026-09-04.
    expect(["or", "he", "ru", "zh", "ja", "id"].map(languageLabel))
      .toEqual(["Odia", "Hebrew", "Russian", "Chinese", "Japanese", "Indonesian"]);
  });

  it("falls back visibly for an unknown code", () => {
    expect(languageLabel("xx")).toBe("XX");
  });
});
