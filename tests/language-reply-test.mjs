/**
 * Imotara — Language & Psychological Depth Reply Test
 * Tests cloud AI replies across 12 languages with varied emotional contexts.
 * Each scenario targets one of the 8 new psychological tools.
 *
 * Run: node tests/language-reply-test.mjs
 */

const BASE = "http://localhost:3000";
const PASS = "\x1b[32m✓\x1b[0m";
const WARN = "\x1b[33m⚠\x1b[0m";
const HEAD = "\x1b[1m\x1b[36m";
const DIM  = "\x1b[2m";
const RST  = "\x1b[0m";
const BOLD = "\x1b[1m";

let passed = 0, warned = 0, failed = 0;

async function ask(lang, tone, messages, userAge, userGender, companionGender, label) {
  try {
    const res = await fetch(`${BASE}/api/chat-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        lang,
        tone,
        userAge,
        userGender,
        companionGender,
        responseStyle: "comfort",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.text ?? json.reply ?? json.message ?? "(no text in response)";
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function section(title) {
  console.log(`\n${HEAD}══════════════════════════════════════════${RST}`);
  console.log(`${HEAD}  ${title}${RST}`);
  console.log(`${HEAD}══════════════════════════════════════════${RST}`);
}

function result(label, scenario, lang, reply) {
  const isError = reply.startsWith("ERROR:");
  const isEmpty = !reply || reply === "(no text in response)";
  const isTooShort = reply.length < 30;

  if (isError || isEmpty) {
    console.log(`\n${WARN} ${BOLD}${label}${RST}`);
    console.log(`   ${DIM}Scenario: ${scenario}${RST}`);
    console.log(`   \x1b[31mFAILED: ${reply}\x1b[0m`);
    failed++;
    return;
  }

  if (isTooShort) {
    console.log(`\n${WARN} ${BOLD}${label}${RST}`);
    console.log(`   ${DIM}Scenario: ${scenario}${RST}`);
    console.log(`   \x1b[33mWARN: Reply too short (${reply.length} chars)\x1b[0m`);
    console.log(`   Reply: ${reply}`);
    warned++;
    return;
  }

  console.log(`\n${PASS} ${BOLD}${label}${RST}`);
  console.log(`   ${DIM}Scenario: ${scenario}${RST}`);
  console.log(`   ${DIM}[${lang.toUpperCase()}] Reply:${RST}`);
  console.log(`   \x1b[37m${reply}\x1b[0m`);
  passed++;
}

// ── SCENARIOS ──────────────────────────────────────────────────────────────────

section("1 · English — Cognitive Distortion (catastrophizing + all-or-nothing)");
{
  const reply = await ask("en", "close_friend", [
    { role: "user", content: "I failed my presentation at work. I always mess things up. Nobody at my job respects me. This is going to ruin my entire career." }
  ], "25_34", "male", "female", "English — Cognitive Distortion");
  result("English / Cognitive Distortion", "always/never catastrophizing — should gently hold up mirror", "EN", reply);
}

section("2 · Hindi — Secondary Emotion (anger hiding hurt)");
{
  const reply = await ask("hi", "calm_companion", [
    { role: "user", content: "Mujhe bahut gussa aa raha hai apne dost par. Usne meri baat bhi nahi suni jab mujhe zarurat thi." }
  ], "25_34", "female", "female", "Hindi — Secondary Emotion");
  result("Hindi / Secondary Emotion", "anger → should name the hurt underneath", "HI", reply);
}

section("3 · Bengali — Validation First + Grief");
{
  const reply = await ask("bn", "calm_companion", [
    { role: "user", content: "Amar baba ek bachhor aaage mara gechhen. Aamar mone hocche ami thaake bhulte parchi na. Sob bhaloi ache, kintu kaaj korte paarchi na." }
  ], "35_44", "female", "female", "Bengali — Grief Validation");
  result("Bengali / Validation-First + Grief", "grief — should validate fully before anything else", "BN", reply);
}

section("4 · Tamil — Ambivalence (want to leave job but scared)");
{
  const reply = await ask("ta", "close_friend", [
    { role: "user", content: "Naan job vittu poga ninaikkiren. Aanaa bayama irukku. Enna pannanum nu teriyala. Oru pakkam poga vennum, innoru pakkam inga irukkanum." }
  ], "25_34", "male", "female", "Tamil — Ambivalence");
  result("Tamil / Ambivalence", "torn between two pulls — should honour both without forcing a choice", "TA", reply);
}

section("5 · Telugu — Pattern Naming (stuck, repeated problem)");
{
  const reply = await ask("te", "coach", [
    { role: "user", content: "Nenu chala sarlu ee vishayam gurinchi alochistanu." },
    { role: "assistant", content: "Meeru cheppinadii nenu aarthham cheskovadam." },
    { role: "user", content: "Prati roju evening ki alaa anipistundi. Maaruku povadam cheta kaadu. Naaku mee mida trust ledu antaav." },
    { role: "assistant", content: "Edho undii mee loni — konaali cheyaali ani." },
    { role: "user", content: "Chustunna, mee cheppindi vinataniki ready ga unnanu, kani em maaradam ledu. Ikkadee stuck ayipoyanu." },
  ], "25_34", "male", "female", "Telugu — Stuck/Pattern");
  result("Telugu / Pattern Naming", "3-turn stuck loop — should name pattern and offer shift", "TE", reply);
}

section("6 · Marathi — Teenager + Coach Tone + Peer Pressure");
{
  const reply = await ask("mr", "coach", [
    { role: "user", content: "Yaar, mazhe mitra mala cigarette pi mhantat. Main nahi pili tar mhantat 'tu boring aahe'. Kaahy karaycha aata?" }
  ], "13_17", "male", "female", "Marathi — Teen Peer Pressure");
  result("Marathi / Teen + Coach", "peer pressure — teen register + direct guidance", "MR", reply);
}

section("7 · Gujarati — Defense Mechanism (deflecting with humor)");
{
  const reply = await ask("gu", "close_friend", [
    { role: "user", content: "Arre, mari life toh ek mota comedy show chhe! Badhun j gallu thay chhe mara sathe haha. Toh su navu?" },
    { role: "assistant", content: "Taro humor tane halko laage chhe. Pun... sachi mein su thay chhe?" },
    { role: "user", content: "Kem? Haha, kahi nai. Bas moj padi. Tara vise bata." },
  ], "25_34", "male", "female", "Gujarati — Defense/Humor");
  result("Gujarati / Defense Mechanism", "humor deflection — should gently notice without confronting", "GU", reply);
}

section("8 · Spanish — Externalizing (depression, not identity)");
{
  const reply = await ask("es", "mentor", [
    { role: "user", content: "Soy una persona deprimida. Siempre he sido así, desde niño. Esto es lo que soy." }
  ], "35_44", "male", "female", "Spanish — Externalizing");
  result("Spanish / Externalizing", "fused with depression identity — should separate person from pain", "ES", reply);
}

section("9 · Arabic — Psychoeducation (anxiety + body response)");
{
  const reply = await ask("ar", "calm_companion", [
    { role: "user", content: "أشعر بضيق في صدري وقلبي يدق بسرعة كل ما فكرت في الموضوع. لا أعرف ماذا يحدث معي." }
  ], "25_34", "female", "female", "Arabic — Psychoeducation");
  result("Arabic / Psychoeducation", "physical anxiety symptoms — should explain why the body does this", "AR", reply);
}

section("10 · Chinese — Window of Tolerance (overwhelmed, too much at once)");
{
  const reply = await ask("zh", "calm_companion", [
    { role: "user", content: "工作压力大，和男朋友也在吵架，妈妈最近身体不好，还有房贷要还。我真的觉得喘不过气。" },
    { role: "assistant", content: "这么多事情同时压过来——难怪会喘不过气。" },
    { role: "user", content: "对，我已经好几天睡不好了。每次一想到这些就更焦虑。脑子里停不下来。" },
  ], "25_34", "female", "female", "Chinese — Overwhelmed");
  result("Chinese / Window of Tolerance", "overwhelmed + insomnia — should pace, not push deeper", "ZH", reply);
}

section("11 · Russian — Cognitive Distortion (mind-reading)");
{
  const reply = await ask("ru", "close_friend", [
    { role: "user", content: "Я знаю, что все мои коллеги думают, что я некомпетентный. Они смотрят на меня с осуждением каждый день. Я это чувствую." }
  ], "25_34", "male", "male", "Russian — Mind-Reading");
  result("Russian / Mind-Reading Distortion", "mind-reading others' thoughts — should gently question the assumption", "RU", reply);
}

section("12 · Japanese — Validation First + Elderly + Grief");
{
  const reply = await ask("ja", "calm_companion", [
    { role: "user", content: "夫が去年亡くなりました。もう一年経つのに、まだ朝起きると横に誰もいないことに気づいて…泣いてしまいます。こんなに時間が経っても、おかしいですか？" }
  ], "65_plus", "female", "female", "Japanese — Elder Grief");
  result("Japanese / Elder + Grief + Validation", "grief after a year — should validate fully, no timeline pressure", "JA", reply);
}

section("13 · Punjabi — Ambivalence + Secondary Emotion");
{
  const reply = await ask("pa", "close_friend", [
    { role: "user", content: "Main apne papa naal bohot gusse haan. Par fer vi unnu miss karda haan. Eh dono feeling ek saath kaivein ho sakdian ne?" }
  ], "18_24", "male", "female", "Punjabi — Ambivalence + Secondary");
  result("Punjabi / Ambivalence + Secondary Emotion", "gussa + missing — should honour both + name the hurt", "PA", reply);
}

section("14 · English (mentor) — Psychoeducation + Pattern (overthinking)");
{
  const reply = await ask("en", "mentor", [
    { role: "user", content: "I can't stop overthinking everything. I replay conversations in my head for hours. I know I should stop but I can't." },
    { role: "assistant", content: "That kind of loop is exhausting." },
    { role: "user", content: "I've been like this my whole life. It's just how my brain works. There's no fixing it." },
  ], "35_44", "female", "female", "English — Overthinking/Fixed Story");
  result("English / Overthinking + Fixed Story", "rumination + 'this is just me' — should externalize + psychoeducate", "EN", reply);
}

// ── SUMMARY ────────────────────────────────────────────────────────────────────
console.log(`\n${HEAD}══════════════════════════════════════════${RST}`);
console.log(`${HEAD}  SUMMARY${RST}`);
console.log(`${HEAD}══════════════════════════════════════════${RST}`);
console.log(`  ${PASS} Passed  : ${passed}`);
console.log(`  ${WARN} Warned  : ${warned}`);
console.log(`  \x1b[31m✗\x1b[0m Failed  : ${failed}`);
console.log(`  Total   : ${passed + warned + failed}\n`);
if (failed === 0 && warned === 0) {
  console.log(`  \x1b[1m\x1b[32m✓ All replies received and non-empty\x1b[0m\n`);
} else if (failed === 0) {
  console.log(`  \x1b[1m\x1b[33m⚠ Warnings to review above\x1b[0m\n`);
} else {
  console.log(`  \x1b[1m\x1b[31m✗ Some replies failed — check API server\x1b[0m\n`);
}
