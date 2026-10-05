// src/__tests__/analyticsEmotion.test.ts
//
// The emotion label behind the EDU/NGO "mindset trend".
//
// Why this suite is strict: before 2026-10-05 the label was whatever a client
// chose to send, so 27 of 422 production chat replies carried one (6.4%) and a
// positive label was unreachable from text entirely. An NGO buys this chart to
// evidence that its people are doing better. A chart that cannot go up is
// useless; a chart that goes up when people are doing WORSE is harmful. These
// tests pin both failure modes.

import { describe, it, expect } from "vitest";
import {
  ANALYTICS_EMOTIONS,
  EMOTION_POLARITY,
  deriveAnalyticsEmotion,
  normaliseAnalyticsEmotion,
  averagePolarity,
  type AnalyticsEmotion,
} from "@/lib/emotion/analyticsEmotion";

describe("canonical vocabulary", () => {
  it("keeps the labels already present in the usage_events column", () => {
    // Observed in production 2026-10-05: sad, hopeful, stressed. If these ever
    // stop being canonical, every historical row silently becomes a separate
    // bar on the NGO's chart.
    for (const legacy of ["sad", "stressed", "hopeful"]) {
      expect(ANALYTICS_EMOTIONS).toContain(legacy);
      expect(normaliseAnalyticsEmotion(legacy)).toBe(legacy);
    }
  });

  it("gives every label a polarity, so the trend can be averaged", () => {
    for (const e of ANALYTICS_EMOTIONS) {
      expect(typeof EMOTION_POLARITY[e]).toBe("number");
      expect(EMOTION_POLARITY[e]).toBeGreaterThanOrEqual(-1);
      expect(EMOTION_POLARITY[e]).toBeLessThanOrEqual(1);
    }
  });

  it("contains at least three positive states — the chart must be able to go UP", () => {
    const positive = ANALYTICS_EMOTIONS.filter((e) => EMOTION_POLARITY[e] > 0);
    expect(positive.length).toBeGreaterThanOrEqual(3);
  });

  it("folds analyzeLocal's palette onto the canonical labels, never a 2nd bar", () => {
    expect(normaliseAnalyticsEmotion("sadness")).toBe("sad");
    expect(normaliseAnalyticsEmotion("anxiety")).toBe("anxious");
    expect(normaliseAnalyticsEmotion("gratitude")).toBe("grateful");
    expect(normaliseAnalyticsEmotion("fear")).toBe("afraid");
    expect(normaliseAnalyticsEmotion("anger")).toBe("angry");
  });

  it("treats the empty string as absent — it is what the old code wrote", () => {
    expect(normaliseAnalyticsEmotion("")).toBeNull();
    expect(normaliseAnalyticsEmotion("   ")).toBeNull();
    expect(normaliseAnalyticsEmotion(null)).toBeNull();
    expect(normaliseAnalyticsEmotion(undefined)).toBeNull();
  });

  it("returns null for an unknown label rather than inventing a category", () => {
    expect(normaliseAnalyticsEmotion("flabbergasted")).toBeNull();
  });
});

describe("every reply gets a label — the 6.4% sample is the bug", () => {
  it("never returns null/empty for ordinary text", () => {
    for (const msg of ["hello", "what is the weather", "ok", "tell me a story"]) {
      const got = deriveAnalyticsEmotion(msg);
      expect(ANALYTICS_EMOTIONS).toContain(got);
      expect(got).not.toBe("");
    }
  });

  it("labels an unremarkable message neutral, not nothing", () => {
    expect(deriveAnalyticsEmotion("ok thanks for the info about the timing")).not.toBeNull();
  });

  it("handles empty / whitespace input without throwing", () => {
    expect(deriveAnalyticsEmotion("")).toBe("neutral");
    expect(deriveAnalyticsEmotion("   ")).toBe("neutral");
    // @ts-expect-error — defensive: production data is not always a string
    expect(deriveAnalyticsEmotion(null)).toBe("neutral");
  });
});

describe("positive states are reachable from TEXT (they were not before)", () => {
  const cases: Array<[string, AnalyticsEmotion]> = [
    ["I feel so much better today",      "joy"],
    ["I am really happy right now",      "joy"],
    ["thank you so much, this means a lot", "grateful"],
    ["I feel hopeful about next week",   "hopeful"],
    ["things are getting better",        "hopeful"],
    ["I feel calm and relaxed now",      "calm"],
    ["I feel relieved",                  "calm"],
  ];
  it.each(cases)("%s → %s", (msg, expected) => {
    expect(deriveAnalyticsEmotion(msg)).toBe(expected);
  });

  it("detects positive states in Indic scripts, not only English", () => {
    expect(EMOTION_POLARITY[deriveAnalyticsEmotion("আমি আজ খুশি")]).toBeGreaterThan(0);   // bn: I am happy today
    expect(EMOTION_POLARITY[deriveAnalyticsEmotion("मुझे उम्मीद है")]).toBeGreaterThan(0); // hi: I have hope
  });
});

describe("🔴 negation — the trap that would make the chart lie optimistic", () => {
  // Each of these is built from a POSITIVE word but means the opposite. If any
  // of them scores > 0, an NGO would be told its people were improving at
  // exactly the moment they were doing worst.
  const negated = [
    "I am not happy",
    "I'm not happy at all",
    "there is no hope",
    "I don't feel better",
    "I am not calm",
    "nothing is getting better",
    "আমি ভালো নেই",      // bn: I am not well
    "मुझे कोई उम्मीद नहीं है", // hi: I have no hope
  ];
  it.each(negated)("%s is never scored positive", (msg) => {
    const got = deriveAnalyticsEmotion(msg);
    expect(EMOTION_POLARITY[got]).toBeLessThanOrEqual(0);
  });
});

describe("🔴 politeness is not gratitude", () => {
  // keywordMaps' GRATITUDE_REGEX matches bare "thanks" — how people end ANY
  // message. Scoring that +0.9 would inflate an NGO's positive trend on
  // manners alone, which is the over-reporting this module exists to prevent.
  const polite = [
    "thanks for the info about the timing",
    "thank you",
    "thanks!",
    "ok thanks",
  ];
  it.each(polite)("%s is not scored as gratitude", (msg) => {
    expect(deriveAnalyticsEmotion(msg)).not.toBe("grateful");
  });

  const realGratitude = [
    "I am so grateful for your help",
    "I feel really thankful today",
    "this means a lot to me",
  ];
  it.each(realGratitude)("%s IS gratitude", (msg) => {
    expect(deriveAnalyticsEmotion(msg)).toBe("grateful");
  });
});

describe("English distress is detected (isSadText covers 14 languages, not English)", () => {
  const cases: Array<[string, AnalyticsEmotion]> = [
    ["I was crying all night",        "sad"],
    // "lonely" is its own canonical label and is MORE specific than "sad" —
    // worth keeping distinct, since isolation is what an NGO often acts on.
    ["I feel so lonely",              "lonely"],
    ["I am completely overwhelmed",    "stressed"],
    ["I am burnt out",                "stressed"],
    ["I feel anxious about tomorrow", "anxious"],
    ["I am scared of what happens next", "afraid"],
    ["I am so frustrated with all of this", "angry"],
  ];
  it.each(cases)("%s → %s", (msg, expected) => {
    expect(deriveAnalyticsEmotion(msg)).toBe(expected);
  });

  it("does not read 'the server is down' as sadness", () => {
    expect(deriveAnalyticsEmotion("the server is down again")).not.toBe("sad");
  });

  it("does not read 'the box is empty' as sadness", () => {
    expect(deriveAnalyticsEmotion("the box is empty")).not.toBe("sad");
  });
});

describe("🔑 distress outranks positives in a mixed message", () => {
  // Deliberate ethical ordering: under-reporting improvement is honest,
  // over-reporting it is not.
  it("records distress when both appear", () => {
    const got = deriveAnalyticsEmotion("I was crying all night but I feel a little hopeful");
    expect(EMOTION_POLARITY[got]).toBeLessThan(0);
  });

  it("puts a crisis signal above everything else", () => {
    const got = deriveAnalyticsEmotion("I want to end my life");
    expect(got).toBe("hopeless");
    expect(EMOTION_POLARITY[got]).toBe(-1);
  });
});

describe("averagePolarity — the NGO trend line", () => {
  it("is null with nothing to average", () => {
    expect(averagePolarity([])).toBeNull();
    expect(averagePolarity([null, "", undefined])).toBeNull();
  });

  it("rises when the mix improves", () => {
    const before = averagePolarity(["sad", "sad", "stressed"])!;
    const after  = averagePolarity(["sad", "hopeful", "joy"])!;
    expect(after).toBeGreaterThan(before);
  });

  it("ignores unknown labels instead of skewing the line", () => {
    expect(averagePolarity(["joy", "flabbergasted"])).toBe(EMOTION_POLARITY.joy);
  });

  it("counts legacy and canonical spellings as the same feeling", () => {
    expect(averagePolarity(["sadness"])).toBe(averagePolarity(["sad"]));
  });
});
