/**
 * #48 (27 Nov 2026): Spanish, French, German, Portuguese and Indonesian share the Latin
 * script, so a visitor who never chose a language got the crisis card in ENGLISH
 * ("ya no quiero vivir" → English). Now detectLatinLang (cautious) and then the browser's
 * language decide — but someone clearly WRITING English keeps English. Twin of the app's test.
 */
import { describe, it, expect } from "vitest";
import { crisisBannerLangFor } from "@/app/chat/page";
import { CRISIS_BANNER_BY_LANG } from "@/lib/safety/crisisCopy";
import { detectLatinLang, looksEnglish } from "@/lib/lang/latinLang";
const has = (l: string) => Boolean((CRISIS_BANNER_BY_LANG as Record<string, unknown>)[l]);
const pick = (pref: string | null, text: string, device: string | null = null) => crisisBannerLangFor(pref, [text], has, device);

const LATIN: Array<[string, string]> = [
    ["es", "ya no quiero vivir"],
    ["es", "estoy pensando en suicidarme"],
    ["es", "quiero quitarme la vida"],
    ["fr", "je ne veux plus vivre"],
    ["fr", "je pense au suicide"],
    ["fr", "j'ai envie de me tuer"],
    ["de", "ich will nicht mehr leben"],
    ["de", "ich denke an Selbstmord"],
    ["de", "ich will mich umbringen"],
    ["pt", "não quero mais viver"],
    ["pt", "estou pensando em me matar"],
    ["pt", "quero tirar minha vida"],
    ["id", "aku tidak ingin hidup lagi"],
    ["id", "aku ingin bunuh diri"],
    ["es", "quiero morir"],
    ["fr", "je veux mourir"],
    ["de", "ich will sterben"],
    ["pt", "quero morrer"],
    ["id", "saya ingin mati"],
];
const ENGLISH: string[] = ["I don't want to live anymore", "I'm going to kill myself", "thinking about ending my life", "everyone would be better off without me", "I cut myself again tonight", "I want to die"];

describe("the crisis card speaks Spanish, French, German, Portuguese and Indonesian", () => {
  it.each(LATIN)("[%s] %s", (lang, p) => {
    expect(pick(null, p)).toBe(lang);
    expect(pick("auto", p, "en-US")).toBe(lang);
  });
});

describe("⛔ English stays English", () => {
  it.each(ENGLISH)("%s — even on a Hindi or Spanish browser", (p) => {
    expect(detectLatinLang(p)).toBeNull();
    expect(looksEnglish(p) || pick(null, p) === "en").toBe(true);
    expect(pick(null, p, "hi-IN")).toBe("en");
    expect(pick(null, p, "es-ES")).toBe("en");
  });
});

describe("when the text cannot tell, the browser's language decides", () => {
  it("an unclear message on a Spanish browser ⇒ Spanish; with no browser language ⇒ English", () => {
    expect(pick(null, "ok", "es-ES")).toBe("es");
    expect(pick(null, "ok", null)).toBe("en");
    expect(pick(null, "ok", "xx")).toBe("en");
  });
  it("a stated choice still wins over everything", () => {
    expect(pick("hi", "ya no quiero vivir", "es-ES")).toBe("hi");
  });
  it("script languages are unchanged", () => {
    expect(pick(null, "আমি মরতে চাই", "es-ES")).toBe("bn");
    expect(pick(null, "死にたい", "de-DE")).toBe("ja");
  });
});
