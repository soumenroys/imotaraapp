/**
 * tests/imotara-ai/runner.ts
 *
 * E2E test runner for Imotara AI reply quality.
 * Sends real HTTP requests to the running Next.js server and evaluates
 * responses using an LLM judge.
 *
 * Usage:
 *   LANG=en   npx tsx tests/imotara-ai/runner.ts
 *   LANG=bn   npx tsx tests/imotara-ai/runner.ts
 *   LANG=hi   PLATFORM=mobile npx tsx tests/imotara-ai/runner.ts
 *
 * Options (env vars):
 *   BASE_URL         — server URL (default: http://localhost:3000)
 *   OPENAI_API_KEY   — key for LLM judge (heuristic fallback if absent)
 *   LANG             — language code to test (default: en)
 *   PLATFORM         — "web" | "mobile" (default: web)
 *   SCENARIO_IDS     — comma-separated list of scenario IDs to run (default: all)
 *   VERBOSE          — show full reply text in report (default: false)
 */

import fs from "fs";
import path from "path";
import type { TestScenario, JudgeResult, TestReport, Platform } from "./types";

// Auto-load OPENAI_API_KEY from .env.local if not already in environment
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

import { judgeReply } from "./judge";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/chat-reply`;
const VERBOSE = process.env.VERBOSE === "1" || process.env.VERBOSE === "true";
const LANG = (process.env.LANG ?? "en").toLowerCase().split("-")[0]; // "en-IN" → "en"
const PLATFORM: Platform = process.env.PLATFORM === "mobile" ? "mobile" : "web";
const SCENARIO_FILTER = process.env.SCENARIO_IDS
  ? new Set(process.env.SCENARIO_IDS.split(",").map((s) => s.trim()))
  : null;

// ─── Dynamic scenario loading ───────────────────────────────────────────────

async function loadScenarios(lang: string): Promise<TestScenario[]> {
  const file = path.resolve(__dirname, `scenarios.${lang}.ts`);
  if (!fs.existsSync(file)) {
    console.error(`No scenario file found for lang="${lang}". Expected: ${file}`);
    process.exit(1);
  }
  // Dynamic import (tsx handles TypeScript at runtime)
  const mod = await import(`./scenarios.${lang}`);
  const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
  if (!key) {
    console.error(`Scenario file for lang="${lang}" does not export an array.`);
    process.exit(1);
  }
  return mod[key] as TestScenario[];
}

// ─── Mobile language detection (mirrors aiClient.ts logic) ──────────────────

/** Unicode-range script detection — same as mobile detectLangFromScript() */
function detectLangFromScript(message: string): string {
  if (!message) return "en";
  if (/[\u0980-\u09FF]/.test(message)) return "bn";
  if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(message)) return "hi";
  if (/[\u0B80-\u0BFF]/.test(message)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(message)) return "te";
  if (/[\u0A80-\u0AFF]/.test(message)) return "gu";
  if (/[\u0C80-\u0CFF]/.test(message)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(message)) return "ml";
  if (/[\u0A00-\u0A7F]/.test(message)) return "pa";
  if (/[\u0B00-\u0B7F]/.test(message)) return "or";
  if (/[\u0590-\u05FF]/.test(message)) return "he";
  if (/[\u067E\u0686\u0688\u0691\u0679\u06AF\u06A9\u06BA\u06D2\u06D3]/.test(message)) return "ur";
  if (/[\u0600-\u06FF]/.test(message)) return "ar";
  if (/[\u0400-\u04FF]/.test(message)) return "ru";
  if (/[\u4E00-\u9FFF]/.test(message)) return "zh";
  if (/[\u3040-\u30FF]/.test(message)) return "ja";
  return "en";
}

/** Roman-script hint patterns for Indic languages (mirrors mobile keywordMaps) */
const ROMAN_HINTS: Record<string, RegExp> = {
  bn: /\b(ami|tumi|amar|tomar|apni|apnar|amra|tomra|ache|achhi|achhen|thaki|thakis|thaken|koro|korchi|korben|hobe|hoyeche|hoye|gelo|giye|nei|nai|bhalo|kharap|kemon|kothay|keno|ki|ke|kake|kotha|ektu|kintu|tahole|jodi|tobe|chhi|achha|hyan|na|nah|hoy|jay|thak|dek|bol|bolo|jao|esho|khacho|khabo|khabe|parchi|parbo|parbe|bujhchi|bujhbo|jani|janina|mone|hoye|pore|age|ebar|ekhon|abhi|prai|sob|keu|kono|kichu|onek|beshi|kom|boro|choto|valo|kosto|dukkho|kanna|eka|theke|diye|niye|rakhchi|dekhchi|bhabi|matha|mon|dil|pran|bhai|bon|dada|didi|ma|baba)\b/i,
  hi: /\b(main|mein|mujhe|mujhko|mere|mera|meri|hum|hamara|hamari|hamare|tum|tumhara|tumhari|aap|aapka|aapki|wo|woh|unka|unki|yeh|ye|hai|hain|tha|thi|the|hoga|hogi|honge|karo|karna|karni|karenge|karoge|chahiye|chahta|chahti|nahi|nahin|nai|bhi|toh|phir|lekin|par|aur|ya|ki|ke|ko|se|mein|pe|tak|kab|kahan|kyun|kyunki|kya|kaun|koi|kuch|sab|bahut|bohot|thoda|zyada|accha|theek|ठीक|bilkul|haan|han|na|nahi|ho|ja|aa|de|le|sun|bol|dekh|samajh|rona|khana|sona|raho|jao|aao|bolo|sunna|laga|lagta|lagti|lagta|dil|mann|man|zindagi|kal|aaj|abhi|pehle|baad|waqt|time|dost|yaar|bhai|behen|ma|papa)\b/i,
  ta: /\b(naan|naanga|unakku|enakku|avanga|ivanga|avan|aval|enna|yenna|enge|yenga|eppadi|eppo|yen|yen|oru|rendu|moonu|romba|konjam|nalla|ketta|seri|illa|aam|paakaren|pogren|vaaren|solren|kekkiren|puriyala|theriyala|vandhuten|poitten|paathten|sollitten|kaadhali|kadhal|vaali|magizhchi|kavalai|bayam|kopam|thanimai|sorrow|kashtam|nambikkai|aaval|thevaiyilla|mudiyala|pannuren|panna|panrom|pannuvom|veettu|oorla|schoolla|collegela|officela|friendu|ammaa|appaa|akka|anna|thambi|thangachi)\b/i,
  mr: /\b(mi|mala|maaz|majha|majhi|tu|tula|tuza|tujhi|aapan|aapla|aapli|to|tila|tichya|ti|ahe|aahe|hote|hoti|hotam|asato|asate|karto|karte|kartoy|nahiye|nahi|pan|ani|mhanje|jevha|tevha|karan|jar|tar|kuthun|kuthla|kasa|kashi|kaay|kon|koni|konacha|konacha|nakko|aavad|aavadt|aavadta|bor|chan|sundar|vaait|khaup|khoop|thoda|jaast|parat|aata|aadhi|nantar|vegla|baro|theek|ho|ja|ye|de|sang|bagh|saman|aai|baba|dada|tai|mama|kaka|bhai|bhaau|vahini|maitrin)\b/i,
  gu: /\b(hun|mane|mara|mari|tame|tamne|tamara|tamari|ae|tene|tena|teni|aa|aanu|aani|aavy|gayo|gai|gayu|che|chhe|hato|hati|hatu|karum|karo|kare|karsho|nahi|nai|pan|ane|to|jem|jem|eno|ena|eni|kai|shu|shu|kem|kyan|kyare|keni|kaun|koi|kuch|koik|badhu|ghanu|thodu|vadhare|sarum|kharab|thik|chokku|ho|na|aa|ja|de|le|juo|suno|kaho|samjo|dil|man|jindagi|gharne|bhaibandh|mitra|kaka|kaki|mama|mami|ben|bhai|ba|bapa)\b/i,
  kn: /\b(naanu|nange|nanna|neenu|ninge|ninna|avanu|avalu|avaru|ivanu|ivalu|ivaru|enu|yenu|elli|yelli|eshtu|yeshtu|yaake|yenu|ondu|eradu|mooru|tumba|swalpa|channa|ketta|sari|illa|haan|houdu|maad|hogtini|bartini|helidini|nodidini|kelide|gottilla|artha|aagilla|bandu|hogi|nodide|helbeke|madtini|prem|preeti|duhkha|bhaya|kopa|ekanta|santosha|nambike|aase|beda|madolla|aagolla|mugisolla|maneli|ooru|schoolalli|collegalli|officalli|geleya|amma|appa|anna|akka|tamma|tangi|chikkappa|dodappa)\b/i,
  ml: /\b(nje|njan|enikku|enikk|ente|ningal|ningalude|ningalkku|avan|aval|avare|ivan|ival|ivare|enthu|evide|eppo|evidunnu|engane|entha|oru|randu|moonu|valare|konjam|nalla|cheriya|mose|seri|alla|athe|cheyyunnu|pokkunnu|varunnu|parayunnu|kelkkunnu|ariyilla|manassilayilla|vannu|poyi|kandhu|parayandi|kaadhalu|vishamam|bhayam|kopam|thannimai|santhosham|vishwasam|aavashyamilla|pattilla|aagilla|theerkkilla|veettu|gramathil|schoolil|collegil|officil|koottukar|amma|achan|etan|chechi|aniyatta|ittettan|kochamma)\b/i,
  pa: /\b(main|mein|mainu|mera|meri|mere|tenu|tera|teri|tere|assi|sanu|sada|sadi|sade|oh|ohnu|ohda|ohdi|ohde|iho|ehnu|ehda|ehdi|ehde|karo|karna|karni|karanga|karogi|nahin|nahi|ni|vi|te|par|ke|da|di|de|nu|ton|wich|kado|kithe|kyon|ki|kaun|koi|kuch|sab|bahut|thoda|changa|mada|theek|hun|pehlan|magar|lekin|sach|jhooth|haan|na|ja|aa|de|le|sun|bol|dekh|man|dil|zindagi|kal|aaj|yaar|dost|bhai|behen|beba|pyo|massi|chacha|taya|bhaina|veer)\b/i,
  or: /\b(mun|mo|mora|tume|tumara|tumari|se|tara|tari|tanka|ete|ete|kahin|kebe|kana|kun|kemiti|kete|gote|duta|tini|bahut|kichha|bhal|kharap|thik|heba|aste|huchi|karuchi|jauchi|aasuchi|kahibi|dekhibi|jibi|na|nahi|haan|ha|to|ebam|kintu|jebe|tebe|kebe|kimbha|thakibe|rahibe|manichi|bujhichi|janinahin|aajira|kalira|agaru|pare|alpa|adhika|ghara|gaon|bandhure|bhai|bhaina|maa|bapa|dada|didi|nana|nani|kaka|mausa)\b/i,
};

function detectLangFromRomanHints(message: string): string {
  if (!message) return "en";
  const scores: Record<string, number> = {};
  for (const [lang, regex] of Object.entries(ROMAN_HINTS)) {
    const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    const m = message.match(global);
    if (m) scores[lang] = (scores[lang] ?? 0) + m.length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 1 ? best[0] : "en";
}

/** Derive the lang field exactly as mobile aiClient.ts does */
function mobileDeriveLang(message: string, preferredLang?: string): string {
  const scriptLang = detectLangFromScript(message);
  if (scriptLang !== "en") return scriptLang;
  const romanLang = detectLangFromRomanHints(message);
  if (romanLang !== "en") return romanLang;
  return preferredLang ?? "en";
}

/** Map mobile relationship → /api/chat-reply tone (mirrors mobile deriveToneForChatReply) */
function mobileDeriveApiTone(
  relationship?: string,
): "close_friend" | "calm_companion" | "coach" | "mentor" {
  if (relationship === "coach") return "coach";
  if (relationship === "mentor" || relationship === "elder" || relationship === "parent_like") return "mentor";
  return "close_friend";
}

// ─── Colours ────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  dim: "\x1b[2m",
};

// ─── API call ───────────────────────────────────────────────────────────────

type APIResponseData = {
  text?: string;
  message?: string;
  meta?: { from?: string; reason?: string; usedModel?: string };
};

async function callImotaraAPI(
  scenario: TestScenario,
  platform: Platform,
): Promise<{ reply: string; latencyMs: number }> {
  const { messages, config } = scenario;
  const start = Date.now();

  // Last user message (for mobile lang detection)
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let body: Record<string, unknown>;

  if (platform === "mobile") {
    // Simulate exactly what mobile aiClient.ts sends to /api/chat-reply
    const derivedLang = mobileDeriveLang(lastUserMsg, config.mobilePreferredLang ?? config.lang);
    const derivedTone = mobileDeriveApiTone(config.mobileRelationship ?? config.tone);
    body = {
      messages,
      tone: derivedTone,
      lang: derivedLang,
      ...(config.userAge ? { userAge: config.userAge } : {}),
      ...(config.companionAge ? { companionAge: config.companionAge } : {}),
      ...(config.userGender ? { userGender: config.userGender } : {}),
      ...(config.companionGender ? { companionGender: config.companionGender } : {}),
      ...(config.emotion ? { emotion: config.emotion } : {}),
      ...(config.emotionMemory ? { emotionMemory: config.emotionMemory } : {}),
      // Mobile does NOT send allowMemory
    };
  } else {
    // Web client: sends lang directly from user preference
    body = {
      messages,
      tone: config.tone,
      lang: config.lang,
      userAge: config.userAge,
      companionAge: config.companionAge,
      userGender: config.userGender,
      companionGender: config.companionGender,
      emotion: config.emotion,
      emotionMemory: config.emotionMemory,
      allowMemory: false,
    };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000), // longer for big conversation payloads
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error calling ${ENDPOINT}: ${msg}`);
  }

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`API returned ${res.status}: ${text}`);
  }

  const data = (await res.json()) as APIResponseData;
  const reply = (data.text ?? data.message ?? "").trim();

  if (!reply && data.meta?.from === "error") {
    const reason = data.meta.reason ?? "Unknown server error";
    if (/429|quota|billing/i.test(reason)) {
      throw new Error(`SKIP:OpenAI quota exceeded — set a valid OPENAI_API_KEY in the server .env`);
    }
    throw new Error(`SKIP:Server AI error: ${reason.slice(0, 120)}`);
  }

  if (!reply) throw new Error("API returned empty reply");

  return { reply, latencyMs };
}

// ─── Single scenario run ────────────────────────────────────────────────────

async function runScenario(
  scenario: TestScenario,
  platform: Platform,
): Promise<JudgeResult> {
  const modality = scenario.config.inputModality ?? "native";
  const modalityBadge = modality === "romanized" ? `${C.magenta}[R]${C.reset}` :
                        modality === "mixed"     ? `${C.yellow}[M]${C.reset}` : "";
  const platformBadge = platform === "mobile" ? `${C.cyan}[mob]${C.reset}` : "";

  process.stdout.write(
    `  ${C.dim}Running${C.reset} ${C.cyan}${scenario.id}${C.reset}${modalityBadge}${platformBadge} — ${scenario.name}... `
  );

  let reply: string;
  let latencyMs: number;

  try {
    ({ reply, latencyMs } = await callImotaraAPI(scenario, platform));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isSkip = msg.startsWith("SKIP:");
    const badge = isSkip ? `${C.yellow}SKIP${C.reset}` : `${C.red}ERROR${C.reset}`;
    process.stdout.write(`${badge}\n`);
    if (isSkip) {
      console.log(`    ${C.yellow}→ ${msg.replace("SKIP:", "")}${C.reset}`);
    }
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      category: scenario.category,
      pass: isSkip,
      score: isSkip ? -1 : 0,
      reason: isSkip ? `SKIPPED: ${msg.replace("SKIP:", "")}` : `API call failed: ${msg}`,
      actualReply: "",
      expectedOutcome: scenario.criteria.failExpectedOutcome,
      latencyMs: 0,
      platform,
      inputModality: modality,
    };
  }

  const result = await judgeReply(scenario, reply, latencyMs);

  const badge = result.pass
    ? `${C.green}✓ PASS${C.reset}`
    : `${C.red}✗ FAIL${C.reset}`;

  process.stdout.write(`${badge} ${C.dim}(${result.score}/10, ${latencyMs}ms)${C.reset}\n`);

  if (!result.pass || VERBOSE) {
    console.log(`    ${C.dim}→ Reason:${C.reset} ${result.reason}`);
    if (VERBOSE) {
      console.log(`    ${C.dim}→ Reply:${C.reset} ${result.actualReply.replace(/\n/g, " ").slice(0, 200)}`);
    }
    if (!result.pass) {
      console.log(`    ${C.yellow}→ Expected:${C.reset} ${result.expectedOutcome.slice(0, 200)}`);
    }
  }

  return { ...result, platform, inputModality: modality };
}

// ─── Report ─────────────────────────────────────────────────────────────────

function printReport(report: TestReport, lang: string, platform: Platform): void {
  const { totalTests, passed, failed, results } = report;
  const passRate = Math.round((passed / totalTests) * 100);
  const langUpper = lang.toUpperCase();

  console.log("\n" + "═".repeat(70));
  console.log(`${C.bold}  IMOTARA AI REPLY TEST REPORT — ${langUpper} [${platform.toUpperCase()}]${C.reset}`);
  console.log("═".repeat(70));
  console.log(`  Run at:   ${report.runAt}`);
  console.log(`  Total:    ${totalTests} tests`);
  console.log(`  Passed:   ${C.green}${passed}${C.reset}`);
  console.log(`  Failed:   ${C.red}${failed}${C.reset}`);
  console.log(`  Pass rate: ${passRate >= 80 ? C.green : passRate >= 60 ? C.yellow : C.red}${passRate}%${C.reset}`);
  console.log("─".repeat(70));

  // Group by category
  const byCategory = new Map<string, JudgeResult[]>();
  for (const r of results) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  for (const [cat, catResults] of byCategory) {
    const catPassed = catResults.filter((r) => r.pass).length;
    const catTotal = catResults.length;
    const catBadge = catPassed === catTotal ? C.green : catPassed === 0 ? C.red : C.yellow;

    console.log(`\n  ${C.bold}${cat}${C.reset} — ${catBadge}${catPassed}/${catTotal}${C.reset}`);

    for (const r of catResults) {
      const badge = r.pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
      const modTag = r.inputModality === "romanized" ? ` ${C.magenta}[R]${C.reset}` :
                     r.inputModality === "mixed"     ? ` ${C.yellow}[M]${C.reset}` : "";
      const platTag = r.platform === "mobile" ? ` ${C.cyan}[mob]${C.reset}` : "";
      console.log(`    ${badge} [${r.score}/10] ${r.scenarioName}${modTag}${platTag}`);
      if (!r.pass) {
        console.log(`        ${C.yellow}${r.reason}${C.reset}`);
        console.log(`        ${C.dim}Expected: ${r.expectedOutcome.slice(0, 120)}${C.reset}`);
      }
    }
  }

  console.log("\n" + "═".repeat(70));

  if (failed > 0) {
    console.log(`\n${C.bold}  FAILED TESTS — Fix Priority${C.reset}`);
    console.log("─".repeat(70));
    const failedResults = results.filter((r) => !r.pass).sort((a, b) => a.score - b.score);
    for (const r of failedResults) {
      console.log(`  ${C.red}${r.scenarioId}${C.reset} (score: ${r.score}/10)`);
      console.log(`    → ${r.reason}`);
      console.log(`    → ${C.yellow}${r.expectedOutcome.slice(0, 160)}${C.reset}\n`);
    }
  } else {
    console.log(`\n${C.green}${C.bold}  All tests passed!${C.reset}`);
  }

  console.log("═".repeat(70) + "\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const scenarios = await loadScenarios(LANG);

  const toRun = SCENARIO_FILTER
    ? scenarios.filter((s) => SCENARIO_FILTER!.has(s.id))
    : scenarios;

  if (toRun.length === 0) {
    console.error("No scenarios matched the SCENARIO_IDS filter.");
    process.exit(1);
  }

  console.log(`\n${C.bold}  Imotara AI Reply Tests — ${LANG.toUpperCase()} [${PLATFORM}]${C.reset}`);
  console.log(`  Server:   ${BASE_URL}`);
  console.log(`  Judge:    ${process.env.OPENAI_API_KEY ? "GPT-4o-mini (LLM)" : "Heuristic (no API key)"}`);
  console.log(`  Platform: ${PLATFORM}`);
  console.log(`  Tests:    ${toRun.length}\n`);
  console.log(`  Legend: ${C.magenta}[R]${C.reset}=romanized  ${C.yellow}[M]${C.reset}=mixed  ${C.cyan}[mob]${C.reset}=mobile\n`);

  // Check server availability
  try {
    const ping = await fetch(`${BASE_URL}/api/chat-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], lang: "en" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!ping.ok && ping.status !== 400 && ping.status !== 401) {
      console.error(`${C.red}Server returned ${ping.status}. Is it running at ${BASE_URL}?${C.reset}`);
      process.exit(1);
    }
  } catch {
    console.error(`${C.red}Cannot reach ${ENDPOINT}. Start the server first: npm run dev${C.reset}`);
    process.exit(1);
  }

  const results: JudgeResult[] = [];
  for (const scenario of toRun) {
    // Each scenario can declare its own platform; env PLATFORM is the default
    const scenarioPlatform = scenario.config.platform ?? PLATFORM;
    const result = await runScenario(scenario, scenarioPlatform);
    results.push(result);
  }

  const skipped = results.filter((r) => r.score === -1);
  const evaluated = results.filter((r) => r.score !== -1);
  const report: TestReport = {
    totalTests: evaluated.length,
    passed: evaluated.filter((r) => r.pass).length,
    failed: evaluated.filter((r) => !r.pass).length,
    results,
    runAt: new Date().toISOString(),
    lang: LANG,
    platform: PLATFORM,
  };

  if (skipped.length > 0) {
    console.log(`\n${C.yellow}  ${skipped.length} test(s) skipped (server AI error — check OpenAI key/quota in .env)${C.reset}`);
  }

  printReport(report, LANG, PLATFORM);

  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
