// #44 (27 Nov 2026): reply-language detection for Japanese, Roman Urdu and Arabizi.
//  · Japanese with kanji was sent to the reply model as CHINESE (Chinese checked before kana).
//  · Roman Urdu was always Hindi; Arabizi was always English.
// The other 20 languages must come out exactly as before.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { detectLangFromRomanHints, detectRomanUrduOrArabizi } from "@/lib/imotara/respondRemote";

// detectLangFromMessage is module-private; this mirrors its two steps exactly and the
// source pin below keeps the mirror honest.
const SRC = fs.readFileSync(path.join(process.cwd(), "src/lib/imotara/respondRemote.ts"), "utf8");
function latinReplyLang(text: string): string {
  const roman = detectLangFromRomanHints(text);
  return detectRomanUrduOrArabizi(text, roman) ?? roman;
}

describe("Japanese is not read as Chinese", () => {
  it("kana is checked before kanji (respondRemote + the /api/respond fallback)", () => {
    const fn = SRC.slice(SRC.indexOf("function detectLangFromScript"), SRC.indexOf("export function detectLangFromRomanHints"));
    expect(fn.indexOf('return "ja"')).toBeGreaterThan(-1);
    expect(fn.indexOf('return "ja"')).toBeLessThan(fn.indexOf('return "zh"'));
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/respond/route.ts"), "utf8");
    expect(route).toMatch(/: hasJapanese\s*\?\s*"ja"\s*: hasCJK\s*\?\s*"zh"/);
  });
  it("detectLangFromMessage still runs script first, then roman hints, then ur/ar", () => {
    expect(SRC).toMatch(/function detectLangFromMessage\(text: string\): string \{\s*const scriptLang = detectLangFromScript\(text\);\s*if \(scriptLang !== "en"\) return scriptLang;\s*const roman = detectLangFromRomanHints\(text\);\s*return detectRomanUrduOrArabizi\(text, roman\) \?\? roman;/);
  });
});

describe("Roman Urdu", () => {
  it.each([
    "mujhe bohat dukh hai yaar",
    "ammi se baat hui, dil udaas hai",
    "kyunke main thak gaya hoon, kuch samajh nahi aa raha",
    "inshallah sab theek hoga, abhi bohot pareshan hoon",
  ])("%s ⇒ ur", (t) => expect(latinReplyLang(t)).toBe("ur"));

  it.each([
    ["mujhe bahut dard hai", "hi"],
    ["aaj office mein bahut kaam tha yaar", "hi"],
    ["Inshallah it will be fine tomorrow", "en"],
    ["My mom made biryani today, mashallah it was great", "en"],
  ])("%s ⇒ %s (unchanged)", (t, want) => expect(latinReplyLang(t)).toBe(want));
});

describe("Arabizi", () => {
  it.each([
    "ana ta3ban kteer",
    "ya3ni msh 3arif eh el moshkela",
    "habibi ana za3lan awi",
    "wallah ana mabsoot",
  ])("%s ⇒ ar", (t) => expect(latinReplyLang(t)).toBe("ar"));

  it.each([
    "I'm 3 years into my job and tired",
    "web3 and b2b sales are stressful",
    "Ana is my best friend",
    "yalla let's go, I am so tired today",
    "I feel really low today",
  ])("%s ⇒ en (unchanged)", (t) => expect(latinReplyLang(t)).toBe("en"));
});

describe("the other languages in Latin letters are unchanged", () => {
  it.each([
    ["ami khub klanto, kichu bhalo lagche na", "bn"],
    ["enakku romba kashtama irukku", "ta"],
    ["nenu chala badha ga unnanu", "te"],
    ["mane kai saru nathi lagtu", "gu"],
    ["mala khup tras hotoy", "mr"],
  ])("%s ⇒ %s", (t, want) => {
    expect(detectRomanUrduOrArabizi(t, detectLangFromRomanHints(t))).toBeNull();
    expect(latinReplyLang(t)).toBe(detectLangFromRomanHints(t));
    expect(latinReplyLang(t)).toBe(want);
  });

  it("non-Latin text is never relabelled", () => {
    for (const t of ["আমি ক্লান্ত", "मैं थका हूँ", "今日は疲れた", "我很累", "أنا تعبان"]) {
      expect(detectRomanUrduOrArabizi(t, "en")).toBeNull();
    }
  });
});
