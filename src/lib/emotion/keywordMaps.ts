// src/lib/emotion/keywordMaps.ts
// Centralized multilingual keyword regex used by local/heuristic emotion inference.
// NOTE: Keep these additive and conservative to avoid false positives.

import { escapeRegexLiteral } from "./regexUtils";

// --------------------------------------------------
// Language routing hints (NOT emotion)
// Keep conservative to avoid false positives.
// --------------------------------------------------

// Romanized Hindi (Latin script) hints
export const ROMAN_HI_LANG_HINT_REGEX =
  /\b(hai|haan|nahi|nahin|kya|kyun|kaise|kab|kahan|aaj|kal|bhai|yaar|mummy|papa|didi|jaldi|khana|bhook|ghar|party|Kaun|Achha|Thik|Main|Tum|Aap|Hum|Woh|Yeh|Sab|Kuch|Toh|Bhi|Hi|Na|Aur|Bas|Shayad|Jarur|Waisa|Aisa|Chal|Kar|Ho|Gaya|Raha|Chahiye|Sun|Bol|Bata|Milte|Abhi|Thoda|Zyada|Maza|Bahar|Maaf|Shukriya)\b/i;

// Romanized Bengali (Latin script) hints
export const ROMAN_BN_LANG_HINT_REGEX =
  /\b(Ki|Hae|hoe|Na|Kemon|Bhalo|Ki khobor|Achi|Ar|Ekhon|Pore|Korcho|Khai|Ghum|Jachhi|Aschi|Bolche|Dekha|Janina|Bujhlam|Sunte|Tumi|Apni|Tui|Amra|Ora|Bari|Baire|Office|College|Bondhu|Ke|Acha|Thik ache|Sotti|Tai|Keno|Kothay|Kobe|Kokhon|Ekdom|Hoyto|Osthir|Cholo|Boka|Pagol|Misti|Dhur|Ghumao|Kotha|Hobe|Bad dao|baad|ami|acho|accho|onekdin|chol|kothao|adda|gosip|gossip|joma|ache|khub|barite|ghor|mon|kharap|lagche)\b/i;

// Romanized Tamil (Latin script) hints
export const ROMAN_TA_LANG_HINT_REGEX =
  /\b(enna|epdi|eppadi|seri|sari|inga|anga|ipo|ippo|ennaachu|enna achu|saptiya|saaptiya|veetla|veetle|amma|appa|thambi|akka|anna|nan|naan|unaku|ungal|romba|konjam|nalla|illa|illai|podhum|paravailla|paravala|sollu|pesu|pesa|venum|vendam|paathu|paakalam|irukku|irukka|pogudhu|vandhuten|poiten)\b/i;

// Romanized Telugu (Latin script) hints
export const ROMAN_TE_LANG_HINT_REGEX =
  /\b(enti|ela|elaa|em|emi|ippudu|inka|avuna|kaadu|ledu|undhi|undi|unna|unnanu|nenu|nuvvu|meeru|miku|naaku|amma|nanna|anna|akka|tammudu|chelli|baaga|bagundi|chala|konchem|vellu|vastanu|vachanu|cheppu|matladu|tinava|tinnava|em ayindi|emindi|sare|parledu|enduku|ekkada|eppudu)\b/i;

// Tamil emotion hints (kept conservative)
export const TA_SAD_REGEX =
  /(romba kashtama irukku|kashtama irukku|manasu kashtama irukku|romba kastama irukku|kastama irukku|manasu kastama irukku|manasu sari illa|manasu seriya illa|romba sogama irukku|sogama irukku|azhuga varudhu|azhudha pola irukku|udalum manasum tired aa irukku)/i;

export const TA_STRESS_REGEX =
  /(romba pressure irukku|pressure aa irukku|romba tension aa irukku|tension aa irukku|romba stress aa irukku|stress aa irukku|bayama irukku|romba bayama irukku|manasu romba odudhu|thalaila neraya oditu irukku|thalaila romba load irukku)/i;

// English “clearly English” hints (for strict English turns)
export const EN_LANG_HINT_REGEX =
  /\b(what|when|where|how|the|please|thanks|thank|mom|dad|dinner|lunch|breakfast|tonight|today|tomorrow|coming|home|cook|cooked|cooking|special|birthday|And|To|It|Is|In|My|You|U|Me|I|Yeah|Yep|No|Nah|LOL|LMAO|OMG|Wow|Cool|Nice|Oh|Okay|OK|K|Wait|Actually|Literally|Now|Soon|Later|ASAP|BRB|AFK|On my way|OMW|Think|Know|Want|Doing|Going|Why|Thx|Pls|Sorry|Sry|Hey|Hi|Hello|Bye|Good|Gnite|Take care)\b/i;

export const BN_SAD_REGEX =
  /(মন খারাপ|খারাপ লাগছে|মন ভালো নেই|মনে ভালো নেই|ভালো নেই|ভাল নেই|ভালো লাগছে না|ভাল লাগছে না|দুঃখ|কষ্ট|কাঁদ|কান্না|একলা|একাকী|\bmon\s+bhalo\s+na\b|\b(kichu|kicu|kisu)\s+bhalo\s+lag(chh?e|che)\s+na\b|\bbhalo\s+lag(chh?e|che)\s+na\b|\bmood\s+off\b)/i;

// Bengali confusion / mental overload
export const BN_CONFUSED_REGEX =
  /বুঝতে পারছি না|বুঝতে পারছিনা|মাথা কাজ করছে না|মাথা কাজ করছ না/i;

export const HI_STRESS_REGEX = /(परेशान|तनाव|चिंता|घबराहट|बेचैन)/;

// Hindi confusion / mental overload
export const HI_CONFUSED_REGEX =
  /samajh nahi aa raha|samajh nahi aa rha|dimag kaam nahi kar raha|dimaag kaam nahi kar raha|समझ नहीं आ रहा|समझ नही आ रहा|दिमाग काम नहीं कर रहा|दिमाग काम नही कर रहा/i;

const CONFUSED_EN_TERMS = [
  "cannot focus",
  "can not focus",
  "can't focus",
  "cant focus",
  "can’t focus",
  "can't concentrate",
  "cant concentrate",
  "can’t concentrate",
  "can't think",
  "cant think",
  "can’t think",
  "scattered",
  "mind is all over",
  "all over the place",
  "not sure what to do",
  "unsure what to do",
  "don’t know what to do",
  "don't know what to do",
  "overthinking",
  "overthink",
  "over thinking",
  "brain fog",
  "brain feels foggy",
  "feeling foggy",
  "blanking out",
  "mind is blank",
  "keep blanking",
] as const;

export const CONFUSED_EN_REGEX = new RegExp(
  CONFUSED_EN_TERMS.map(escapeRegexLiteral).join("|"),
  "i",
);

// --------------------------------------------------
// DEV Helper (safe, no runtime impact)
// Allows quick manual testing of keyword matches
// --------------------------------------------------

export type DebugEmotion = "confused" | "stressed" | "sad";

export function debugDetectEmotion(text: string): DebugEmotion | null {
  if (!text) return null;

  const input = String(text);

  if (isConfusedText(input)) return "confused";

  if (HI_STRESS_REGEX.test(input) || TA_STRESS_REGEX.test(input)) return "stressed";
  if (BN_SAD_REGEX.test(input) || TA_SAD_REGEX.test(input)) return "sad";

  return null;
}

// --------------------------------------------------
// Shared helper (safe, no runtime impact unless used)
// Centralizes "confused" detection for reuse.
// --------------------------------------------------

export function isConfusedText(text: string): boolean {
  if (!text) return false;

  const input = String(text).trim().toLowerCase().replace(/\s+/g, " ");

  // Defensive: safe even if any regex ever becomes /g in future
  CONFUSED_EN_REGEX.lastIndex = 0;
  HI_CONFUSED_REGEX.lastIndex = 0;
  BN_CONFUSED_REGEX.lastIndex = 0;

  return (
    CONFUSED_EN_REGEX.test(input) ||
    HI_CONFUSED_REGEX.test(input) ||
    BN_CONFUSED_REGEX.test(input)
  );
}
