/**
 * A sentence is terminated by the script it is WRITTEN in, not by the
 * language it is labelled with.
 *
 * The terminator used to be chosen from `lang` alone, which assumes language
 * implies script. It does not — the product deliberately mirrors whatever
 * script the person wrote in, and most Indic users type romanized. So a
 * Bengali reply in Latin letters was terminated with a danda:
 *
 *   "ami bujhte parchi eta tomar jonno khub kothin hocche ekhon।"
 *
 * and Urdu in Latin letters got "۔". Reproduced against the formatter
 * 2026-09-12. Azure's voices have been heard reading such marks aloud —
 * see formatter.dandaLanguages.test.ts, the 2026-08-14 report this extends.
 *
 * The terminator is also derived PER PHASE now: a reply is assembled from
 * several pieces which are not always in the same script, and one terminator
 * for the whole reply put a Latin period on a Bengali word while still
 * ending the message with a danda.
 */
import { describe, it, expect } from "vitest";
import { nativeScriptTerminator } from "@/lib/imotara/response/responseFormatter";

describe("romanized text always takes a plain period", () => {
    it.each([
        ["bn", "ami bujhte parchi eta tomar jonno kothin"],
        ["hi", "main samajh sakta hoon ki yeh mushkil hai"],
        ["ur", "main samajh sakta hoon ke yeh mushkil hai"],
        ["pa", "main samajh sakda haan"],
        ["or", "mun bujhi paruchi"],
        ["ja", "wakarimasu"],
        ["zh", "wo mingbai"],
    ])("%s in Latin letters -> .", (lang, text) => {
        expect(nativeScriptTerminator(lang, text)).toBe(".");
    });
});

describe("native script keeps its own terminator", () => {
    it("Hindi in Devanagari takes a danda", () => {
        expect(nativeScriptTerminator("hi", "मैं ठीक हूँ")).toBe("।");
    });
    it("Bengali in Bengali script takes a danda", () => {
        expect(nativeScriptTerminator("bn", "আমি ঠিক আছি")).toBe("।");
    });
    it("Urdu in Arabic script takes its own full stop", () => {
        expect(nativeScriptTerminator("ur", "میں ٹھیک ہوں")).toBe("۔");
    });
    it.each([["ja", "わかります"], ["zh", "我明白"]])("%s takes the CJK stop", (l, t) => {
        expect(nativeScriptTerminator(l, t)).toBe("。");
    });
});

describe("languages that use a period even in their own script", () => {
    // The 2026-08-14 finding: Marathi shares Devanagari with Hindi but does
    // NOT use danda, and nor do Gujarati/Tamil/Telugu/Kannada/Malayalam.
    it("Marathi in Devanagari takes a period, not a danda", () => {
        expect(nativeScriptTerminator("mr", "मला समजतं")).toBe(".");
    });
    it.each([
        ["ta", "எனக்கு புரியுது"],
        ["te", "నాకు అర్థమైంది"],
        ["gu", "મને સમજાય છે"],
        ["kn", "ನನಗೆ ಅರ್ಥವಾಗುತ್ತದೆ"],
        ["ml", "എനിക്ക് മനസ്സിലാകുന്നു"],
    ])("%s takes a period", (l, t) => {
        expect(nativeScriptTerminator(l, t)).toBe(".");
    });
});

describe("English and anything unknown", () => {
    it.each(["en", "fr", "de", "es", "id", "he", "ar", "zz"])("%s -> .", (l) => {
        expect(nativeScriptTerminator(l, "some text")).toBe(".");
    });
    it("empty text never crashes", () => {
        expect(nativeScriptTerminator("bn", "")).toBe(".");
    });
});

describe("the assembled reply terminates each piece by its own script", () => {
    // A reply is built from a reaction, the model body and a bridge, and they
    // are not always in the same script. A single reply-wide terminator put a
    // Latin period on a Bengali word ("সত্যি.") while still ending the whole
    // message with a danda after romanized text.
    it("Bengali furniture keeps its danda while a romanized body takes a period", async () => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({
            raw: "ami bujhte parchi eta tomar jonno khub kothin hocche ekhon",
            lang: "bn", userMessage: "help",
        } as never);
        // the romanized sentence must NOT be closed with a danda
        expect(out).not.toMatch(/[A-Za-z]\s*।/);
        // and a Bengali word must NOT be closed with a Latin period
        expect(out).not.toMatch(/[ঀ-৿]\s*\./);
    });

    it("Hindi: romanized body never takes a danda", async () => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({
            raw: "main samajh sakta hoon ki yeh tumhare liye abhi bahut mushkil hai",
            lang: "hi", userMessage: "help",
        } as never);
        expect(out).not.toMatch(/[A-Za-z]\s*।/);
    });

    it("Urdu: romanized body never takes the Urdu full stop", async () => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({
            raw: "main samajh sakta hoon ke yeh tumhare liye abhi bohot mushkil hai",
            lang: "ur", userMessage: "help",
        } as never);
        expect(out).not.toMatch(/[A-Za-z]\s*۔/);
    });
});

/**
 * One reply, one script.
 *
 * The reaction and bridge banks in the formatter are written in each
 * language's own script, but the model's body follows whatever script the
 * person wrote in. Assembling the two produced replies in two scripts at
 * once — the same fault fixed in the offline engine (mobile 08a3de1):
 *
 *   "সত্যি। ami bujhte parchi eta tomar jonno khub kothin hocche ekhon."
 *   "हम्म… main samajh sakta hoon ki yeh tumhare liye mushkil hai."
 *
 * Romanized bodies now skip the native furniture and return the model's own
 * words. Native-script bodies keep the full three phases.
 */
describe("a reply is never assembled from two scripts", () => {
    const mixed = (s: string) =>
        /[ঀ-৿ऀ-ॿ؀-ۿ஀-௿ఀ-౿઀-૿਀-੿ಀ-೿ഀ-ൿ]/.test(s) && /[A-Za-z]{3}/.test(s);

    it.each([
        ["bn", "ami bujhte parchi eta tomar jonno khub kothin hocche ekhon"],
        ["hi", "main samajh sakta hoon ki yeh tumhare liye abhi bahut mushkil hai"],
        ["ur", "main samajh sakta hoon ke yeh tumhare liye abhi bohot mushkil hai"],
        ["ta", "enakku puriyudhu idhu unakku ippo romba kashtama irukku"],
        ["mr", "mala samajhte ki he tumchyasathi khup kathin aahe aata"],
    ])("%s romanized body comes back in one script", async (lang, raw) => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({ raw, lang, userMessage: "help" } as never);
        expect(mixed(out)).toBe(false);
        // and the model's own words survive
        expect(out).toContain(raw.slice(0, 25));
    });

    it.each([
        ["bn", "আমি বুঝতে পারছি এটা তোমার জন্য খুব কঠিন হচ্ছে এখন"],
        ["hi", "मैं समझ सकता हूँ कि यह तुम्हारे लिए अभी बहुत मुश्किल है"],
    ])("%s native body keeps its full shape", async (lang, raw) => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({ raw, lang, userMessage: "help" } as never);
        expect(mixed(out)).toBe(false);
        // Native replies must still get the reaction/bridge phases. Checking
        // for the phase separator, not just "longer" — suppression appends a
        // terminator and so also makes it one character longer.
        expect(out).toContain("\n");
        expect(out.length).toBeGreaterThan(raw.length + 20);
    });

    it("a native body carrying a few English words is still treated as native", async () => {
        // Indic replies routinely borrow English words ("steady", "manageable").
        // Without a floor on Latin characters, such a reply would be mistaken
        // for romanized and lose its phases.
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const raw = "मैं समझ सकता हूँ कि यह अभी बहुत overwhelming और difficult लग रहा है";
        const out = formatImotaraReply({ raw, lang: "hi", userMessage: "help" } as never);
        expect(out).toContain("\n");
        expect(out.length).toBeGreaterThan(raw.length + 20);
    });

    it("English is unaffected and keeps its three phases", async () => {
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const raw = "I can tell this is really hard for you right now";
        const out = formatImotaraReply({ raw, lang: "en", userMessage: "help" } as never);
        expect(out.length).toBeGreaterThan(raw.length);
    });

    it("a short romanized body is not swallowed", async () => {
        // Below the length floor the normal pipeline still runs, so the reply
        // is never left empty.
        const { formatImotaraReply } = await import("@/lib/imotara/response/responseFormatter");
        const out = formatImotaraReply({ raw: "accha", lang: "hi", userMessage: "help" } as never);
        expect(out.trim().length).toBeGreaterThan(0);
    });
});
