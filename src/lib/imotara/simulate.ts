import type { Analysis } from "./analyze";

const REFLECTION_TEMPLATES = {
  positive: [
    "I’m hearing some lightness in your words. What felt most energizing there?",
    "Sounds uplifting. Would you like to savor what went right for a moment?",
  ],
  neutral: [
    "Thanks for sharing. What part of this matters most to you right now?",
    "Noted. If you zoom in, where do you feel this most—in thoughts, body, or mood?",
  ],
  negative: [
    "That sounds heavy. Would it help to name one need that isn’t met here?",
    "I’m with you. What would a 1% kinder next step look like?",
  ],
};

export function generateReflection(a: Analysis): string {
  const bank = REFLECTION_TEMPLATES[a.sentiment] ?? REFLECTION_TEMPLATES.neutral;
  const pick = bank[Math.floor(Math.random() * bank.length)];
  return pick;
}
