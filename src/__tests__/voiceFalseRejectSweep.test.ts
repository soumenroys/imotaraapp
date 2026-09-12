import { describe, it, expect } from "vitest";
import { isLikelyHallucination } from "@/app/api/voice/transcribe/route";

// Things a person plausibly says to a wellbeing companion. Every one of these
// MUST survive — a false reject means someone spoke and the app pretended
// they had not.
const CORPUS = [
  // sound-adjacent vocabulary in real sentences
  "I have a terrible cough and I cannot sleep",
  "The coughing kept me up all night",
  "I could hear footsteps outside and I panicked",
  "There was so much static in my head today",
  "The applause made me feel seen for once",
  "My laughter felt fake today",
  "I let out a wheeze when I tried to run",
  "I keep hearing a buzzing sound and it makes me anxious",
  "Everything is humming and I cannot think",
  "The ticking of the clock is driving me mad",
  "I was clapping along and then I just cried",
  // bare one-word answers
  "silence", "music", "breathing", "noise", "wind", "rain",
  "yes", "no", "okay", "maybe", "sometimes", "nothing", "everything",
  "tired", "lonely", "scared", "angry", "fine", "numb", "better",
  // One word is often all someone can manage. None of these may ever be
  // mistaken for the content-free noise words above.
  "exhausted", "overwhelmed", "hurt", "lost", "empty", "afraid", "ashamed",
  "hopeful", "calm", "grateful", "stuck", "alone", "sad", "happy", "scared",
  "why", "how", "when", "who", "hmm", "oh", "ah", "um", "well",
  // parentheticals that are real speech
  "(I think so)",
  "He said (and I quote) that it was fine",
  "I told her (twice) that I needed space",
  "My therapist (who I like) said to try journaling",
  // Long parentheticals that happen to NAME a sound. Annotations are terse —
  // "(soft piano music)" — so the parenthetical rule caps the span at four
  // words. Without that cap these real sentences would be thrown away.
  "He said (and I quote, the music was too loud for me to think) that it was fine",
  "I told her (in the middle of all that noise and the wind outside) that I was done",
  "She asked (right as the rain started coming down hard) if I was alright",
  // multilingual
  "ami khub valo nei", "आज मन बहुत भारी लग रहा है", "মন খারাপ লাগছে",
  "நான் சோர்வாக இருக்கிறேன்", "ನನಗೆ ಒಂಟಿತನ ಅನಿಸುತ್ತಿದೆ", "എനിക്ക് ക്ഷീണം തോന്നുന്നു",
  "मला खूप त्रास होतोय", "હું ઉદાસ છું", "ਮੈਂ ਥੱਕ ਗਿਆ ਹਾਂ", "ମୋର ମନ ଖରାପ",
  "میں بہت پریشان ہوں", "నాకు బాధగా ఉంది",
  // short/quiet real utterances
  "I don't know", "I'm okay", "not really", "I guess", "it's hard",
  "I can't", "help me", "please", "thank you so much for listening",
  "It's hard. It's really hard.",
  "I feel stuck and I don't know what to do",
  "Okay, I will try that tomorrow",
  // punctuation-heavy but real
  "Why does it always... come back to this?",
  "I'm fine, really — I promise.",
  "Work, family, money... all of it at once.",
];

describe("no false rejects across a realistic corpus", () => {
  it.each(CORPUS)("keeps: %s", (t) => {
    expect(isLikelyHallucination(t)).toBe(false);
  });
});
