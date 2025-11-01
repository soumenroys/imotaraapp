export const EMOTION_LEXICON: Record<string, Array<string>> = {
  joy: ["happy", "glad", "grateful", "great", "awesome", "love", "excited", "yay", "😊", "😁", "🎉"],
  sadness: ["sad", "down", "unhappy", "depressed", "lonely", "broken", "cry", "😢", "😭"],
  anger: ["angry", "annoyed", "furious", "mad", "hate", "rage", "irritated", "🤬"],
  fear: ["scared", "afraid", "anxious", "worried", "panic", "nervous", "😨", "😰"],
  surprise: ["surprised", "shocked", "wow", "unexpected", "can't believe", "😮"],
  disgust: ["disgusted", "gross", "ew", "nasty", "🤢"],
};

export const TONE_LEXICON: Record<string, Array<string>> = {
  supportive: ["thanks", "thank you", "appreciate", "grateful", "🙏"],
  curious: ["why", "how", "what if", "could", "?", "curious"],
  frustrated: ["tired", "fed up", "frustrated", "broken", "stuck", "ugh"],
  reflective: ["i think", "i feel", "maybe", "perhaps", "i wonder"],
  celebratory: ["yay", "woo", "hurray", "congrats", "🎉", "party"],
};

export const POSITIVE_MARKERS = ["great", "good", "love", "like", "awesome", "😊", "🎉", "😁"];
export const NEGATIVE_MARKERS = ["bad", "hate", "terrible", "awful", "sad", "😢", "😭", "🤬"];
