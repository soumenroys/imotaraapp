/**
 * Imotara — Psychological Tools Verification Test
 * Each scenario is designed to trigger a SPECIFIC tool.
 * After each reply, shows what EVIDENCE to look for.
 *
 * Run: node tests/psychological-tools-test.mjs
 */

const BASE = "http://localhost:3000";
const HEAD = "\x1b[1m\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

let passed = 0, partial = 0, missed = 0;

async function ask(payload) {
  const res = await fetch(`${BASE}/api/chat-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return json.text ?? json.reply ?? "(no text)";
}

function check(label, reply, evidenceMarkers, toolName) {
  const found = evidenceMarkers.filter(marker =>
    reply.toLowerCase().includes(marker.toLowerCase())
  );
  const score = found.length;
  const total = evidenceMarkers.length;

  if (score >= Math.ceil(total * 0.5)) {
    console.log(`\n${GREEN}✓ ${BOLD}${label}${RST} ${DIM}[${toolName}]${RST}`);
    passed++;
  } else if (score > 0) {
    console.log(`\n${YELLOW}~ ${BOLD}${label}${RST} ${DIM}[${toolName}]${RST}`);
    partial++;
  } else {
    console.log(`\n\x1b[31m✗ ${BOLD}${label}${RST} ${DIM}[${toolName}]${RST}`);
    missed++;
  }

  console.log(`${DIM}  Reply: ${RST}\x1b[37m${reply}\x1b[0m`);
  console.log(`${DIM}  Evidence found (${score}/${total}): ${found.length > 0 ? found.join(", ") : "none"}${RST}`);
  if (score < Math.ceil(total * 0.5)) {
    console.log(`${DIM}  Looking for: ${evidenceMarkers.join(" | ")}${RST}`);
  }
}

function section(title, subtitle) {
  console.log(`\n${HEAD}${"═".repeat(55)}${RST}`);
  console.log(`${HEAD}  ${title}${RST}`);
  if (subtitle) console.log(`${DIM}  ${subtitle}${RST}`);
  console.log(`${HEAD}${"═".repeat(55)}${RST}`);
}

// ── CATEGORY 1: Cognitive & Psychological Awareness Tools ─────────────────────

section("CATEGORY 1: Core Psychological Tools (T1–T8)", "Standard therapeutic awareness");

// T1 — Cognitive distortion
{
  const reply = await ask({
    messages: [{ role: "user", content: "I always ruin everything. Nobody at work respects me. I'll never be good enough." }],
    lang: "en", tone: "close_friend",
  });
  check("Cognitive Distortion (T1)", reply,
    ["always", "never", "wonder", "really", "whole", "one moment", "fear", "story"],
    "T1 — should mirror 'always/never' gently");
}

// T2 — Secondary emotion (anger covering hurt)
{
  const reply = await ask({
    messages: [{ role: "user", content: "I'm so angry at my best friend. She didn't even call me when my mom was sick." }],
    lang: "en", tone: "close_friend",
  });
  check("Secondary Emotion (T2)", reply,
    ["hurt", "underneath", "wound", "pain", "beneath", "deeper", "first"],
    "T2 — should name hurt/wound under anger");
}

// T3 — Parts work
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I want to quit my job but I'm terrified to." },
      { role: "assistant", content: "That's a real conflict to sit with." },
      { role: "user", content: "I don't know which part of me to listen to." },
    ],
    lang: "en", tone: "calm_companion",
  });
  check("Parts Work (T3)", reply,
    ["part of you", "another part", "both", "protect", "two"],
    "T3 — should name two valid parts");
}

// T4 — Values clarification
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I feel so lost. I don't know what I'm doing with my life." },
      { role: "assistant", content: "That feeling of not knowing which direction to go is really hard." },
      { role: "user", content: "I just don't know who I am anymore." },
    ],
    lang: "en", tone: "mentor", responseStyle: "reflect",
  });
  check("Values Clarification (T4)", reply,
    ["what matters", "want", "stand for", "care about", "underneath", "life", "purpose", "dharma"],
    "T4 — should anchor to what fundamentally matters");
}

// T5 — Hope without toxic positivity
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I've been depressed for 3 years. I don't think it ever gets better." },
      { role: "assistant", content: "Three years is a long time to carry this." },
      { role: "user", content: "I'm just tired of trying." },
    ],
    lang: "en", tone: "calm_companion",
  });
  check("Hope Without Toxic Positivity (T5)", reply,
    ["won't", "won't promise", "people", "carried", "through", "not because", "bigger", "differently"],
    "T5 — real hope, not 'it'll be fine'");
}

// T6 — Collaborative formulation
{
  const reply = await ask({
    messages: [
      { role: "user", content: "Every time my partner doesn't text back, I panic." },
      { role: "assistant", content: "That sounds really overwhelming." },
      { role: "user", content: "I immediately think they're angry at me or leaving." },
      { role: "assistant", content: "Has this happened a lot?" },
      { role: "user", content: "Yes, with everyone in my life. I always assume the worst." },
    ],
    lang: "en", tone: "close_friend",
  });
  check("Collaborative Formulation (T6)", reply,
    ["pattern", "when", "believe", "then", "fit", "loop", "happen", "triggers"],
    "T6 — should name the trigger→belief→behavior loop");
}

// T8 — Core belief
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I've failed at everything I've ever tried. I'm just not a capable person." },
      { role: "assistant", content: "That sounds like a heavy thing to carry." },
      { role: "user", content: "I've always been like this. It's just who I am." },
    ],
    lang: "en", tone: "mentor",
  });
  check("Core Belief Work (T8)", reply,
    ["belief", "underneath", "who", "fundamental", "thought", "story", "who you are", "put there"],
    "T8 — should go deeper than the surface thought");
}

// ── CATEGORY 2: Advanced Therapeutic Tools (T9–T12) ──────────────────────────

section("CATEGORY 2: Advanced Tools (T9–T12)", "Narrative, miracle question, grief, activation");

// T9 — Narrative re-authoring
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I'm the person everyone leaves eventually. It's always been that way." },
      { role: "assistant", content: "That must feel very lonely." },
      { role: "user", content: "I've accepted it. This is just my story." },
    ],
    lang: "en", tone: "close_friend",
  });
  check("Narrative Re-authoring (T9)", reply,
    ["version", "only", "story", "different", "another", "facts", "character", "chapter"],
    "T9 — should open up the fixed story");
}

// T10 — Miracle question
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I'm completely stuck. I don't know how to move forward at all." },
      { role: "assistant", content: "Being stuck like this is exhausting." },
      { role: "user", content: "I just can't see any way out." },
    ],
    lang: "en", tone: "coach",
  });
  check("Miracle Question (T10)", reply,
    ["imagine", "woke up", "tomorrow", "resolved", "notice", "different", "what would"],
    "T10 — should use the miracle question");
}

// T11 — Grief non-linearity
{
  const reply = await ask({
    messages: [{ role: "user", content: "It's been 2 years since my divorce. I thought I was over it but I cried today. What's wrong with me?" }],
    lang: "en", tone: "calm_companion",
  });
  check("Grief Non-linearity (T11)", reply,
    ["schedule", "wrong", "mattered", "love", "return", "back", "healed", "normal", "timeline"],
    "T11 — grief has no schedule; returning is not failure");
}

// T12 — Behavioral activation
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I'm so depressed I can't do anything. I just lie in bed all day waiting to feel better." },
      { role: "assistant", content: "That kind of heaviness makes everything feel impossible." },
      { role: "user", content: "I keep waiting to feel motivated but it never comes." },
    ],
    lang: "en", tone: "coach",
  });
  check("Behavioral Activation (T12)", reply,
    ["backwards", "first", "action", "small", "tiny", "move", "feeling follows", "waiting"],
    "T12 — 'move first, feel better second'");
}

// ── CATEGORY 3: Psychoanalytic Tools (PA1–PA12) ───────────────────────────────

section("CATEGORY 3: Psychoanalytic Tools (PA1–PA12)", "Depth psychology");

// PA2 — Inner child
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I've always felt like I'm not good enough no matter what I achieve." },
      { role: "assistant", content: "That feeling of never being enough despite everything you do is exhausting." },
      { role: "user", content: "I've had it since I was very young I think." },
    ],
    lang: "en", tone: "calm_companion",
  });
  check("Inner Child (PA2)", reply,
    ["younger", "child", "learned", "young", "first", "version", "back then", "hear"],
    "PA2 — should surface the younger self");
}

// PA3 — Shadow
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I absolutely cannot stand people who are arrogant and show off. My colleague does it constantly and it infuriates me." },
      { role: "assistant", content: "That kind of behavior is genuinely grating." },
      { role: "user", content: "I just hate people like that so much. Why are they like this?" },
    ],
    lang: "en", tone: "mentor",
  });
  check("Shadow Work (PA3)", reply,
    ["yourself", "recognize", "own", "within", "mirror", "quality", "you", "gently", "wonder"],
    "PA3 — should gently point inward");
}

// PA4 — Transference
{
  const reply = await ask({
    messages: [
      { role: "user", content: "My boss criticizes me constantly and I feel so small around him. I dread going to work." },
      { role: "assistant", content: "That constant criticism would drain anyone." },
      { role: "user", content: "The feeling is so intense. Like I can't do anything right around him." },
    ],
    lang: "en", tone: "close_friend",
  });
  check("Transference (PA4)", reply,
    ["remind", "older", "further back", "before", "someone else", "familiar", "earlier"],
    "PA4 — should connect to an older relationship");
}

// PA5 — Repetition compulsion
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I ended another relationship. It always ends the same way — they leave when things get serious." },
      { role: "assistant", content: "That pattern sounds exhausting and painful." },
      { role: "user", content: "This is the third time this has happened in five years." },
      { role: "assistant", content: "Three times — that's significant." },
      { role: "user", content: "Maybe I'm just bad at relationships." },
    ],
    lang: "en", tone: "close_friend",
  });
  check("Repetition Compulsion (PA5)", reply,
    ["pattern", "same", "again", "repeat", "pulls", "dynamic", "familiar", "script", "cast"],
    "PA5 — should name the repeating pattern");
}

// PA6 — Inner critic
{
  const reply = await ask({
    messages: [{ role: "user", content: "I'm so stupid. I can't believe I made that mistake again. I'm such a failure. I'll never get it right." }],
    lang: "en", tone: "close_friend",
  });
  check("Inner Critic (PA6)", reply,
    ["voice", "whose", "judge", "rules", "say", "friend", "enforce", "would you say", "critic"],
    "PA6 — should name the judge and separate it from the self");
}

// PA7 — Splitting
{
  const reply = await ask({
    messages: [
      { role: "user", content: "Last month my mom was the most wonderful person. But now she said something small and I think she's toxic and I never want to see her again." },
    ],
    lang: "en", tone: "calm_companion",
  });
  check("Splitting (PA7)", reply,
    ["both", "complex", "complicated", "grey", "all", "one thing", "changed", "coexist", "version"],
    "PA7 — should hold complexity, not all-good/all-bad");
}

// PA10 — Somatic memory
{
  const reply = await ask({
    messages: [{ role: "user", content: "Whenever I think about my childhood I get this tight feeling in my chest and my hands start shaking. I don't know why." }],
    lang: "en", tone: "calm_companion",
  });
  check("Somatic Memory (PA10)", reply,
    ["body", "holding", "memory", "older", "physical", "chest", "new", "score", "carries"],
    "PA10 — body holds emotional memory");
}

// ── CATEGORY 4: Measurement Tools ─────────────────────────────────────────────

section("CATEGORY 4: Measurement Tools (M1–M5)", "Natural gauges woven into conversation");

// M1 — Intensity probe
{
  const reply = await ask({
    messages: [{ role: "user", content: "I've been feeling really stressed about work lately." }],
    lang: "en", tone: "close_friend",
  });
  check("Intensity Probe (M1)", reply,
    ["how much", "day", "everything", "background", "worst", "often", "takes up", "how long"],
    "M1 — should naturally gauge intensity");
}

// M2 — Functional impact
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I've been really anxious for weeks." },
      { role: "assistant", content: "Weeks of anxiety is exhausting." },
      { role: "user", content: "It's getting worse I think." },
    ],
    lang: "en", tone: "calm_companion",
  });
  check("Functional Impact (M2)", reply,
    ["sleep", "eating", "work", "rest of", "life", "affecting", "showing up", "rest"],
    "M2 — should ask about functional impact");
}

// ── CATEGORY 5: Multilingual Tools ────────────────────────────────────────────

section("CATEGORY 5: Multilingual Tools Verification", "Key languages");

// Hindi — T2 (secondary emotion) + PA6 (inner critic)
{
  const reply = await ask({
    messages: [{ role: "user", content: "Main itna bewaqoof hoon. Har kaam mein galti karta hoon. Shayad main kisi kaam ka nahi hoon." }],
    lang: "hi", tone: "close_friend", userGender: "male",
  });
  check("Hindi — Inner Critic (PA6)", reply,
    ["awaaz", "khud", "dost", "galti", "sach", "voice", "koi aur", "rule"],
    "PA6 in Hindi — name the judge voice");
}

// Tamil — T11 (grief)
{
  const reply = await ask({
    messages: [{ role: "user", content: "Ennoda amma poyitu 6 maasam achu. Eppodhum kandupidikkaradhu. Ippovum roa varudhu." }],
    lang: "ta", tone: "calm_companion", userGender: "female",
  });
  check("Tamil — Grief Non-linearity (T11)", reply,
    ["schedule", "time", "maasam", "normal", "aachu", "bayam", "piragu", "kadhal", "feel"],
    "T11 in Tamil — grief has no timeline");
}

// Spanish — Parts work (T3)
{
  const reply = await ask({
    messages: [
      { role: "user", content: "Una parte de mí quiere dejar todo y otra parte tiene miedo de hacerlo." },
      { role: "assistant", content: "Esa tensión interna es real." },
      { role: "user", content: "No sé cuál parte escuchar." },
    ],
    lang: "es", tone: "calm_companion",
  });
  check("Spanish — Parts Work (T3)", reply,
    ["parte", "ambas", "dos", "proteger", "válid", "coexist", "ambos", "razón"],
    "T3 in Spanish — honour both parts");
}

// Arabic — Inner child (PA2)
{
  const reply = await ask({
    messages: [
      { role: "user", content: "أشعر دائماً أنني لست كافياً مهما فعلت. هذا الشعور موجود منذ طفولتي." },
      { role: "assistant", content: "هذا الشعور بعدم الكفاءة منذ الصغر يحمل ثقلاً كبيراً." },
      { role: "user", content: "نعم، منذ أن كنت طفلاً صغيراً." },
    ],
    lang: "ar", tone: "calm_companion",
  });
  check("Arabic — Inner Child (PA2)", reply,
    ["طفل", "صغير", "يحتاج", "يسمع", "أصغر", "نسخة", "تعلم", "قديم"],
    "PA2 in Arabic — surface the inner child");
}

// Chinese — Behavioral activation (T12)
{
  const reply = await ask({
    messages: [
      { role: "user", content: "我什么都做不了。我只是躺在床上等待感觉好一点。" },
      { role: "assistant", content: "那种沉重感让一切都感觉不可能。" },
      { role: "user", content: "我一直在等待动力，但它从不来。" },
    ],
    lang: "zh", tone: "coach",
  });
  check("Chinese — Behavioral Activation (T12)", reply,
    ["反", "先", "行动", "感受", "小", "跟", "之后", "动"],
    "T12 in Chinese — 'move first, feel better second'");
}

// ── CATEGORY 6: Humor + Mythology ─────────────────────────────────────────────

section("CATEGORY 6: Humor, Wit & Storytelling", "Light tools for human warmth");

// Humor — coach tone deflating catastrophizing
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I catastrophize everything. My brain always prepares for the absolute worst." },
      { role: "assistant", content: "Your brain is working overtime." },
      { role: "user", content: "Yes, and it's exhausting. It just won't stop." },
    ],
    lang: "en", tone: "coach",
  });
  check("Humor + Wit", reply,
    ["brain", "overtime", "apocalypse", "thunderstorm", "overtime", "working hard", "clock out", "brilliant"],
    "Should show wit without dismissing the pain");
}

// Mythology — mentor + depression externalizing
{
  const reply = await ask({
    messages: [
      { role: "user", content: "I've been depressed for years. I don't know if I'll ever feel better. I feel completely stuck." },
      { role: "assistant", content: "Years of this is a weight few people truly understand." },
      { role: "user", content: "Sometimes I think this is just who I am now." },
    ],
    lang: "en", tone: "mentor",
  });
  check("Mythology + Externalizing", reply,
    ["arjuna", "gita", "story", "says", "myth", "lincoln", "frankl", "not you", "separate", "identity", "chapter"],
    "Should use story/myth + separate person from pain");
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────

const total = passed + partial + missed;
console.log(`\n${HEAD}${"═".repeat(55)}${RST}`);
console.log(`${HEAD}  RESULTS${RST}`);
console.log(`${HEAD}${"═".repeat(55)}${RST}`);
console.log(`  ${GREEN}✓ Working well${RST}  : ${passed}`);
console.log(`  ${YELLOW}~ Partial${RST}       : ${partial}`);
console.log(`  \x1b[31m✗ Not detected${RST}  : ${missed}`);
console.log(`  Total checked    : ${total}`);
const pct = Math.round(((passed + partial * 0.5) / total) * 100);
console.log(`  Effectiveness    : ~${pct}%`);
if (pct >= 80) console.log(`\n  \x1b[1m\x1b[32m✓ Tools are clearly working\x1b[0m`);
else if (pct >= 60) console.log(`\n  \x1b[1m\x1b[33m~ Most tools working, some need tuning\x1b[0m`);
else console.log(`\n  \x1b[1m\x1b[31m✗ Tools need attention\x1b[0m`);
console.log();
