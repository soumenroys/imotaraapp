import { EMOTION_LEXICON, TONE_LEXICON, POSITIVE_MARKERS, NEGATIVE_MARKERS } from "./lexicon";

export type EmotionKey = keyof typeof EMOTION_LEXICON;
export type ToneKey = keyof typeof TONE_LEXICON;

export type Analysis = {
  sentiment: "positive" | "neutral" | "negative";
  emotions: EmotionKey[];
  tones: ToneKey[];
  confidence: number; // 0..1
};

const normalize = (s: string) => s.toLowerCase().trim();

function scoreMatches(text: string, bag: string[]): number {
  let score = 0;
  for (const token of bag) {
    if (text.includes(token)) score += 1;
  }
  return score;
}

export function analyzeMessage(raw: string): Analysis {
  const text = normalize(raw);

  const emotions: EmotionKey[] = [];
  let emoHits = 0;
  (Object.keys(EMOTION_LEXICON) as EmotionKey[]).forEach((k) => {
    const hits = scoreMatches(text, EMOTION_LEXICON[k]);
    if (hits > 0) {
      emotions.push(k);
      emoHits += hits;
    }
  });

  const tones: ToneKey[] = [];
  let toneHits = 0;
  (Object.keys(TONE_LEXICON) as ToneKey[]).forEach((k) => {
    const hits = scoreMatches(text, TONE_LEXICON[k]);
    if (hits > 0) {
      tones.push(k);
      toneHits += hits;
    }
  });

  const pos = scoreMatches(text, POSITIVE_MARKERS);
  const neg = scoreMatches(text, NEGATIVE_MARKERS);
  let sentiment: Analysis["sentiment"] = "neutral";
  if (pos > neg) sentiment = "positive";
  else if (neg > pos) sentiment = "negative";

  const lengthBonus = Math.min(raw.length / 140, 1);
  const signal = Math.min((emoHits + toneHits + pos + neg) / 8, 1);
  const confidence = Math.max(0.2, Math.min(0.95, 0.4 * lengthBonus + 0.6 * signal));

  return { sentiment, emotions, tones, confidence };
}
