import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { verifiedStoriesFor } from "@/lib/ai/orchestrator/mythologyEngine";

/**
 * Owner, 26 Oct 2026: "when you are removing false lines or stories, also try to
 * add genuine lines or stories … in different language, ethnics and cultures".
 *
 * Until then only English + the Indian languages told CHECKED stories; ten other
 * languages fell back to memory. The six world pools were checked story by story
 * — misattributed quotes and invented episodes removed, wrong facts corrected,
 * genuine material added — and every language now gets its own tradition.
 */
const SRC = fs.readFileSync(path.join(process.cwd(), "src/lib/ai/orchestrator/mythologyEngine.ts"), "utf8");
const CODE = SRC.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("every language tells checked stories from its own tradition", () => {
    it.each([
        ["ar", /Qur'an|Rumi|Saadi|Nasruddin|Prophet|Khayyam|Ibrahim ibn Adham|Sabr/],
        ["ur", /Qur'an|Rumi|Saadi|Nasruddin|Prophet|Khayyam|Ibrahim ibn Adham|Sabr/],
        ["zh", /Zhuangzi|Confucius|Tao Te Ching|Liezi|Mencius|Weaver Girl|border/],
        ["ja", /Zen|Kojiki|Kintsugi|Urashima|Nan-in|Hakuin|Ryōkan|Buddha|mono no aware|Wabi-sabi|bamboo|Pang|scorpion|proverb/],
        ["he", /Psalm|Ruth|Lamentations|Nachshon|Hillel|Nachman|Ecclesiastes|Proverbs|Genesis|Moses|Elijah|Gamzu|Tarfon|Shabbat/],
        ["ru", /Russian|Tolstoy|Chekhov|Dostoevsky|Pushkin/],
        ["es", /Greek|Iliad|Odyssey|Aesop|Seneca|Epictetus|Luke|Andersen|Fontaine|Camus|Euripides|Prometheus|Heracles|Atlas|Delphi|Persephone|Orpheus|Perseus|Penelope|Sisyphus/],
    ])("%s gets 8 stories, all from its tradition", (lang, tradition) => {
        const s = verifiedStoriesFor(lang as string, 11)!;
        expect(s).toHaveLength(8);
        for (const v of s) expect(v.text).toMatch(tradition as RegExp);
    });

    it("English and the Indian languages keep the Indian pool", () => {
        for (const lang of ["en", "bn", "hi", "pa", "ta"]) {
            expect(verifiedStoriesFor(lang, 3)!.some((v) => /Mahabharata|Ramayana|Buddha|Kabir|Thirukkural|Guru|Upanishad|Siddhartha|Savitri|Sikh|Puranas|Jataka|Panchatantra|old texts|Gita/.test(v.text))).toBe(true);
        }
    });
});

describe("⛔ Russian stories never sit beside Norse ones", () => {
    // Measured 26 Oct: with one shared pool, a Russian reply called a Russian
    // fairy tale "Norwegian". Russian gets its own pool, and every line names it.
    it("ru never gets a Norse story", () => {
        for (let seed = 0; seed < 40; seed++) {
            for (const v of verifiedStoriesFor("ru", seed)!) expect(v.text).not.toMatch(/Norse|Hávamál|Baldur|Odin|Norns|Völsunga|Yggdrasil|Fimbulwinter/);
        }
    });
});

describe("⛔ removed misattributions and inventions stay removed", () => {
    it.each([
        ["Rumi 'Yesterday I was clever'", "Yesterday I was clever"],
        ["Ladinsky's line credited to Hafez", "the sun never says to the earth"],
        ["a loose rendering credited to Rumi", "lip of insanity"],
        ["a loose rendering credited to Rumi", "Why do you stay in prison"],
        ["an unsourced story about the Prophet", "throw garbage"],
        ["an invented Nasruddin story", "A tiger is chasing me"],
        ["an invented dervish story", "ankle-deep"],
        ["an invented Zen mirror story", "held up a mirror"],
        ["an unsourced 'weep because I weep'", "I weep because I weep"],
        ["an invented Talmudic story", "Tell me the story three times"],
        ["an invented Golem detail", "could not observe Shabbat"],
        ["an unsourced Baal Shem Tov quote", "God is found"],
        ["an invented Fimbulwinter detail", "Even the gods were tired"],
        ["an invented Yellow Emperor ending", "recognizing what was already there"],
        ["an invented Miriam's Well detail", "wherever songs were sung"],
    ])("%s", (_label, gone) => {
        expect(CODE).not.toContain(gone);
    });
});

describe("✅ corrected facts stay corrected", () => {
    it("Joseph is in Genesis, not the Mahabharata", () => {
        expect(CODE).not.toMatch(/Mahabharata, Joseph/);
        expect(CODE).toMatch(/In Genesis, Joseph was sold into slavery/);
    });

    it("Achilles did not 'refuse to fight' after Patroclus died", () => {
        expect(CODE).not.toMatch(/refusing to eat, refusing to fight/);
    });

    it("Perseus used a polished shield, not 'a mirror'", () => {
        expect(CODE).toMatch(/reflection in a polished shield/);
    });

    it("Baldur was killed by the blind Höðr, guided by Loki", () => {
        expect(CODE).toMatch(/guided the blind god Höðr to throw it/);
    });

    it("'Hurry slowly' is not passed off as Russian", () => {
        expect(CODE).not.toMatch(/Russian proverb: 'Hurry slowly'/);
    });

    it("the Buddha's refused insult is credited to the Buddha", () => {
        expect(CODE).toMatch(/a man insulted the Buddha to his face/);
    });
});

describe("every pool can serve every feeling", () => {
    it("each tradition has at least 3 stories for sad, anxious, angry and tired", () => {
        for (const lang of ["en", "ar", "zh", "ja", "he", "ru", "es"]) {
            const all = new Set<string>();
            for (let seed = 0; seed < 60; seed++) for (const v of verifiedStoriesFor(lang, seed)!) all.add(`${v.theme}|${v.text}`);
            const perTheme: Record<string, number> = {};
            for (const k of all) { const t = k.split("|")[0]; perTheme[t] = (perTheme[t] ?? 0) + 1; }
            expect(Object.keys(perTheme)).toHaveLength(4);
            for (const n of Object.values(perTheme)) expect(n).toBeGreaterThanOrEqual(3);
        }
    });
});
