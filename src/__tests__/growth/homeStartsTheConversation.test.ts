// src/__tests__/growth/homeStartsTheConversation.test.ts
// 🔑 #91 / #77a (7 Nov 2026): GA — the home page held people 7 s on average and
// only 18% reached /chat; day-1 return 3.7%. The home page now asks "How are
// you feeling right now?" and one tap carries a written opener into the chat
// box, in the person's language. They still press send themselves.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { HOME_MOODS, moodStarter } from "@/lib/imotara/homeMoods";

const byLang = {
  en: [
    { emoji: "😊", label: "Good", starter: "I'm feeling pretty good today." },
    { emoji: "😔", label: "Sad", starter: "I've been feeling sad and I'm not sure why." },
    { emoji: "🌧️", label: "Lonely", starter: "I feel kind of lonely right now." },
  ],
  bn: [{ emoji: "😔", label: "মন খারাপ", starter: "কেন জানি না, মন খারাপ।" }],
  he: [{ emoji: "😵", label: "מבולבל", starter: "אני מבולבל/ת" }],
};

describe("the opener, in the person's language", () => {
  it("Bengali speaker taps Sad ⇒ the Bengali line", () => {
    expect(moodStarter("sad", "bn", byLang)).toBe("কেন জানি না, মন খারাপ।");
  });
  it("a language without that mood ⇒ the English line, never a different feeling", () => {
    expect(moodStarter("sad", "he", byLang)).toBe("I've been feeling sad and I'm not sure why.");
    expect(moodStarter("lonely", "xx", byLang)).toBe("I feel kind of lonely right now.");
  });
  it("an unknown or missing key ⇒ nothing is written", () => {
    expect(moodStarter("hacked<script>", "en", byLang)).toBeNull();
    expect(moodStarter(null, "en", byLang)).toBeNull();
  });
});

describe("every home mood exists in the chat page's own English row", () => {
  const chat = readFileSync("src/app/chat/page.tsx", "utf8");
  const start = chat.indexOf("const MOOD_OPTIONS_BY_LANG");
  const enRow = chat.slice(start, chat.indexOf("hi: [", start));
  it.each(HOME_MOODS.map((m) => [m.key, m.emoji]))("%s (%s)", (_k, emoji) => {
    expect(enRow).toContain(`emoji: "${emoji}"`);
  });
});

describe("wiring", () => {
  const home = readFileSync("src/app/HomeClient.tsx", "utf8");
  const chat = readFileSync("src/app/chat/page.tsx", "utf8");
  it("home asks the question and links each mood by KEY (no words in the URL)", () => {
    expect(home).toMatch(/How are you feeling right now\?/);
    expect(home).toMatch(/href=\{`\/chat\?mood=\$\{m\.key\}`\}/);
    expect(home).toMatch(/gaEvent\("home_mood", \{ mood: m\.key \}\)/);
    expect(home).toMatch(/<span>Start talking<\/span>/);
  });
  it("chat reads ?mood, fills the box (never sends), and skips the intake questions", () => {
    expect(chat).toMatch(/const urlMood = \(searchParams\?\.get\("mood"\) \?\? ""\)\.trim\(\);/);
    const effect = chat.slice(chat.indexOf("const moodPrefillRef"), chat.indexOf("}, [mounted, urlMood, activeIsEmpty, preferredLang, draft]);"));
    expect(effect).toMatch(/setDraft\(starter\)/);
    expect(effect).not.toMatch(/sendMessage|handleSend|onSend\(/);
    expect(chat).toMatch(/skipIntake=\{!!moodStarter\(urlMood, preferredLang, MOOD_OPTIONS_BY_LANG\)\}/);
    expect(chat).toMatch(/if \(skipIntake\) return;\s*\n\s*if \(!localStorage\.getItem\(INTAKE_DONE_KEY\)\) setIntakeStep\(1\);/);
  });
  it("⛔ never overwrites what the person typed or cleared", () => {
    expect(chat).toMatch(/moodPrefillRef\.current === null \? draft !== "" : draft !== moodPrefillRef\.current\) return;/);
  });
});

describe("⛔ nothing covers the chat box on a first visit (seen live 7 Nov)", () => {
  const banner = readFileSync("src/components/imotara/FirstVisitBanner.tsx", "utf8");
  const notice = readFileSync("src/components/imotara/LocalDataNotice.tsx", "utf8");
  it("both bottom banners stay off /chat, and HIDE if already up from the page before", () => {
    expect(banner).toMatch(/SUPPRESS_PATHS = \["\/admin", "\/help", "\/chat"\]/);
    expect(notice).toMatch(/SUPPRESS_PATHS = \["\/admin", "\/help", "\/chat"\]/);
    expect(banner).toMatch(/if \(hideHere\) setShow\(false\);/);
    expect(notice).toMatch(/\{ setVisible\(false\); return; \}/);
  });
  it("the first-visit cloud default STILL runs for someone who lands straight in Chat", () => {
    expect(banner).toMatch(/if \(hideHere && !pathname\.startsWith\("\/chat"\)\) return;/);
    const i = banner.indexOf('if (hideHere && !pathname.startsWith("/chat")) return;');
    expect(banner.indexOf('saveConsentMode("allow-remote")', i)).toBeGreaterThan(i);
  });
  it("'empty' means the person has not written yet — the welcome line does not count", () => {
    const chat = readFileSync("src/app/chat/page.tsx", "utf8");
    expect(chat).toMatch(/const activeIsEmpty = !activeThread \|\| !activeThread\.messages\.some\(\(m\) => m\.role === "user"\);/);
  });
});
