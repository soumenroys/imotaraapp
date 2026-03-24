/**
 * tests/imotara-ai/types.ts
 * Shared types for the Imotara AI reply test suite.
 */

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * inputModality — how the user typed their message:
 *   "native"    — native script (e.g. বাংলা, देवनागरी)
 *   "romanized" — Latin-script transliteration (e.g. "ami valo achi")
 *   "mixed"     — mix of native/romanized + English in same message
 *
 * platform — which client is simulated:
 *   "web"    — sends lang directly from user preference (default)
 *   "mobile" — lang is derived from script/romanized detection, tone from relationship mapping
 */
export type InputModality = "native" | "romanized" | "mixed";
export type Platform = "web" | "mobile";

export type TestConfig = {
  tone?: "close_friend" | "calm_companion" | "coach" | "mentor";
  lang?: string;
  userAge?: string;
  companionAge?: string;
  userGender?: "female" | "male" | "nonbinary" | "prefer_not" | "other";
  companionGender?: "female" | "male" | "nonbinary" | "prefer_not" | "other";
  emotion?: string;
  emotionMemory?: string;

  // New fields
  inputModality?: InputModality;   // default: "native"
  platform?: Platform;             // default: "web"

  // Mobile-specific: when platform="mobile", runner derives lang from message content
  // These mirror mobile's toneContext shape for deriveToneForChatReply()
  mobileRelationship?: "friend" | "sibling" | "junior_buddy" | "partner_like" | "coach" | "mentor" | "elder" | "parent_like";
  mobilePreferredLang?: string;    // fallback lang when script detection fails
};

export type EvalCriteria = {
  id: string;
  description: string;
  // What a PASS looks like
  passCondition: string;
  // What a FAIL looks like (the "expected outcome" when failing)
  failExpectedOutcome: string;
};

export type TestScenario = {
  id: string;
  category: string;
  name: string;
  description: string;
  // The full conversation to send (last message is the one being tested)
  messages: ChatMessage[];
  config: TestConfig;
  criteria: EvalCriteria;
};

export type JudgeResult = {
  scenarioId: string;
  scenarioName: string;
  category: string;
  pass: boolean;
  score: number; // 0–10
  reason: string;
  actualReply: string;
  expectedOutcome: string;
  latencyMs: number;
  platform?: Platform;
  inputModality?: InputModality;
};

export type TestReport = {
  totalTests: number;
  passed: number;
  failed: number;
  results: JudgeResult[];
  runAt: string;
  lang: string;
  platform?: Platform;
};
