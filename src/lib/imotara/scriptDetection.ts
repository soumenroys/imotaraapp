// src/lib/imotara/scriptDetection.ts
// Extracted from chat-reply/route.ts (P2-16) so it's testable — Next.js App
// Router route.ts files only permit a fixed set of exports (HTTP method
// handlers + a few config vars), so this couldn't live there as a plain
// exported helper.

/**
 * Returns true when the user's message is written in romanized/transliterated
 * script (Latin letters) for a non-Latin-native language (Indic, Cyrillic, RTL, CJK).
 * Used to inject a hard SCRIPT MIRROR instruction into the system prompt.
 */
export function isRomanizedInput(message: string, lang: string): boolean {
  const nativeScriptLangs = ["bn", "hi", "mr", "ta", "te", "gu", "kn", "ml", "pa", "or", "ur", "ru", "ar", "he", "zh", "ja"];
  if (!nativeScriptLangs.includes(lang)) return false;
  const latinCount = (message.match(/[a-zA-Z]/g) ?? []).length;
  const totalLetterCount = (message.match(/\p{L}/gu) ?? []).length;
  if (!(totalLetterCount > 3 && latinCount / totalLetterCount > 0.65)) return false;
  // Don't fire SCRIPT MIRROR on plain English. Three gates:
  // Gate 1: structural/grammatical English words (contractions, connectives, determiners)
  // that NEVER appear in romanized Indic/Semitic text.
  const englishStructural = /\b(I'm|I've|I'll|I'd|don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|the|because|although|however|therefore|everything|something|nothing|anything)\b/g;
  const englishHits = (message.match(englishStructural) ?? []).length;
  // Gate 2: high density of common English words that never appear in romanized Indic/Semitic.
  // Excludes borrowed words (feel, office, busy, school) that appear in Hinglish/Banglish.
  const commonEnglish = /\b(have|been|know|talk|about|anyone|lately|still|need|would|could|should|when|what|where|into|from|there|their|they|them|this|that|these|those|then|your|very|more|some|only|here|work|life|going|doing|trying|getting|being|having|making|taking|coming|thinking|looking|seeing|finding|wondering|feeling|lately|worried|understand|myself|yourself|sometimes|always|never|already|together|another|without|through|before|after|every|other|might|really|quite|which|while|again|cannot|though|maybe)\b/g;
  const commonEnglishHits = (message.match(commonEnglish) ?? []).length;
  // Gate 3: Indic/Semitic grammar markers that NEVER appear in plain English sentences
  const indicGrammar = /\b(hai|hain|hoon|hoga|hogi|tha|thi|raha|rahi|rahe|mein|toh|bhi|aur|nahi|nahin|ami|tumi|amar|tomar|ache|achhi|achhe|karo|bolo|kothay|kotha|jao|esho)\b/i;
  const hasIndicGrammar = indicGrammar.test(message);
  // Plain English: structural words OR common-word density — AND no Indic/Semitic grammar
  if (englishHits >= 2 && !hasIndicGrammar) return false;
  if (englishHits >= 1 && !hasIndicGrammar && /\b(I'm|don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't)\b/i.test(message)) return false;
  if (commonEnglishHits >= 3 && !hasIndicGrammar) return false;
  return true;
}
