/**
 * tests/imotara-ai/coherence-audit.ts
 *
 * Turn-by-turn coherence audit for a single long conversation.
 * Unlike the main runner (which only evaluates the final reply), this script:
 *   1. Sends each user message to the live Imotara API in sequence
 *   2. Captures Imotara's actual live reply at each turn
 *   3. Feeds those real replies back as history for subsequent turns
 *   4. Evaluates each reply for contextual coherence using GPT-4o-mini
 *
 * Usage:
 *   npx tsx tests/imotara-ai/coherence-audit.ts              # English
 *   AUDIT_LANG=bn npx tsx tests/imotara-ai/coherence-audit.ts # Bengali
 *   AUDIT_LANG=hi npx tsx tests/imotara-ai/coherence-audit.ts # Hindi
 */

import fs from "fs";
import path from "path";

// ─── Load OPENAI_API_KEY from .env.local if not set ─────────────────────────
if (!process.env.OPENAI_API_KEY) {
  const envFile = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf-8").split("\n");
    for (const line of lines) {
      const m = line.match(/^OPENAI_API_KEY=(.+)$/);
      if (m) { process.env.OPENAI_API_KEY = m[1].trim().replace(/^[\"']|[\"']$/g, ""); break; }
    }
  }
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/chat-reply`;
const AUDIT_LANG = (process.env.AUDIT_LANG ?? "en").toLowerCase();

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", blue: "\x1b[34m",
};

// ─── Per-language conversation scripts ───────────────────────────────────────
// Same scenario across all languages: job loss → financial pressure → telling wife
// Specific facts planted early (6 years, house, baby) that should resurface naturally later.
// Arc: shock → self-blame → guilt about wife → courage → resolution

type LangConfig = {
  label: string;
  topic: string;
  userMessages: string[];
};

const LANG_CONFIGS: Record<string, LangConfig> = {
  en: {
    label: "ENGLISH",
    topic: "Job loss, financial pressure, telling wife",
    userMessages: [
      "i just got laid off today. feeling completely lost right now",
      "yeah i was with the company for 6 years. didn't see it coming at all",
      "the worst part is my wife doesn't know yet. we just bought a house two months ago",
      "we have a baby due in march too. the timing couldn't be worse",
      "i keep replaying my last review in my head. they said i was doing great",
      "i think i've been avoiding telling her because i feel like i failed her",
      "she's always been so supportive through everything. i don't want to disappoint her",
      "do you think i should just tell her tonight?",
      "you're right. i guess i'm more scared of her reaction than i should be",
      "ok i'm going to tell her. what would you say if you were me?",
      "that actually helps. i feel a bit steadier now",
      "i told her. she was amazing about it. just hugged me and said we'll figure it out together",
    ],
  },

  bn: {
    label: "BENGALI",
    topic: "চাকরি হারানো, আর্থিক চাপ, বউকে বলা",
    userMessages: [
      "আজকে চাকরি চলে গেছে। একদম হারিয়ে গেছি মনে হচ্ছে",
      "হ্যাঁ, ৬ বছর ছিলাম ওই কোম্পানিতে। এত হঠাৎ হবে ভাবিনি",
      "সবচেয়ে কষ্টের হলো বউকে এখনো বলিনি। মাত্র দুই মাস আগে বাড়ি কিনেছি",
      "মার্চে বাচ্চাও আসছে। এত খারাপ সময়ে এমন হলো",
      "বারবার মাথায় ঘুরছে শেষ রিভিউটা। বলেছিল খুব ভালো করছি",
      "মনে হচ্ছে বউকে বলতে পারছি না কারণ মনে হচ্ছে তাকে ব্যর্থ করেছি",
      "ও সবসময় অনেক সাপোর্ট করে। হতাশ করতে চাই না ওকে",
      "আজ রাতেই বলে দেব?",
      "ঠিকই বলেছ। ওর রিঅ্যাকশন নিয়ে বোধহয় বেশি ভাবছি",
      "ঠিক আছে বলব। তুমি হলে কী বলতে?",
      "এটা শুনে একটু ভালো লাগছে। একটু স্থির মনে হচ্ছে এখন",
      "বললাম ওকে। ও দারুণ ছিল। জড়িয়ে ধরে বলল একসাথে সামলে নেব",
    ],
  },

  "bn-roman": {
    label: "ROMANIZED BENGALI (Banglish)",
    topic: "Chakri hariye jaoa, arthik chap, bouke bola",
    userMessages: [
      "aaj chakri chale gechhe. ekdom hariye gechhi mone hocchhe",
      "ha, 6 bochor chhilam oi company te. eto hothat hobe bhavini",
      "sobcheye koshter holo bouke ekhono bolini. matro dui maas age bari kinechhi",
      "marche baccha ashchhe. eto kharap somoy e emon holo",
      "baar baar mathay ghurchhe shesh review ta. bolechhilo khub bhalo korchhi",
      "mone hocchhe bouke bolte parchhi na karon mone hocchhe take byartho korechhi",
      "o shomoyo onek support kore. hotash korte chai na oke",
      "aaj rate i bole debo?",
      "thikoi boleche. or reaction niye bodhhoy beshi vabchhi",
      "thik ache bolbo. tumi hole ki bolte?",
      "eta shune ektu bhalo lagchhe. ektu sthir mone hocchhe ekhon",
      "bollam oke. o darun chhilo. joriye dhore bollo ekshaathe sambhale nebo",
    ],
  },

  "hi-roman": {
    label: "ROMANIZED HINDI (Hinglish)",
    topic: "Naukri jana, paisa ka dabav, patni ko batana",
    userMessages: [
      "aaj naukri chali gayi. bilkul khoya hua sa feel ho raha hai",
      "haan, 6 saal se tha us company mein. itni jaldi hoga socha nahi tha",
      "sabse bura ye hai ki patni ko abhi nahi bataya. do mahine pehle hi ghar kharida hai",
      "march mein baccha bhi aane wala hai. isse bura waqt nahi ho sakta tha",
      "baar baar aakhri review yaad aa raha hai. bola tha bahut achha kar rahe ho",
      "mujhe lagta hai patni ko isliye nahi bata pa raha kyunki lagta hai use fail kar diya",
      "wo hamesha bahut support karti hai. use nirash nahi karna chahta",
      "kya aaj raat bata doon?",
      "sahi keh rahe ho. shayad uski reaction ko lekar zyada soch raha hoon",
      "theek hai bataunga. tum hote toh kya kehte?",
      "yeh sunkar thoda achha laga. thoda stable feel ho raha hai",
      "bata diya use. wo bahut achhi rahi. gale lagaya aur bola saath milkar handle karenge",
    ],
  },

  hi: {
    label: "HINDI",
    topic: "नौकरी जाना, आर्थिक दबाव, पत्नी को बताना",
    userMessages: [
      "आज नौकरी चली गई। बिल्कुल खोया हुआ सा महसूस हो रहा है",
      "हाँ, 6 साल से था उस कंपनी में। इतनी जल्दी होगा नहीं सोचा था",
      "सबसे बुरा ये है कि पत्नी को अभी नहीं बताया। दो महीने पहले ही घर खरीदा है",
      "मार्च में बच्चा भी आने वाला है। इससे बुरा वक्त नहीं हो सकता था",
      "बार-बार आखिरी review याद आ रहा है। बोला था बहुत अच्छा कर रहे हो",
      "मुझे लगता है पत्नी को इसलिए नहीं बता पा रहा क्योंकि लगता है उसे fail कर दिया",
      "वो हमेशा बहुत support करती है। उसे निराश नहीं करना चाहता",
      "क्या आज रात बता दूँ?",
      "सही कह रहे हो। शायद उसकी reaction को लेकर ज़्यादा सोच रहा हूँ",
      "ठीक है बताऊँगा। तुम होते तो क्या कहते?",
      "यह सुनकर थोड़ा अच्छा लगा। थोड़ा stable feel हो रहा है",
      "बता दिया उसे। वो बहुत अच्छी रही। गले लगाया और बोला साथ मिलकर handle करेंगे",
    ],
  },
};

// Turn checks are language-agnostic — GPT-4o-mini evaluates the reply's intent
// regardless of which language it's in
const TURN_CHECKS = [
  "Validates the shock and loss without being generic. Sets a warm, present tone.",
  "Acknowledges the 6 years specifically — shows it registered. Not a generic 'that's tough'.",
  "Connects the house purchase to the financial weight. Shows the context landed.",
  "References BOTH the house (turn 3) AND the baby (this turn) together as compounding stressors.",
  "Responds to the cognitive loop / self-blame without dismissing it. Should NOT re-mention house or baby — those are already acknowledged.",
  "Addresses the specific guilt about 'failing her' — not just generic encouragement. Should feel personal.",
  "Acknowledges the wife's supportiveness (consistent with what user said). Should not repeat turn 6's 'failing her' line.",
  "Gives a clear, warm opinion about telling her tonight — not wishy-washy. Should reference earlier context (house, baby, 6 years).",
  "Validates the shift in thinking. Brief — user is moving toward action, reply should not re-open heavy processing.",
  "Gives genuinely useful, specific language the user could use — tailored to THIS situation, not generic advice.",
  "Warm acknowledgment of the shift without being effusive. Natural continuation, not a reset.",
  "Celebrates the resolution warmly. References the wife's specific words/gesture. Feels like a genuine ending.",
];

type Message = { role: "user" | "assistant"; content: string };

// ─── Call Imotara API ────────────────────────────────────────────────────────
async function callImotara(messages: Message[], lang: string): Promise<{ reply: string; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      tone: "close_friend",
      lang,
      userAge: "adult",
      companionAge: "adult",
      allowMemory: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { text?: string; message?: string };
  const reply = data.text ?? data.message ?? "";
  return { reply, latencyMs: Date.now() - start };
}

// ─── Judge turn coherence ────────────────────────────────────────────────────
type CoherenceResult = { score: number; reason: string; issues: string[] };

async function judgeCoherence(
  turnIndex: number,
  fullHistory: Message[],
  imotaraReply: string,
  turnCheck: string,
  lang: string,
): Promise<CoherenceResult> {
  const historyText = fullHistory
    .map((m, i) => `[Turn ${Math.floor(i / 2) + 1} — ${m.role === "user" ? "User" : "Imotara"}]: ${m.content}`)
    .join("\n");

  const langNote = lang !== "en"
    ? `The conversation is in ${lang === "bn" ? "Bengali" : lang === "hi" ? "Hindi" : lang}. Evaluate based on the intent and quality of the reply — you can understand both the conversation and the reply.`
    : "";

  const prompt = `You are evaluating the quality and coherence of an AI companion's reply in a long emotional conversation.
${langNote}

=== FULL CONVERSATION SO FAR ===
${historyText}
[Turn ${turnIndex + 1} — Imotara]: ${imotaraReply}

=== WHAT THIS TURN SHOULD DO ===
${turnCheck}

=== EVALUATE ON THESE DIMENSIONS ===
1. CONTEXTUAL RELEVANCE: Does the reply reference the right details from earlier in the conversation (not generic)?
2. CONSISTENCY: Does it contradict anything said in earlier turns?
3. NON-REPETITION: Does it avoid reusing phrases or ideas from Imotara's previous replies?
4. EMOTIONAL FIT: Is the emotional register appropriate for where the conversation is now?
5. SPECIFICITY: Does it feel tailored to THIS user's situation, or could it apply to anyone?

Score 1-10:
  9-10: Excellent — contextually rich, consistent, non-repetitive, emotionally attuned
  7-8:  Good — mostly right, minor issues
  5-6:  Mediocre — generic or slightly repetitive but not wrong
  3-4:  Poor — misses context, repetitive, or emotionally misaligned
  1-2:  Bad — contradicts earlier context, completely generic, or inappropriate

Respond with JSON only:
{
  "score": <number>,
  "reason": "<one sentence summary in English>",
  "issues": ["<specific issue if any>", ...]
}
If no issues, set "issues" to [].`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json() as { choices: { message: { content: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as CoherenceResult;
  } catch {
    return { score: 0, reason: "Parse error", issues: [raw] };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set");
    process.exit(1);
  }

  const config = LANG_CONFIGS[AUDIT_LANG];
  if (!config) {
    console.error(`No conversation script for AUDIT_LANG="${AUDIT_LANG}". Supported: en, bn, hi, bn-roman, hi-roman`);
    process.exit(1);
  }

  const { label, topic, userMessages } = config;
  const conversationHistory: Message[] = [];

  console.log(`\n${C.bold}══════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  IMOTARA TURN-BY-TURN COHERENCE AUDIT — ${label} (${userMessages.length} turns)${C.reset}`);
  console.log(`${C.bold}  Topic: ${topic}${C.reset}`);
  console.log(`${C.bold}══════════════════════════════════════════════════════════════════════${C.reset}\n`);

  const results: { turn: number; score: number; pass: boolean }[] = [];
  let totalScore = 0;

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i];
    const turnNum = i + 1;

    conversationHistory.push({ role: "user", content: userMsg });

    console.log(`${C.dim}─────────────────────────────────────────────────────────────────${C.reset}`);
    console.log(`${C.bold}Turn ${turnNum}/${userMessages.length}${C.reset}`);
    console.log(`${C.cyan}User:${C.reset}    "${userMsg}"`);

    let reply: string;
    let latencyMs: number;
    try {
      ({ reply, latencyMs } = await callImotara(conversationHistory, AUDIT_LANG));
    } catch (err) {
      console.log(`${C.red}  ✗ API error: ${err}${C.reset}`);
      conversationHistory.push({ role: "assistant", content: "[API ERROR]" });
      results.push({ turn: turnNum, score: 0, pass: false });
      continue;
    }

    console.log(`${C.blue}Imotara:${C.reset} "${reply}"`);
    console.log(`${C.dim}         (${latencyMs}ms)${C.reset}`);

    conversationHistory.push({ role: "assistant", content: reply });

    const judgment = await judgeCoherence(i, conversationHistory, reply, TURN_CHECKS[i], AUDIT_LANG);

    const pass = judgment.score >= 7;
    const scoreColor = judgment.score >= 7 ? C.green : judgment.score >= 5 ? C.yellow : C.red;
    const icon = pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;

    console.log(`${icon} ${C.bold}Score: ${scoreColor}${judgment.score}/10${C.reset}  — ${judgment.reason}`);
    if (judgment.issues.length > 0) {
      for (const issue of judgment.issues) {
        console.log(`  ${C.yellow}⚠ ${issue}${C.reset}`);
      }
    }
    console.log(`  ${C.dim}Check: ${TURN_CHECKS[i]}${C.reset}`);

    totalScore += judgment.score;
    results.push({ turn: turnNum, score: judgment.score, pass });
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const avgScore = (totalScore / results.length).toFixed(1);
  const passRate = Math.round((passed / results.length) * 100);

  console.log(`\n${C.bold}══════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  COHERENCE AUDIT SUMMARY — ${label}${C.reset}`);
  console.log(`${C.bold}══════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`  Turns evaluated: ${results.length}`);
  console.log(`  Passed (≥7/10):  ${C.green}${passed}${C.reset} / ${results.length}`);
  console.log(`  Pass rate:       ${passRate >= 80 ? C.green : passRate >= 60 ? C.yellow : C.red}${passRate}%${C.reset}`);
  console.log(`  Average score:   ${C.bold}${avgScore}/10${C.reset}`);
  console.log();

  for (const r of results) {
    const icon = r.pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    const scoreColor = r.score >= 7 ? C.green : r.score >= 5 ? C.yellow : C.red;
    console.log(`  Turn ${String(r.turn).padStart(2)}: ${icon} ${scoreColor}${r.score}/10${C.reset}`);
  }

  console.log(`\n${C.bold}══════════════════════════════════════════════════════════════════════${C.reset}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
