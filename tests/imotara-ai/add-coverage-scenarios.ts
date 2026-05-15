/**
 * tests/imotara-ai/add-coverage-scenarios.ts
 *
 * One-shot script: appends response-style (×4), middle age-range (×5), and
 * male-gender (×1) scenarios to every language scenario file.
 *
 * Run once:  npx tsx tests/imotara-ai/add-coverage-scenarios.ts
 */

import fs from "fs";
import path from "path";

// ─── Language meta ────────────────────────────────────────────────────────────

type LangMeta = {
  name: string;
  /** Does the language inflect verbs/adjectives for user gender? */
  grammaticalGender: boolean;
};

const LANGS: Record<string, LangMeta> = {
  en: { name: "English",    grammaticalGender: false },
  hi: { name: "Hindi",      grammaticalGender: true  },
  bn: { name: "Bengali",    grammaticalGender: true  },
  mr: { name: "Marathi",    grammaticalGender: true  },
  ta: { name: "Tamil",      grammaticalGender: true  },
  te: { name: "Telugu",     grammaticalGender: true  },
  gu: { name: "Gujarati",   grammaticalGender: true  },
  pa: { name: "Punjabi",    grammaticalGender: true  },
  kn: { name: "Kannada",    grammaticalGender: true  },
  ml: { name: "Malayalam",  grammaticalGender: true  },
  or: { name: "Odia",       grammaticalGender: true  },
  ur: { name: "Urdu",       grammaticalGender: true  },
  ar: { name: "Arabic",     grammaticalGender: true  },
  he: { name: "Hebrew",     grammaticalGender: true  },
  ru: { name: "Russian",    grammaticalGender: true  },
  zh: { name: "Chinese",    grammaticalGender: false },
  ja: { name: "Japanese",   grammaticalGender: false },
  de: { name: "German",     grammaticalGender: true  },
  fr: { name: "French",     grammaticalGender: true  },
  es: { name: "Spanish",    grammaticalGender: true  },
  pt: { name: "Portuguese", grammaticalGender: true  },
  id: { name: "Indonesian", grammaticalGender: false },
};

// ─── Age-range specs ──────────────────────────────────────────────────────────

const AGE_RANGES: Array<{
  code: string; label: string; short: string; message: string; passHint: string;
}> = [
  {
    code: "18_24", label: "18-24", short: "young-adult",
    message: "I am trying to figure out what I want to do with my life. Everything feels so uncertain and I do not know if I am making the right choices.",
    passHint: "Peer-like tone — does not preach or sound parental. Acknowledges that uncertainty is normal at this life stage. Warm and relatable.",
  },
  {
    code: "25_34", label: "25-34", short: "late-twenties",
    message: "I feel like I am falling behind where I should be. Friends are getting promoted, getting married, and I still feel lost.",
    passHint: "Peer-like, acknowledges complexity of this phase. Does not dismiss the feeling or compare unfavourably. Not preachy.",
  },
  {
    code: "35_44", label: "35-44", short: "mid-thirties",
    message: "I thought I would have everything figured out by now. Instead I keep questioning my career and whether I am on the right path.",
    passHint: "Grounded, non-patronising. Affirms that questioning at this stage is common and okay. Does not lecture or minimise.",
  },
  {
    code: "45_54", label: "45-54", short: "mid-forties",
    message: "I keep revisiting the choices I have made — career, relationships, where I live. Part of me wonders if I should have done things differently.",
    passHint: "Gentle, deep acknowledgment. Does not rush to reassure or dismiss. Treats the user as a thoughtful adult navigating a real mid-life reflection.",
  },
  {
    code: "55_64", label: "55-64", short: "mid-fifties",
    message: "Sometimes I wonder if my best years are behind me. I still have energy and things I want to do, but I feel like the world moves on without me.",
    passHint: "Warm and respectful register. Does not dismiss the fear. Gently offers presence or perspective without toxic positivity.",
  },
];

// ─── Response style specs ─────────────────────────────────────────────────────

const STYLES: Array<{
  style: string; tone: string; message: string; passHint: string; failHint: string;
}> = [
  {
    style: "comfort", tone: "close_friend",
    message: "I am just completely overwhelmed right now and I do not know what to do.",
    passHint: "Reply focuses on warmth, presence, and validation. Does NOT pivot to advice or action steps. Uses language of togetherness and acknowledgment. Reply is in the target language.",
    failHint: "Reply jumps to advice ('try this', 'have you considered') instead of staying in presence mode. Fix: responseStyle=comfort must prioritise warmth over solutions.",
  },
  {
    style: "reflect", tone: "calm_companion",
    message: "Something has been weighing on me and I cannot quite put my finger on what it is.",
    passHint: "Reply ends with at least one gentle, open-ended reflective question. Does not immediately offer solutions. Invites the user to explore their own feelings. Reply is in the target language.",
    failHint: "Reply gives comfort or advice without a reflective question. Fix: responseStyle=reflect must end with an open question that invites exploration.",
  },
  {
    style: "motivate", tone: "coach",
    message: "I feel like giving up. I keep trying but nothing is moving forward and I am exhausted.",
    passHint: "Reply is forward-looking and energising. Briefly acknowledges the exhaustion, then nudges toward action — a small concrete step or direct encouragement. Ends with momentum, not just sympathy. Reply is in the target language.",
    failHint: "Reply is purely soothing comfort with no forward momentum or action nudge. Fix: responseStyle=motivate should be energising, not just sympathetic.",
  },
  {
    style: "advise", tone: "coach",
    message: "I keep procrastinating on important work and I do not know how to break the cycle. I need practical help.",
    passHint: "Reply is concrete and practical. Offers at least one actionable suggestion. Does not spend the whole reply only validating feelings — gets to the practical part. Reply is in the target language.",
    failHint: "Reply stays entirely in emotional validation mode without a concrete suggestion. Fix: responseStyle=advise must include actionable practical content.",
  },
];

// ─── Code building helpers ────────────────────────────────────────────────────

/** Escape for use inside a template-literal or double-quoted string in the TS output */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/** Produce a `messages` array fragment depending on whether the file uses user() helper */
function msgLine(hasHelper: boolean, content: string): string {
  const escaped = content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  if (hasHelper) return `[user(\`${escaped}\`)]`;
  return `[{ role: "user", content: \`${escaped}\` }]`;
}

// ─── Scenario block builders ──────────────────────────────────────────────────

function buildStyleBlock(lang: string, meta: LangMeta, hasHelper: boolean): string {
  const lines: string[] = [
    "",
    `  // ── Response style scenarios (comfort / reflect / motivate / advise) ────────`,
  ];
  for (const s of STYLES) {
    const id = `${lang}-style-${s.style}-01`;
    lines.push(`  {`);
    lines.push(`    id: "${id}",`);
    lines.push(`    category: "Response Style",`);
    lines.push(`    name: "${s.style.charAt(0).toUpperCase() + s.style.slice(1)} style (${lang}): ${s.style === "comfort" ? "warmth over advice" : s.style === "reflect" ? "invite reflection" : s.style === "motivate" ? "energise and nudge" : "practical suggestion"}",`);
    lines.push(`    description: "responseStyle='${s.style}' set. Reply must follow the ${s.style} style in ${meta.name}.",`);
    lines.push(`    messages: ${msgLine(hasHelper, s.message)},`);
    lines.push(`    config: { lang: "${lang}", tone: "${s.tone}", responseStyle: "${s.style}" },`);
    lines.push(`    criteria: {`);
    lines.push(`      id: "${id}",`);
    lines.push(`      description: "${esc(s.passHint.split(".")[0])}.",`);
    lines.push(`      passCondition: "${esc(s.passHint)}",`);
    lines.push(`      failExpectedOutcome: "${esc(s.failHint)}",`);
    lines.push(`    },`);
    lines.push(`  },`);
  }
  return lines.join("\n");
}

function buildAgeBlock(lang: string, meta: LangMeta, hasHelper: boolean): string {
  const lines: string[] = [
    "",
    `  // ── Middle age-range scenarios ────────────────────────────────────────────`,
  ];
  for (const ar of AGE_RANGES) {
    const id = `${lang}-age-${ar.short}-01`;
    lines.push(`  {`);
    lines.push(`    id: "${id}",`);
    lines.push(`    category: "Age Adaptation",`);
    lines.push(`    name: "Age ${ar.label}: appropriate register for ${ar.label} user (${lang})",`);
    lines.push(`    description: "userAge='${ar.code}'. Reply must use the right register for a ${ar.label}-year-old in ${meta.name}.",`);
    lines.push(`    messages: ${msgLine(hasHelper, ar.message)},`);
    lines.push(`    config: { lang: "${lang}", tone: "close_friend", userAge: "${ar.code}" },`);
    lines.push(`    criteria: {`);
    lines.push(`      id: "${id}",`);
    lines.push(`      description: "${esc(ar.passHint.split(".")[0])}.",`);
    lines.push(`      passCondition: "${esc(ar.passHint)} Reply is in ${meta.name} (or natural English mix).",`);
    lines.push(`      failExpectedOutcome: "Reply uses wrong register for age ${ar.label} (too parental, too dismissive, or tone mismatch). Fix: check userAge=${ar.code} instruction in route.ts.",`);
    lines.push(`    },`);
    lines.push(`  },`);
  }
  return lines.join("\n");
}

function buildGenderMaleBlock(lang: string, meta: LangMeta, hasHelper: boolean): string {
  const msg = "I have been feeling really burnt out lately. I do not know how to talk about it with anyone.";
  const id = `${lang}-gender-male-01`;

  let passCondition: string;
  let failOutcome: string;

  if (!meta.grammaticalGender) {
    passCondition = `Reply addresses the user without female-coded language. In ${meta.name}, grammatical gender is minimal, so any warm supportive reply that does not use 'she/her' for the user passes.`;
    failOutcome = `Reply uses 'she/her' for the user, or otherwise assumes female gender. Fix: ensure userGender=male is respected.`;
  } else {
    const langSpecific: Record<string, string> = {
      hi: "No feminine verb ending for the user ('थकी हो' → should be 'थके हो'; 'kar rahi ho' → 'kar rahe ho').",
      bn: "No feminine form for the user (e.g. 'tumi thaki' should be 'tumi thako' or natural neutral).",
      mr: "No feminine verb ending for the user ('thakli' → 'thaklo'; uses neutral or masculine form).",
      ta: "No feminine suffix for the user in verb conjugation (Tamil has gendered third-person but second-person is mostly neutral).",
      te: "No feminine verb form for the user reference.",
      gu: "No feminine verb form for the user ('thaki' → 'thako' or neutral equivalent).",
      pa: "No feminine form applied to the male user.",
      kn: "No feminine verb form for the user reference in Kannada.",
      ml: "No feminine form applied to the male user.",
      or: "No feminine form applied to the male user.",
      ur: "No feminine verb conjugation for the male user.",
      ar: "No feminine verb conjugation for the male user (e.g. 'anta' not 'anti').",
      he: "No feminine form for the user ('עייף' for male, not 'עייפה').",
      ru: "No feminine verb/adjective for the user ('ты устал' not 'ты устала'; 'справился' not 'справилась').",
      de: "No feminine pronoun/adjective for the male user.",
      fr: "No feminine agreement for the male user ('fatigué' not 'fatiguée').",
      es: "No feminine adjective for male user ('cansado' not 'cansada'; 'solo' not 'sola').",
      pt: "No feminine adjective for male user ('cansado' not 'cansada'; 'sozinho' not 'sozinha').",
    };
    const check = langSpecific[lang] ?? `No feminine grammatical form applied to the male user.`;
    passCondition = `${check} Or the reply naturally avoids the gendered construction. Reply is in ${meta.name}.`;
    failOutcome = `Reply uses feminine verb/adjective forms for the male user. Fix: ensure userGender=male gender injection in system prompt is working and GPT honours it.`;
  }

  return `
  // ── Male gender scenario ──────────────────────────────────────────────────
  {
    id: "${id}",
    category: "Gender",
    name: "Male user: ${meta.grammaticalGender ? "correct masculine grammatical forms" : "no wrong gender assumptions"} (${lang})",
    description: "userGender='male'. Reply must use masculine (or neutral) grammatical forms — not feminine — when referring to the user.",
    messages: ${msgLine(hasHelper, msg)},
    config: { lang: "${lang}", tone: "close_friend", userGender: "male" },
    criteria: {
      id: "${id}",
      description: "Reply uses masculine or neutral forms for the user. No feminine forms.",
      passCondition: "${esc(passCondition)}",
      failExpectedOutcome: "${esc(failOutcome)}",
    },
  },`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SCENARIO_DIR = path.resolve(__dirname);

for (const [lang, meta] of Object.entries(LANGS)) {
  const filePath = path.join(SCENARIO_DIR, `scenarios.${lang}.ts`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠  Skipping ${lang} — file not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");

  if (content.includes(`${lang}-style-comfort-01`)) {
    console.log(`✓  ${lang} — already patched, skipping`);
    continue;
  }

  // Detect whether this file exports a user() helper
  const hasHelper = /^function user\b/m.test(content);

  // Find the closing bracket of the exported array
  const lastBracketIdx = content.lastIndexOf("];");
  if (lastBracketIdx === -1) {
    console.warn(`⚠  ${lang} — cannot find closing "];", skipping`);
    continue;
  }

  const insert = [
    buildStyleBlock(lang, meta, hasHelper),
    buildAgeBlock(lang, meta, hasHelper),
    buildGenderMaleBlock(lang, meta, hasHelper),
    "",
  ].join("\n");

  const newContent =
    content.slice(0, lastBracketIdx) + insert + "\n" + content.slice(lastBracketIdx);

  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`✅  ${lang} (${meta.name}) — added 10 coverage scenarios (helper=${hasHelper})`);
}

console.log("\nDone. Run: npx tsc --noEmit to check types.");
