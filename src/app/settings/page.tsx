"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { saveHistory } from "@/lib/imotara/historyPersist";
import { useAppearance, type Accent, type FontSize, type ColorMode } from "@/hooks/useAppearance";
import EmotionalFingerprint from "@/components/imotara/EmotionalFingerprint";

const CHAT_STORAGE_KEY = "imotara.chat.v1";

// Cross-device Chat Link Key (same value on web + mobile => same remote chat scope)
const CHAT_LINK_KEY = "imotara.linkKey.v1";

// Local-first donation receipts — written immediately on payment success
// so users always see their history even without server auth.
const LOCAL_DONATIONS_KEY = "imotara.donations.v1";

type LocalDonationReceipt = {
    paymentId: string;
    orderId?: string;
    amount: number; // paise
    currency: string;
    timestamp: number; // epoch ms
};

function loadLocalDonations(): LocalDonationReceipt[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(LOCAL_DONATIONS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveLocalDonation(receipt: LocalDonationReceipt) {
    try {
        const existing = loadLocalDonations();
        // Deduplicate by paymentId
        const deduped = existing.filter((r) => r.paymentId !== receipt.paymentId);
        const updated = [receipt, ...deduped].slice(0, 20); // keep last 20
        window.localStorage.setItem(LOCAL_DONATIONS_KEY, JSON.stringify(updated));
    } catch {
        // ignore quota errors
    }
}




// NOTE: "imotara.profile.v1" is owned by the Tone & Context profile (ImotaraProfileV1) below.
// Do not define a second schema for the same storage key, otherwise settings will reset.

/** Razorpay Checkout (web) */
declare global {
    interface Window {
        Razorpay?: any;
    }
}

type DonationIntentResponse = {
    ok: boolean;
    razorpay?: {
        orderId: string;
        keyId: string;
        amount: number; // paise
        currency: string; // INR
    };
    error?: string;
};

type LicenseStatusResponse = {
    ok?: boolean;
    tier?: string; // "FREE" | "PREMIUM" ...
    mode?: string; // "off" | "log" | "enforce"
    message?: string;
    error?: string;
    license?: {
        status?: string; // "valid" | "trial" | "expired"
        tier?: string;
        mode?: string;
        source?: string;
        expiresAt?: string | null;
    };
};

// ===== NEW: Tone & Context Preferences (local-only) =====

type Gender = "female" | "male" | "nonbinary" | "prefer_not" | "other";
type AgeRange =
    | "under_13"
    | "13_17"
    | "18_24"
    | "25_34"
    | "35_44"
    | "45_54"
    | "55_64"
    | "65_plus"
    | "prefer_not";

type SupportedLang =
    | "en" | "hi" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "kn" | "ml" | "or"
    | "ur" | "zh" | "es" | "ar" | "fr" | "pt" | "ru" | "id" | "he" | "de" | "ja";
type ResponseStyle = "comfort" | "reflect" | "motivate" | "advise";

type ImotaraProfileV1 = {
    user: {
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
        preferredLang?: SupportedLang;
        responseStyle?: ResponseStyle; // #16
        avatarAge?: number;
    };
    companion: {
        enabled?: boolean;
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
        avatarAge?: number;
        relationship?:
        | "mentor"
        | "friend"
        | "elder"
        | "coach"
        | "sibling"
        | "junior_buddy"
        | "parent_like"
        | "partner_like"
        | "prefer_not";
    };
};

const PROFILE_STORAGE_KEY = "imotara.profile.v1";

function safeParseProfile(json: string | null): ImotaraProfileV1 | null {
    if (!json) return null;
    try {
        return JSON.parse(json) as ImotaraProfileV1;
    } catch {
        return null;
    }
}

// ── Voice preview helpers (mirrors chat/page.tsx gender-aware logic) ──────────

const LANG_TO_BCP47_SETTINGS: Record<string, string> = {
    en: "en-US", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN",
    ta: "ta-IN", te: "te-IN", gu: "gu-IN", pa: "pa-IN",
    kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-PK",
    ar: "ar-SA", zh: "zh-CN", es: "es-ES", fr: "fr-FR",
    pt: "pt-BR", ru: "ru-RU", id: "id-ID", he: "he-IL",
    de: "de-DE", ja: "ja-JP",
};

const FEMALE_PAT = /\b(female|woman|girl|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|emily|nancy|lisa|kate|susan|natasha|anna|ava|allison|noelle|zoe|olivia|heather|monica|serena|vicki|hazel|lekha|veena|damayanti|kanya)\b/i;
const MALE_PAT   = /\b(male|man|alex|tom|daniel|liam|david|james|mark|richard|aaron|evan|reed|bruce|fred|gordon|lee|rishi|aarav|hemant|kabir)\b/i;

// Gender mapping to the two preview file variants (nonbinary/other/prefer_not → female file)
function previewGenderFile(gender: string): "male" | "female" {
    return gender === "male" ? "male" : "female";
}

// Localised preview sentences — one per supported language
const PREVIEW_TEXT_BY_LANG: Record<string, string> = {
    en: "Hi, I'm Imotara. I'm here with you.",
    hi: "नमस्ते, मैं इमोतारा हूँ. मैं आपके साथ हूँ।",
    mr: "नमस्कार, मी इमोतारा आहे. मी तुमच्यासोबत आहे।",
    bn: "হ্যালো, আমি ইমোতারা. আমি তোমার সাথে আছি।",
    ta: "வணக்கம், நான் இமோதாரா. நான் உங்களுடன் இருக்கிறேன்.",
    te: "నమస్కారం, నేను ఇమోతారా. నేను మీతో ఉన్నాను.",
    gu: "નમસ્તે, હું ઇમોતારા છું. હું તમારી સાથે છું.",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਇਮੋਤਾਰਾ ਹਾਂ. ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਹਾਂ।",
    kn: "ನಮಸ್ಕಾರ, ನಾನು ಇಮೋತಾರ. ನಾನು ನಿಮ್ಮೊಂದಿಗೆ ಇದ್ದೇನೆ.",
    ml: "ഹലോ, ഞാൻ ഇമോതാര. ഞാൻ നിങ്ങളോടൊപ്പം ഉണ്ട്.",
    or: "ନମସ୍କାର, ମୁଁ ଇମୋତାରା. ମୁଁ ଆପଣଙ୍କ ସହ ଅଛି।",
    ur: "ہیلو، میں امتارا ہوں. میں آپ کے ساتھ ہوں۔",
    zh: "你好，我是 Imotara。我在你身边。",
    es: "Hola, soy Imotara. Estoy aqui contigo.",
    ar: "مرحباً، أنا إيموتارا. أنا هنا معك.",
    fr: "Bonjour, je suis Imotara. Je suis la pour vous.",
    pt: "Ola, sou o Imotara. Estou aqui com voce.",
    ru: "Привет, я Имотара. Я здесь рядом с тобой.",
    id: "Halo, saya Imotara. Saya di sini bersamamu.",
    he: "שלום, אני אימוטרה. אני כאן איתך.",
    de: "Hallo, ich bin Imotara. Ich bin fuer dich da.",
    ja: "こんにちは、私はイモタラです。ここにいますよ。",
};

function speakPreview(gender: string, lang: string, name?: string, onResult?: (info: string, missing: boolean) => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    // Snapshot voices BEFORE cancel() — Chrome/macOS temporarily reduces the
    // voice list right after cancel(), which would cause wrong voice selection.
    const voiceSnapshot = synth.getVoices();

    synth.cancel();
    const bcp47 = LANG_TO_BCP47_SETTINGS[lang] ?? "en-US";

    const doSpeak = () => {
        const liveVoices = synth.getVoices();
        const voices = voiceSnapshot.length > 0 ? voiceSnapshot : liveVoices;
        if (voices.length === 0) {
            synth.onvoiceschanged = () => { synth.onvoiceschanged = null; doSpeak(); };
            return;
        }

        const nm      = (v: SpeechSynthesisVoice) => v.name.toLowerCase();
        const isMaleV = (v: SpeechSynthesisVoice) => MALE_PAT.test(nm(v));
        const isFemV  = (v: SpeechSynthesisVoice) => FEMALE_PAT.test(nm(v));
        const langBase = bcp47.split("-")[0];

        const effectiveName = name?.trim() || "Imotara";
        const hasCustomName = effectiveName !== "Imotara";

        // Non-English: always use pre-generated Azure MP3s for accurate language
        // and gender-specific voice. Then play a short English name greeting after.
        if (lang !== "en") {
            const genderFile = previewGenderFile(gender);
            const src = `/tts-preview/${lang}-${genderFile}.mp3`;
            onResult?.(`Azure Neural (${lang}-${genderFile})`, false);
            const audio = new Audio(src);
            audio.playbackRate = 0.95;
            if (hasCustomName) {
                // After the language MP3 finishes, speak the name in English
                audio.onended = () => {
                    const synth2 = window.speechSynthesis;
                    const nameUtt = new SpeechSynthesisUtterance(`I'm ${effectiveName}.`);
                    nameUtt.lang  = "en-US";
                    nameUtt.rate  = 0.95;
                    synth2.speak(nameUtt);
                };
            }
            audio.play().catch(err => console.warn("[speakPreview] audio play failed:", err));
            return;
        }

        // English: use native Web Speech API with gender selection.
        const previewText = hasCustomName
            ? `Hi, I'm ${effectiveName}. I'm here with you.`
            : PREVIEW_TEXT_BY_LANG["en"];

        const langPool = voices.filter(
            v => v.lang === bcp47 || v.lang.startsWith(langBase + "-") || v.lang === langBase,
        );
        const pool = langPool.length > 0 ? langPool : voices;
        let voice: SpeechSynthesisVoice;
        if (gender === "male") {
            voice = pool.find(isMaleV) ?? pool.find(v => !isFemV(v)) ?? pool[0];
        } else if (gender === "female") {
            voice = pool.find(isFemV) ?? pool.find(v => !isMaleV(v)) ?? pool[0];
        } else {
            voice = pool[0];
        }
        onResult?.(`${voice.name} (${voice.lang})`, false);

        const utt = new SpeechSynthesisUtterance(previewText);
        utt.lang  = voice.lang;
        utt.rate  = 0.95;
        utt.pitch = 1.0;
        utt.voice = voice;
        synth.speak(utt);
    };

    setTimeout(doSpeak, 100);
}

// ──────────────────────────────────────────────────────────────────────────────

const AVATAR_AGES = [6, 16, 26, 36, 46, 56, 66, 76, 86, 96];

const AGE_RANGE_TO_AVATAR: Record<string, number> = {
    prefer_not: 26,
    under_13: 6,
    "13_17": 16,
    "18_24": 26,
    "25_34": 26,
    "35_44": 36,
    "45_54": 46,
    "55_64": 56,
    "65_plus": 66,
};

const AVATAR_AGE_LABEL: Record<number, string> = {
    6:  "Under 13",
    16: "13–17",
    26: "18–34",
    36: "35–44",
    46: "45–54",
    56: "55–64",
    66: "65–75",
    76: "76–85",
    86: "86–95",
    96: "96+",
};

function AvatarSlider({
    gender,
    ageValue,
    onChange,
    name,
}: {
    gender: Gender;
    ageValue: number;
    onChange: (age: number) => void;
    name?: string;
}) {
    const enabled = gender === "male" || gender === "female";
    const idx = AVATAR_AGES.indexOf(ageValue);
    const safeIdx = idx === -1 ? 2 : idx;

    return (
        <div className="grid gap-2">
            <span className="text-xs text-zinc-300">Avatar appearance</span>
            {enabled ? (
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                            <img
                                key={`${gender}-${AVATAR_AGES[safeIdx]}`}
                                src={`/avatars/${gender}/${AVATAR_AGES[safeIdx]}.png`}
                                alt={`${gender} age ${AVATAR_AGES[safeIdx]}`}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        {name && (
                            <span className="max-w-[64px] truncate text-center text-[11px] font-medium text-zinc-300">
                                {name}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 grid gap-1">
                        <input
                            type="range"
                            min={0}
                            max={9}
                            value={safeIdx}
                            onChange={(e) => onChange(AVATAR_AGES[parseInt(e.target.value)])}
                            className="w-full accent-emerald-400"
                        />
                        <span className="text-[11px] text-zinc-400 text-center">{AVATAR_AGE_LABEL[AVATAR_AGES[safeIdx]]}</span>
                    </div>
                </div>
            ) : (
                <p className="text-[11px] text-zinc-500">
                    Set Gender to <strong className="text-zinc-300">Male</strong> or <strong className="text-zinc-300">Female</strong> above to choose an avatar.
                </p>
            )}
        </div>
    );
}

function TinyBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-white/10">
            {children}
        </span>
    );
}

function ToneAndContextTile() {
    const [loaded, setLoaded] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "auto" | "manual" | "error" | "reset" } | null>(null);
    const [userVoiceInfo, setUserVoiceInfo] = useState<{ text: string; missing: boolean } | null>(null);
    const [compVoiceInfo, setCompVoiceInfo] = useState<{ text: string; missing: boolean } | null>(null);

    // Personal info
    const [userName, setUserName] = useState("");
    const [userAge, setUserAge] = useState<AgeRange>("prefer_not");
    const [userGender, setUserGender] = useState<Gender>("prefer_not");
    const [preferredLang, setPreferredLang] = useState<SupportedLang | "auto">("en");
    const [responseStyle, setResponseStyle] = useState<ResponseStyle | "auto">("auto"); // #16

    // Expected companion details (tone guidance)
    const [compEnabled, setCompEnabled] = useState(false);
    const [compName, setCompName] = useState("");

    // ITEM 6: focus tracking for character counters
    const [userNameFocused, setUserNameFocused] = useState(false);
    const [compNameFocused, setCompNameFocused] = useState(false);
    const USER_NAME_MAX = 50;
    const COMP_NAME_MAX = 50;
    const [compAge, setCompAge] = useState<AgeRange>("prefer_not");
    const [compGender, setCompGender] = useState<Gender>("prefer_not");
    const [compRel, setCompRel] = useState<
        | "mentor"
        | "friend"
        | "sibling"
        | "junior_buddy"
        | "elder"
        | "coach"
        | "parent_like"
        | "partner_like"
        | "prefer_not"
    >("prefer_not");
    const [userAvatarAge, setUserAvatarAge] = useState<number>(26);
    const [compAvatarAge, setCompAvatarAge] = useState<number>(26);
    // GAP-12: Teen Mode toggle
    const [teenMode, setTeenMode] = useState(false);

    useEffect(() => {
        // Hydration-safe: only read localStorage after mount
        const existing = safeParseProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
        const savedTeenMode = window.localStorage.getItem("imotara.teen_mode.v1");
        if (savedTeenMode === "true") setTeenMode(true);
        if (existing) {
            setUserName(existing.user?.name ?? "");
            setUserAge((existing.user?.ageRange as AgeRange) ?? "prefer_not");
            setUserGender((existing.user?.gender as Gender) ?? "prefer_not");
            setPreferredLang((existing.user?.preferredLang as SupportedLang) ?? "en");
            setResponseStyle((existing.user?.responseStyle as ResponseStyle) ?? "auto");

            const enabled = !!existing.companion?.enabled;
            setCompEnabled(enabled);
            setCompName(existing.companion?.name ?? "");
            setCompAge((existing.companion?.ageRange as AgeRange) ?? "prefer_not");
            setCompGender((existing.companion?.gender as Gender) ?? "prefer_not");
            setCompRel((existing.companion?.relationship as any) ?? "prefer_not");
            setUserAvatarAge(existing.user?.avatarAge ?? 26);
            setCompAvatarAge(existing.companion?.avatarAge ?? 26);
        }
        setLoaded(true);
    }, []);

    const profile: ImotaraProfileV1 = useMemo(() => {
        return {
            user: {
                name: userName.trim() || undefined,
                ageRange: userAge === "prefer_not" ? undefined : userAge,
                gender: userGender === "prefer_not" ? undefined : userGender,
                preferredLang: preferredLang === "auto" ? undefined : preferredLang,
                responseStyle: responseStyle === "auto" ? undefined : responseStyle,
                avatarAge: (userGender === "male" || userGender === "female") ? userAvatarAge : undefined,
            },
            companion: {
                enabled: compEnabled,
                name: compEnabled ? (compName.trim() || undefined) : undefined,
                ageRange: compEnabled ? (compAge === "prefer_not" ? undefined : compAge) : undefined,
                gender: compEnabled ? (compGender === "prefer_not" ? undefined : compGender) : undefined,
                avatarAge: compEnabled && (compGender === "male" || compGender === "female") ? compAvatarAge : undefined,
                relationship: compEnabled ? (compRel === "prefer_not" ? undefined : compRel) : undefined,
            },
        };
    }, [userName, userAge, userGender, preferredLang, responseStyle, compEnabled, compName, compAge, compGender, compRel, userAvatarAge, compAvatarAge]);

    // ✅ NEW: visual "active" state (green) for selects once a real choice is set
    const selectActiveClass = (active: boolean) =>
        active ? "border-emerald-400/40 text-emerald-200" : "";

    // ✅ NEW: Auto-save on change (fixes reset when navigating to Chat and back)
    useEffect(() => {
        if (!loaded) return;
        try {
            window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
            window.dispatchEvent(new CustomEvent("imotara:profile-updated", { detail: profile }));
        } catch (e) {
            console.error("[imotara] profile autosave failed:", e);
        }
    }, [loaded, profile]);

    // GAP-12: persist teen mode
    useEffect(() => {
        if (!loaded) return;
        try { window.localStorage.setItem("imotara.teen_mode.v1", String(teenMode)); } catch { /* ignore */ }
    }, [loaded, teenMode]);

    function save() {
        try {
            window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
            window.dispatchEvent(new CustomEvent("imotara:profile-updated", { detail: profile }));
            setToast({ message: "Saved ✓", type: "manual" });
            window.setTimeout(() => setToast(null), 1800);
        } catch (e) {
            console.error("[imotara] profile save failed:", e);
            setToast({ message: "Save failed", type: "error" });
            window.setTimeout(() => setToast(null), 2200);
        }
    }

    function reset() {
        try {
            window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch {
            // ignore
        }
        setUserName("");
        setUserAge("prefer_not");
        setUserGender("prefer_not");
        setPreferredLang("en");
        setResponseStyle("auto");
        setCompEnabled(false);
        setCompName("");
        setCompAge("prefer_not");
        setCompGender("prefer_not");
        setCompRel("prefer_not");
        setUserAvatarAge(26);
        setCompAvatarAge(26);
        setToast({ message: "Reset ✓", type: "reset" });
        window.setTimeout(() => setToast(null), 1800);

        // ✅ NEW: notify listeners immediately that profile is cleared
        try {
            window.dispatchEvent(new CustomEvent("imotara:profile-updated", { detail: null }));
        } catch {
            // ignore
        }
    }

    if (!loaded) return null;

    return (
        <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                            Tone &amp; Context Preferences
                        </h2>
                        <TinyBadge>optional</TinyBadge>
                        <TinyBadge>local-only</TinyBadge>
                    </div>

                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        This helps Imotara adjust communication tone based on your context and the kind of companion voice you prefer.
                    </p>

                    <p className="mt-2 text-[11px] text-zinc-500">
                        Imotara does not replace human relationships. These settings only guide how reflections are written.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                    >
                        Save
                    </button>
                </div>
            </div>

            {toast && (
                <div className={[
                    "mt-3 rounded-xl px-3 py-2 text-[11px]",
                    toast.type === "manual"
                        ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 font-medium"
                        : toast.type === "error"
                        ? "border border-rose-400/30 bg-rose-500/10 text-rose-300"
                        : "border border-zinc-600/30 bg-zinc-700/20 text-zinc-400",
                ].join(" ")}>
                    {toast.message}
                </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {/* Personal info */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Personal info</p>

                    <div className="mt-3 grid gap-3">
                        <label className="grid gap-1">
                            <span className="text-xs text-zinc-300">Name (optional)</span>
                            <input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="e.g., Soumen"
                                maxLength={USER_NAME_MAX}
                                onFocus={() => setUserNameFocused(true)}
                                onBlur={() => setUserNameFocused(false)}
                                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/20"
                            />
                            {(userNameFocused || userName.length > USER_NAME_MAX * 0.8) && (
                                <p className="text-right text-xs text-zinc-500">{userName.length}/{USER_NAME_MAX}</p>
                            )}
                        </label>

                        <div className="flex gap-3">
                            <label className="flex flex-col gap-1 flex-1">
                                <span className="text-xs text-zinc-300">Age range</span>
                                <select
                                    value={userAge}
                                    onChange={(e) => {
                                        const next = e.target.value as AgeRange;
                                        setUserAge(next);
                                        setUserAvatarAge(AGE_RANGE_TO_AVATAR[next] ?? 26);
                                    }}
                                    className={[
                                        "h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                        selectActiveClass(userAge !== "prefer_not"),
                                    ].join(" ")}
                                >
                                    <option value="prefer_not">Prefer not to say</option>
                                    <option value="13_17">13–17</option>
                                    <option value="18_24">18–24</option>
                                    <option value="25_34">25–34</option>
                                    <option value="35_44">35–44</option>
                                    <option value="45_54">45–54</option>
                                    <option value="55_64">55–64</option>
                                    <option value="65_plus">65+</option>
                                </select>
                            </label>

                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-xs text-zinc-300">Gender</span>
                                <select
                                    value={userGender}
                                    onChange={(e) => setUserGender(e.target.value as Gender)}
                                    className={[
                                        "h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                        selectActiveClass(userGender !== "prefer_not"),
                                    ].join(" ")}
                                >
                                    <option value="prefer_not">Prefer not to say</option>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                    <option value="nonbinary">Non-binary</option>
                                    <option value="other">Other</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => speakPreview(userGender, preferredLang, userName.trim(), (text, missing) => setUserVoiceInfo({ text, missing }))}
                                    className="mt-0.5 flex items-center gap-1 self-start text-[11px] text-zinc-400 transition hover:text-zinc-200"
                                >
                                    🔊 Preview voice
                                </button>
                                {userVoiceInfo && (
                                    <span className="text-[10px] text-amber-400/80 font-mono leading-snug">
                                        {userVoiceInfo.text}
                                    </span>
                                )}
                            </div>
                        </div>

                        <AvatarSlider
                            gender={userGender}
                            ageValue={userAvatarAge}
                            onChange={setUserAvatarAge}
                            name={userName.trim() || undefined}
                        />

                        {userAge === "13_17" && (
                            <p className="text-[10px] text-amber-400/80">
                                If you are under 13, please use Imotara with a parent or guardian.
                            </p>
                        )}

                        <label className="grid gap-1">
                            <span className="text-xs text-zinc-300">Preferred language</span>
                            <select
                                value={preferredLang}
                                onChange={(e) => setPreferredLang(e.target.value as SupportedLang | "auto")}
                                className={[
                                    "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                    selectActiveClass(preferredLang !== "en"),
                                ].join(" ")}
                            >
                                <option value="auto">Auto-detect</option>
                                <optgroup label="English">
                                    <option value="en">English</option>
                                </optgroup>
                                <optgroup label="Indian Languages">
                                    <option value="bn">Bengali (বাংলা)</option>
                                    <option value="gu">Gujarati (ગુજરાતી)</option>
                                    <option value="hi">Hindi (हिंदी)</option>
                                    <option value="kn">Kannada (ಕನ್ನಡ)</option>
                                    <option value="ml">Malayalam (മലയാളം)</option>
                                    <option value="mr">Marathi (मराठी)</option>
                                    <option value="or">Odia (ଓଡ଼ିଆ)</option>
                                    <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                                    <option value="ta">Tamil (தமிழ்)</option>
                                    <option value="te">Telugu (తెలుగు)</option>
                                    <option value="ur">Urdu (اردو)</option>
                                </optgroup>
                                <optgroup label="Other Languages">
                                    <option value="ar">Arabic (العربية)</option>
                                    <option value="zh">Chinese — Mandarin (普通话)</option>
                                    <option value="fr">French (Français)</option>
                                    <option value="de">German (Deutsch)</option>
                                    <option value="he">Hebrew (עברית)</option>
                                    <option value="id">Indonesian (Bahasa Indonesia)</option>
                                    <option value="ja">Japanese (日本語)</option>
                                    <option value="pt">Portuguese (Português)</option>
                                    <option value="ru">Russian (Русский)</option>
                                    <option value="es">Spanish (Español)</option>
                                </optgroup>
                            </select>
                        </label>

                        <p className="text-[11px] text-zinc-500">Used only to make wording feel more natural. Not shared.</p>
                    </div>
                </div>

                {/* Expected companion info */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Expected companion tone</p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                                Optional. This is tone guidance only (not identity simulation).
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setCompEnabled(prev => {
                                    const next = !prev;

                                    const existing =
                                        (safeParseProfile(
                                            window.localStorage.getItem(PROFILE_STORAGE_KEY)
                                        ) as ImotaraProfileV1) || {};

                                    const updated = {
                                        ...existing,
                                        companion: {
                                            ...existing.companion,
                                            enabled: next,
                                        },
                                    };

                                    window.localStorage.setItem(
                                        PROFILE_STORAGE_KEY,
                                        JSON.stringify(updated)
                                    );

                                    return next;
                                });
                            }}
                            aria-label="Toggle expected companion tone"
                            className={[
                                "relative h-8 w-14 rounded-full p-1 transition-colors duration-200",
                                compEnabled
                                    ? "bg-emerald-500/30 border border-emerald-400/50"
                                    : "bg-zinc-700/40 border border-zinc-600/40",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "block h-6 w-6 rounded-full transition-transform duration-200",
                                    compEnabled
                                        ? "translate-x-6 bg-emerald-200"
                                        : "translate-x-0 bg-zinc-300",
                                ].join(" ")}
                            />
                        </button>
                    </div>

                    {!compEnabled ? (
                        <p className="mt-3 text-[11px] text-zinc-400">Turn on to set preferred companion characteristics.</p>
                    ) : (
                        <div className="mt-3 grid gap-3">
                            <label className="grid gap-1">
                                <span className="text-xs text-zinc-300">Companion name (optional)</span>
                                <input
                                    value={compName}
                                    onChange={(e) => setCompName(e.target.value)}
                                    placeholder="e.g., A calm friend voice"
                                    maxLength={COMP_NAME_MAX}
                                    onFocus={() => setCompNameFocused(true)}
                                    onBlur={() => setCompNameFocused(false)}
                                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/20"
                                />
                                {(compNameFocused || compName.length > COMP_NAME_MAX * 0.8) && (
                                    <p className="text-right text-xs text-zinc-500">{compName.length}/{COMP_NAME_MAX}</p>
                                )}
                            </label>

                            <div className="flex gap-3">
                                <label className="flex flex-col gap-1 flex-1">
                                    <span className="text-xs text-zinc-300">Age range</span>
                                    <select
                                        value={compAge}
                                        onChange={(e) => {
                                            const next = e.target.value as AgeRange;
                                            setCompAge(next);
                                            setCompAvatarAge(AGE_RANGE_TO_AVATAR[next] ?? 26);
                                        }}
                                        className={[
                                            "h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                            selectActiveClass(compAge !== "prefer_not"),
                                        ].join(" ")}
                                    >
                                        <option value="prefer_not">Prefer not to say</option>
                                        <option value="under_13">Under 13</option>
                                        <option value="13_17">13–17</option>
                                        <option value="18_24">18–24</option>
                                        <option value="25_34">25–34</option>
                                        <option value="35_44">35–44</option>
                                        <option value="45_54">45–54</option>
                                        <option value="55_64">55–64</option>
                                        <option value="65_plus">65+</option>
                                    </select>
                                </label>

                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-xs text-zinc-300">Gender</span>
                                    <select
                                        value={compGender}
                                        onChange={(e) => setCompGender(e.target.value as Gender)}
                                        className={[
                                            "h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                            selectActiveClass(compGender !== "prefer_not"),
                                        ].join(" ")}
                                    >
                                        <option value="prefer_not">Prefer not to say</option>
                                        <option value="female">Female</option>
                                        <option value="male">Male</option>
                                        <option value="nonbinary">Non-binary</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => speakPreview(compGender, preferredLang, compName.trim(), (text, missing) => setCompVoiceInfo({ text, missing }))}
                                        className="mt-0.5 flex items-center gap-1 self-start text-[11px] text-zinc-400 transition hover:text-zinc-200"
                                    >
                                        🔊 Preview voice
                                    </button>
                                    {compVoiceInfo && (
                                        <span className="text-[10px] text-amber-400/80 font-mono leading-snug">
                                            {compVoiceInfo.text}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <AvatarSlider
                                gender={compGender}
                                ageValue={compAvatarAge}
                                onChange={setCompAvatarAge}
                                name={compName.trim() || undefined}
                            />

                            <label className="grid gap-1">
                                <span className="text-xs text-zinc-300">Relationship vibe</span>
                                <select
                                    value={compRel}
                                    onChange={(e) => {
                                        const next = e.target.value as any;
                                        setCompRel(next);

                                        const existing =
                                            (safeParseProfile(
                                                window.localStorage.getItem(PROFILE_STORAGE_KEY)
                                            ) as ImotaraProfileV1) || {};

                                        const updated: ImotaraProfileV1 = {
                                            ...existing,
                                            companion: {
                                                ...existing.companion,
                                                relationship: next === "prefer_not" ? undefined : next,
                                            },
                                        };

                                        window.localStorage.setItem(
                                            PROFILE_STORAGE_KEY,
                                            JSON.stringify(updated)
                                        );
                                    }}
                                    className={[
                                        "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                        selectActiveClass(compRel !== "prefer_not"),
                                    ].join(" ")}
                                >
                                    <option value="prefer_not">Prefer not to specify</option>
                                    <option value="mentor">Mentor</option>
                                    <option value="elder">Elder</option>
                                    <option value="friend">Friend</option>
                                    <option value="coach">Coach</option>
                                    <option value="sibling">Sibling (younger/peer vibe)</option>
                                    <option value="junior_buddy">Junior buddy (younger vibe)</option>
                                    <option value="parent_like">Parent-like (tone only)</option>
                                    <option value="partner_like">Partner-like (tone only)</option>
                                </select>
                            </label>

                            <label className="grid gap-1">
                                <span className="text-xs text-zinc-300">Response style</span>
                                <select
                                    value={responseStyle}
                                    onChange={(e) => setResponseStyle(e.target.value as ResponseStyle | "auto")}
                                    className={[
                                        "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                        selectActiveClass(responseStyle !== "auto"),
                                    ].join(" ")}
                                >
                                    <option value="auto">Let Imotara decide</option>
                                    <option value="comfort">Comfort me — be present &amp; warm</option>
                                    <option value="reflect">Help me reflect — ask gentle questions</option>
                                    <option value="motivate">Motivate me — be encouraging &amp; energetic</option>
                                    <option value="advise">Give advice — practical next steps</option>
                                </select>
                                {responseStyle !== "auto" && (
                                    <p className="mt-0.5 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-[11px] italic leading-snug text-zinc-400">
                                        {responseStyle === "comfort"  && "\u201cThat sounds really hard. I\u2019m here with you \u2014 take all the time you need.\u201d"}
                                        {responseStyle === "reflect"  && "\u201cWhat do you think that feeling is trying to tell you?\u201d"}
                                        {responseStyle === "motivate" && "\u201cYou\u2019re doing better than you think. One small step is all it takes today.\u201d"}
                                        {responseStyle === "advise"   && "\u201cHere\u2019s what might help: start with the smallest task, just to build momentum.\u201d"}
                                    </p>
                                )}
                                <p className="text-[10px] text-zinc-500">You can always override this in conversation.</p>
                            </label>

                            <p className="text-[11px] text-zinc-500">
                                This only influences how Imotara phrases reflections (warmth, directness, pacing).
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* GAP-12: Teen Mode toggle */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/6 px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-violet-200">Teen Insights Mode</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">Shows age-appropriate reflections with peer-supportive language and enhanced safety filters.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={teenMode}
                    onClick={() => setTeenMode((v) => !v)}
                    className={`relative ml-4 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${teenMode ? "bg-violet-500" : "bg-zinc-700"}`}
                >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${teenMode ? "translate-x-5" : "translate-x-0"}`} />
                </button>
            </div>

            <p className="mt-3 text-[11px] text-zinc-500">Stored only in this browser. Reset clears it.</p>
        </section>
    );
}

// ===== Existing helpers =====

function formatINRFromPaise(paise: number) {
    const rupees = paise / 100;
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(rupees);
    } catch {
        return `₹${Math.round(rupees)}`;
    }
}

function loadRazorpayScript(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const existing = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        ) as HTMLScriptElement | null;

        if (existing) {
            existing.addEventListener("load", () => resolve(true));
            existing.addEventListener("error", () => resolve(false));
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

// ── DataDashboard sub-component ───────────────────────────────────────────────
function DataDashboard({ getStorageSummary }: { getStorageSummary: () => { historyCount: number; chatCount: number; reflectionCount: number; totalKB: number } }) {
    const [summary, setSummary] = useState<ReturnType<typeof getStorageSummary> | null>(null);
    const [clearing, setClearing] = useState(false);
    const [clearDays, setClearDays] = useState<30 | 60 | 90>(30);
    const [clearMsg, setClearMsg] = useState<string | null>(null);

    useEffect(() => { setSummary(getStorageSummary()); }, [getStorageSummary]);

    function autoClear() {
        if (!confirm(`Delete emotion history older than ${clearDays} days?`)) return;
        setClearing(true);
        try {
            const raw = localStorage.getItem("imotara:history:v1");
            if (raw) {
                const all = JSON.parse(raw) as any[];
                const cutoff = Date.now() - clearDays * 86_400_000;
                const kept = all.filter((r) => r.createdAt >= cutoff);
                localStorage.setItem("imotara:history:v1", JSON.stringify(kept));
                setClearMsg(`Removed ${all.length - kept.length} entries older than ${clearDays} days.`);
                setSummary(getStorageSummary());
            }
        } catch { setClearMsg("Could not clear — storage may be restricted."); }
        setClearing(false);
    }

    return (
        <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Data on this device</h2>
            <p className="mt-1 text-xs leading-6 text-zinc-400">A quick summary of what Imotara stores locally in your browser.</p>

            {summary && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                        { label: "Emotion entries", value: summary.historyCount },
                        { label: "Chat messages",   value: summary.chatCount },
                        { label: "Reflections",     value: summary.reflectionCount },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-center">
                            <p className="text-lg font-semibold text-zinc-100 tabular-nums">{value}</p>
                            <p className="text-[10px] text-zinc-500">{label}</p>
                        </div>
                    ))}
                </div>
            )}
            {summary && (
                <p className="mt-2 text-[11px] text-zinc-600">
                    Approx. {summary.totalKB} KB used in localStorage
                </p>
            )}

            {/* Auto-clear */}
            <div className="mt-4 rounded-xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-xs font-medium text-zinc-300">Auto-clear old history</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">Remove emotion entries older than a chosen number of days. Chat and reflections are not affected.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
                        {([30, 60, 90] as const).map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setClearDays(d)}
                                className={`rounded-full px-3 py-1 text-xs transition ${clearDays === d ? "im-seg-selected bg-white/20 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={autoClear}
                        disabled={clearing}
                        className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                        {clearing ? "Clearing…" : `Clear older than ${clearDays} days`}
                    </button>
                </div>
                {clearMsg && <p className="mt-1.5 text-[11px] text-emerald-400">{clearMsg}</p>}
            </div>
        </section>
    );
}

const ACCENT_OPTIONS: { value: Accent; label: string; color: string; gradient?: string }[] = [
    { value: "twilight", label: "Twilight", color: "#6366f1", gradient: "linear-gradient(to right, #6366f1, #0ea5e9, #34d399)" },
    { value: "indigo",   label: "Indigo",   color: "#6366f1" },
    { value: "teal",     label: "Teal",     color: "#14b8a6" },
    { value: "rose",     label: "Rose",     color: "#f43f5e" },
    { value: "amber",    label: "Amber",    color: "#f59e0b" },
    { value: "emerald",  label: "Emerald",  color: "#10b981" },
];

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
];

const HISTORY_KEY = "imotara:history:v1";
const CHAT_STORAGE = "imotara.chat.v1";
const REFLECTIONS_KEY = "imotara.reflections.v1";

function getStorageSummary() {
    if (typeof window === "undefined") return { historyCount: 0, chatCount: 0, reflectionCount: 0, totalKB: 0 };
    let historyCount = 0, chatCount = 0, reflectionCount = 0, totalBytes = 0;
    try {
        const h = localStorage.getItem(HISTORY_KEY);
        if (h) { historyCount = (JSON.parse(h) as any[]).filter((r) => !r.deleted).length; totalBytes += h.length; }
    } catch { /* ignore */ }
    try {
        const c = localStorage.getItem(CHAT_STORAGE);
        if (c) {
            const threads = JSON.parse(c)?.threads ?? [];
            chatCount = threads.reduce((s: number, t: any) => s + (t.messages?.length ?? 0), 0);
            totalBytes += c.length;
        }
    } catch { /* ignore */ }
    try {
        const r = localStorage.getItem(REFLECTIONS_KEY);
        if (r) { reflectionCount = (JSON.parse(r) as any[]).length; totalBytes += r.length; }
    } catch { /* ignore */ }
    return { historyCount, chatCount, reflectionCount, totalKB: Math.round(totalBytes / 1024) };
}

export default function SettingsPage() {
    const { mode } = useAnalysisConsent();
    const { accent, setAccent, fontSize, setFontSize, colorMode, setColorMode } = useAppearance();

    // Cross-device chat link key (optional)
    const [linkKey, setLinkKey] = useState("");
    const [linkKeyStatus, setLinkKeyStatus] = useState<string | null>(null);

    function saveLinkKey() {
        const next = (linkKey ?? "").trim();
        try {
            if (!next) {
                localStorage.removeItem(CHAT_LINK_KEY);
                setLinkKey("");
                setLinkKeyStatus("Link Key cleared.");
                return;
            }
            // keep reasonably short (server also sanitizes)
            const safe = next.slice(0, 80);
            localStorage.setItem(CHAT_LINK_KEY, safe);
            setLinkKey(safe);
            setLinkKeyStatus("Link Key saved on this device.");
        } catch {
            setLinkKeyStatus("Could not save Link Key (storage blocked).");
        }
    }

    function clearLinkKey() {
        try {
            localStorage.removeItem(CHAT_LINK_KEY);
        } catch { }
        setLinkKey("");
        setLinkKeyStatus("Link Key cleared.");
    }

    async function copyLinkKey() {
        const v = (linkKey ?? "").trim();
        if (!v) {
            setLinkKeyStatus("Nothing to copy.");
            return;
        }
        try {
            await navigator.clipboard.writeText(v);
            setLinkKeyStatus("Copied.");
        } catch {
            setLinkKeyStatus("Copy failed. You can select and copy manually.");
        }
    }


    // ✅ Hydration-safe: render certain sections only after mount
    const [mounted, setMounted] = useState(false);

    // ─── Browser push notifications ──────────────────────────────────────────
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
    const [notifSubscribed, setNotifSubscribed] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifToast, setNotifToast] = useState<string | null>(null);
    const NOTIF_INACTIVITY_KEY = "imotara.notif.inactivityHours.v1";
    const [notifInactivityHours, setNotifInactivityHours] = useState(48);
    useEffect(() => {
        try { const v = parseInt(localStorage.getItem(NOTIF_INACTIVITY_KEY) ?? "48", 10); if ([24, 48, 72, 168].includes(v)) setNotifInactivityHours(v); } catch { /* ignore */ }
    }, []);
    function handleNotifInactivityChange(hours: number) {
        setNotifInactivityHours(hours);
        try { localStorage.setItem(NOTIF_INACTIVITY_KEY, String(hours)); } catch { /* ignore */ }
    }

    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        setNotifPermission(Notification.permission);
        // Check if already subscribed
        navigator.serviceWorker?.ready.then((reg) =>
            reg.pushManager.getSubscription().then((sub) => setNotifSubscribed(!!sub))
        ).catch(() => {});
    }, []);

    async function enableNotifications() {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        setNotifLoading(true);
        try {
            const permission = await Notification.requestPermission();
            setNotifPermission(permission);
            if (permission !== "granted") return;

            const reg = await navigator.serviceWorker.ready;
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) { console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set"); return; }

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey,
            });

            const pushRes = await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sub.toJSON()),
            });
            if (pushRes.ok) {
                setNotifSubscribed(true);
            } else {
                console.error("[push] subscribe failed: server returned", pushRes.status);
                setNotifToast("Could not save notification subscription — please try again");
                window.setTimeout(() => setNotifToast(null), 3000);
            }
        } catch (e) {
            console.error("[push] subscribe failed:", e);
        } finally {
            setNotifLoading(false);
        }
    }

    async function disableNotifications() {
        setNotifLoading(true);
        try {
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) await sub.unsubscribe();
            }
            await fetch("/api/push/subscribe", { method: "DELETE" });
            setNotifSubscribed(false);
        } catch (e) {
            console.error("[push] unsubscribe failed:", e);
        } finally {
            setNotifLoading(false);
        }
    }

    const consentLabel =
        mode === "allow-remote"
            ? "Remote analysis allowed"
            : mode === "auto"
                ? "Auto (smart routing)"
                : "On-device only (local analysis)";

    const consentBadgeClass =
        mode === "allow-remote"
            ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-200"
            : mode === "auto"
                ? "border-violet-300/70 bg-violet-500/10 text-violet-200"
                : "border-zinc-400/70 bg-zinc-900/40 text-zinc-100";

    const [busy, setBusy] = useState<"chat" | "history" | "all" | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    // Donations (web)
    const [donating, setDonating] = useState(false);
    const [donateStatus, setDonateStatus] = useState<string | null>(null);

    // Razorpay script readiness (prevents "nothing happened" + spam clicks)
    const [rzLoading, setRzLoading] = useState(false);
    const [rzReady, setRzReady] = useState(false);

    // Licensing (web)
    const [lic, setLic] = useState<LicenseStatusResponse | null>(null);
    const [licLoading, setLicLoading] = useState(false);

    // Recent donations (web)
    const [donLoading, setDonLoading] = useState(false);
    const [donations, setDonations] = useState<any[]>([]);

    // Companion memories (web)
    type MemoryRow = { id: string; type: string; key: string; value: string; confidence: number; updated_at: string };
    const [memories, setMemories] = useState<MemoryRow[]>([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);
    const [memoriesDeletingId, setMemoriesDeletingId] = useState<string | null>(null);

    async function loadMemories() {
        setMemoriesLoading(true);
        try {
            const res = await fetch("/api/memory");
            if (res.ok) {
                const json = await res.json();
                setMemories(json.memories ?? []);
            }
        } catch { }
        setMemoriesLoading(false);
    }

    async function deleteMemory(id: string) {
        setMemoriesDeletingId(id);
        try {
            await fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
            setMemories((prev) => prev.filter((m) => m.id !== id));
        } catch { }
        setMemoriesDeletingId(null);
    }

    // NF-3: Family snapshot share
    const [familySnapUrl, setFamilySnapUrl] = useState<string | null>(null);
    const [familySnapCopied, setFamilySnapCopied] = useState(false);

    function generateFamilySnapshot() {
        try {
            const EMOTION_MAP: Record<string, string> = {
                joy: "joy", happiness: "joy", happy: "joy", gratitude: "gratitude", hopeful: "hopeful",
                sadness: "sadness", sad: "sadness", grief: "grief", loss: "grief",
                anxiety: "anxiety", anxious: "anxiety", stressed: "stressed", stress: "stressed",
                anger: "anger", angry: "anger", fear: "fear", confused: "confused",
                lonely: "lonely", surprise: "surprise", neutral: "neutral",
            };
            const rawHistory: any[] = (() => {
                try { return JSON.parse(localStorage.getItem("imotara:history:v1") ?? "[]"); } catch { return []; }
            })();
            // Build 7-day emotion array
            const now = Date.now();
            const week: string[] = Array.from({ length: 7 }, (_, i) => {
                const dayStart = now - (6 - i) * 86_400_000;
                const dayEnd = dayStart + 86_400_000;
                const dayMsgs = rawHistory.filter((m: any) => m.timestamp >= dayStart && m.timestamp < dayEnd && m.from === "user");
                const withEmotion = dayMsgs.find((m: any) => m.emotion || m.moodHint);
                const raw = withEmotion?.emotion ?? withEmotion?.moodHint ?? "neutral";
                return EMOTION_MAP[raw.toLowerCase()] ?? "neutral";
            });
            const freq: Record<string, number> = {};
            for (const e of week) freq[e] = (freq[e] ?? 0) + 1;
            const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
            const challengeRaw: any = (() => {
                try { return JSON.parse(localStorage.getItem("imotara.challenge30.v1") ?? "{}"); } catch { return {}; }
            })();
            const reflectionDays = Array.isArray(challengeRaw.completedDays) ? challengeRaw.completedDays.filter((d: number) => d < 7).length : 0;
            const profile: any = (() => {
                try { return JSON.parse(localStorage.getItem("imotara.profile.v1") ?? "{}"); } catch { return {}; }
            })();
            const snap = {
                displayName: profile?.user?.name || "",
                week,
                dominant,
                reflectionDays,
                generatedAt: new Date().toISOString().slice(0, 10),
            };
            const encoded = btoa(encodeURIComponent(JSON.stringify(snap)));
            const url = `${window.location.origin}/family/view?snap=${encoded}`;
            setFamilySnapUrl(url);
            setFamilySnapCopied(false);
        } catch { /* ignore */ }
    }

    async function copyFamilySnapUrl() {
        if (!familySnapUrl) return;
        try {
            await navigator.clipboard.writeText(familySnapUrl);
            setFamilySnapCopied(true);
            setTimeout(() => setFamilySnapCopied(false), 2500);
        } catch { /* ignore */ }
    }

    const licenseMode = useMemo(() => {
        // This is a PUBLIC env var and is safe to display.
        return process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE || "off";
    }, []);

    const DONATION_PRESETS = useMemo(
        () => [
            { id: "inr_49", label: "₹49", amount: 4900 },
            { id: "inr_99", label: "₹99", amount: 9900 },
            { id: "inr_199", label: "₹199", amount: 19900 },
            { id: "inr_499", label: "₹499", amount: 49900 },
            { id: "inr_999", label: "₹999", amount: 99900 },
        ],
        []
    );

    async function handleClearChat() {
        if (typeof window === "undefined") return;

        const ok = window.confirm(
            "Clear all chat conversations on this device? This cannot be undone."
        );
        if (!ok) return;

        try {
            setBusy("chat");
            setStatus(null);
            window.localStorage.removeItem(CHAT_STORAGE_KEY);
            setStatus("Chat conversations cleared on this device.");
        } catch (err) {
            console.error("[imotara] failed to clear chat conversations:", err);
            setStatus("Something went wrong while clearing chat.");
        } finally {
            setBusy(null);
        }
    }

    async function handleClearHistory() {
        const ok =
            typeof window !== "undefined"
                ? window.confirm(
                    "Clear all emotion history on this device? This cannot be undone."
                )
                : true;
        if (!ok) return;

        try {
            setBusy("history");
            setStatus(null);
            await saveHistory([]);
            setStatus("Emotion history cleared on this device.");
        } catch (err) {
            console.error("[imotara] failed to clear emotion history:", err);
            setStatus("Something went wrong while clearing emotion history.");
        } finally {
            setBusy(null);
        }
    }

    async function handleClearAll() {
        if (typeof window === "undefined") return;

        const ok = window.confirm(
            "Clear ALL local Imotara data (chat + emotion history) on this device? This cannot be undone."
        );
        if (!ok) return;

        try {
            setBusy("all");
            setStatus(null);
            window.localStorage.removeItem(CHAT_STORAGE_KEY);
            await saveHistory([]);
            setStatus(
                "All local Imotara data (chat + emotion history) cleared on this device."
            );
        } catch (err) {
            console.error("[imotara] failed to clear all local data:", err);
            setStatus("Something went wrong while clearing local data.");
        } finally {
            setBusy(null);
        }
    }

    // ─── Export Data (JSON) ──────────────────────────────────────────────────
    const [exportBusy, setExportBusy] = useState(false);

    async function handleExportData() {
        if (exportBusy) return;
        setExportBusy(true);
        try {
            const rawHistory: unknown[] = (() => {
                try { return JSON.parse(localStorage.getItem("imotara:history:v1") ?? "[]"); } catch { return []; }
            })();
            const payload = {
                exportedAt: new Date().toISOString(),
                appVersion: typeof window !== "undefined"
                    ? (document.querySelector("meta[name='app-version']")?.getAttribute("content") ?? "web")
                    : "web",
                messages: rawHistory,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `imotara-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setStatus("Export failed. Please try again.");
        } finally {
            setExportBusy(false);
        }
    }

    // ─── Remote History Sync ─────────────────────────────────────────────────
    const [syncBusy, setSyncBusy] = useState(false);
    const [syncMsg, setSyncMsg] = useState<string | null>(null);

    async function handleSyncNow() {
        if (syncBusy) return;
        setSyncBusy(true);
        setSyncMsg(null);
        try {
            const rawHistory: unknown[] = (() => {
                try { return JSON.parse(localStorage.getItem("imotara:history:v1") ?? "[]"); } catch { return []; }
            })();
            const res = await fetch("/api/history/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientSince: 0,
                    clientChanges: rawHistory,
                }),
            });
            if (res.status === 401) {
                setSyncMsg("Sign in to sync your history across devices.");
                return;
            }
            if (!res.ok) {
                setSyncMsg("Sync failed — please try again.");
                return;
            }
            const json = await res.json();
            const serverChanges: unknown[] = Array.isArray(json?.serverChanges) ? json.serverChanges : [];
            setSyncMsg(serverChanges.length > 0
                ? `Sync complete — ${serverChanges.length} new record${serverChanges.length !== 1 ? "s" : ""} from the cloud.`
                : "Sync complete — you are up to date.");
        } catch {
            setSyncMsg("Sync failed — check your connection.");
        } finally {
            setSyncBusy(false);
        }
    }

    // ─── H-1: Haptic feedback toggle ─────────────────────────────────────────
    const HAPTIC_PREF_KEY = "imotara.haptic.enabled.v1";
    const [hapticEnabled, setHapticEnabled] = useState(true);
    useEffect(() => {
        try { setHapticEnabled(localStorage.getItem(HAPTIC_PREF_KEY) !== "0"); } catch { /* ignore */ }
    }, []);
    function handleHapticToggle(val: boolean) {
        setHapticEnabled(val);
        try { localStorage.setItem(HAPTIC_PREF_KEY, val ? "1" : "0"); } catch { /* ignore */ }
    }

    // ─── C-2: Reduced motion toggle ──────────────────────────────────────────
    const REDUCED_MOTION_KEY = "imotara.reduced.motion.v1";
    const [reducedMotion, setReducedMotion] = useState(false);
    useEffect(() => {
        try { setReducedMotion(localStorage.getItem(REDUCED_MOTION_KEY) === "1"); } catch { /* ignore */ }
    }, []);
    function handleReducedMotionToggle(val: boolean) {
        setReducedMotion(val);
        try { localStorage.setItem(REDUCED_MOTION_KEY, val ? "1" : "0"); } catch { /* ignore */ }
    }

    // ─── C-3: Show timestamps toggle ─────────────────────────────────────────
    const SHOW_TIMESTAMPS_KEY = "imotara.chat.showTimestamps.v1";
    const [showTimestamps, setShowTimestamps] = useState(false);
    useEffect(() => {
        try { setShowTimestamps(localStorage.getItem(SHOW_TIMESTAMPS_KEY) === "1"); } catch { /* ignore */ }
    }, []);
    function handleShowTimestampsToggle(val: boolean) {
        setShowTimestamps(val);
        try { localStorage.setItem(SHOW_TIMESTAMPS_KEY, val ? "1" : "0"); } catch { /* ignore */ }
    }

    // ─── H-3: TTS rate + pitch ───────────────────────────────────────────────
    const TTS_RATE_KEY = "imotara.tts.rate.v1";
    const TTS_PITCH_KEY = "imotara.tts.pitch.v1";
    const [ttsRate, setTtsRate] = useState(0.95);
    const [ttsPitch, setTtsPitch] = useState(1.0);
    useEffect(() => {
        try {
            const r = parseFloat(localStorage.getItem(TTS_RATE_KEY) ?? "0.95");
            const p = parseFloat(localStorage.getItem(TTS_PITCH_KEY) ?? "1.0");
            if (isFinite(r)) setTtsRate(r);
            if (isFinite(p)) setTtsPitch(p);
        } catch { /* ignore */ }
    }, []);
    function handleTtsRateChange(val: number) {
        const v = Math.round(val * 20) / 20; // snap to 0.05 steps
        setTtsRate(v);
        try { localStorage.setItem(TTS_RATE_KEY, String(v)); } catch { /* ignore */ }
    }
    function handleTtsPitchChange(val: number) {
        const v = Math.round(val * 20) / 20;
        setTtsPitch(v);
        try { localStorage.setItem(TTS_PITCH_KEY, String(v)); } catch { /* ignore */ }
    }

    // ─── Mindset Analysis Toggles ────────────────────────────────────────────
    const MINDSET_PREFS_KEY = "imotara:mindset.analysis.prefs.v1";
    type MindsetPrefs = { today: boolean; week7: boolean; days30: boolean; allTime: boolean };
    const [mindsetPrefs, setMindsetPrefs] = useState<MindsetPrefs>({ today: false, week7: false, days30: false, allTime: false });
    useEffect(() => {
        try {
            const raw = localStorage.getItem(MINDSET_PREFS_KEY);
            if (raw) setMindsetPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
        } catch { /* ignore */ }
    }, []);
    function handleMindsetToggle(key: keyof MindsetPrefs) {
        const next = { ...mindsetPrefs, [key]: !mindsetPrefs[key] };
        setMindsetPrefs(next);
        try {
            localStorage.setItem(MINDSET_PREFS_KEY, JSON.stringify(next));
            // Notify the History page (same-tab SPA — storage event only fires cross-tab)
            window.dispatchEvent(new CustomEvent("imotara:mindsetPrefsChanged"));
        } catch { /* ignore */ }
    }

    // ─── G-4: Grow nudge permanent dismiss ───────────────────────────────────
    const GROW_NUDGE_PERM_KEY = "imotara.grow.nudge.perm.v1";
    const [growNudgePerm, setGrowNudgePerm] = useState(false);
    useEffect(() => {
        try { setGrowNudgePerm(localStorage.getItem(GROW_NUDGE_PERM_KEY) === "1"); } catch { /* ignore */ }
    }, []);
    function handleGrowNudgePermToggle(val: boolean) {
        setGrowNudgePerm(val);
        try { localStorage.setItem(GROW_NUDGE_PERM_KEY, val ? "1" : "0"); } catch { /* ignore */ }
    }

    // ─── Hands-free mode ─────────────────────────────────────────────────────
    const HANDSFREE_KEY = "imotara:handsfree.v1";
    const [handsfree, setHandsfree] = useState(false);
    useEffect(() => {
        try { setHandsfree(localStorage.getItem(HANDSFREE_KEY) === "1"); } catch { /* ignore */ }
    }, []);
    function handleHandsfreeToggle(val: boolean) {
        setHandsfree(val);
        try {
            localStorage.setItem(HANDSFREE_KEY, val ? "1" : "0");
            window.dispatchEvent(new CustomEvent("imotara:handsfreeChanged"));
        } catch { /* ignore */ }
    }

    // ─── A-4: Tone reflection visibility ─────────────────────────────────────
    const TONE_REFLECT_KEY = "imotara.tone.reflect.show.v1";
    const [showToneReflect, setShowToneReflect] = useState(true);
    useEffect(() => {
        try { setShowToneReflect(localStorage.getItem(TONE_REFLECT_KEY) !== "0"); } catch { /* ignore */ }
    }, []);
    function handleToneReflectToggle(val: boolean) {
        setShowToneReflect(val);
        try { localStorage.setItem(TONE_REFLECT_KEY, val ? "1" : "0"); } catch { /* ignore */ }
    }

    // ─── P-3: Crisis country override ────────────────────────────────────────
    const CRISIS_COUNTRY_KEY = "imotara.crisis.country.v1";
    const CRISIS_COUNTRIES = [
        { code: "auto", label: "Auto-detect" },
        { code: "IN", label: "India" }, { code: "US", label: "United States" },
        { code: "GB", label: "United Kingdom" }, { code: "AU", label: "Australia" },
        { code: "CA", label: "Canada" }, { code: "JP", label: "Japan" },
        { code: "KR", label: "South Korea" }, { code: "SG", label: "Singapore" },
        { code: "MY", label: "Malaysia" }, { code: "PH", label: "Philippines" },
        { code: "LK", label: "Sri Lanka" }, { code: "PK", label: "Pakistan" },
        { code: "BD", label: "Bangladesh" }, { code: "NZ", label: "New Zealand" },
        { code: "IE", label: "Ireland" }, { code: "DE", label: "Germany" },
        { code: "FR", label: "France" }, { code: "NL", label: "Netherlands" },
    ];
    const [crisisCountry, setCrisisCountry] = useState("auto");
    useEffect(() => {
        try { setCrisisCountry(localStorage.getItem(CRISIS_COUNTRY_KEY) ?? "auto"); } catch { /* ignore */ }
    }, []);
    function handleCrisisCountryChange(code: string) {
        setCrisisCountry(code);
        try { localStorage.setItem(CRISIS_COUNTRY_KEY, code); } catch { /* ignore */ }
    }

    // ─── M-2: Auto-cleanup history ───────────────────────────────────────────
    const AUTO_CLEANUP_KEY = "imotara.history.autoCleanupDays.v1";
    const [autoCleanupDays, setAutoCleanupDays] = useState(0);
    const AUTO_CLEANUP_OPTIONS = [0, 30, 60, 90] as const;
    useEffect(() => {
        try {
            const v = parseInt(localStorage.getItem(AUTO_CLEANUP_KEY) ?? "0", 10);
            setAutoCleanupDays(isFinite(v) ? v : 0);
        } catch { /* ignore */ }
    }, []);
    function handleAutoCleanupChange(days: number) {
        setAutoCleanupDays(days);
        try { localStorage.setItem(AUTO_CLEANUP_KEY, String(days)); } catch { /* ignore */ }
        if (days > 0) {
            try {
                const raw: unknown[] = JSON.parse(localStorage.getItem("imotara:history:v1") ?? "[]");
                const cutoff = Date.now() - days * 86_400_000;
                const kept = (raw as { timestamp?: number }[]).filter((r) => (r.timestamp ?? Date.now()) >= cutoff);
                localStorage.setItem("imotara:history:v1", JSON.stringify(kept));
            } catch { /* ignore */ }
        }
    }

    // ─── O-1: Feature discovery reset ────────────────────────────────────────
    const DISCOVERY_KEY = "imotara.onboarding.discovery.v1";
    const [discoveryResetMsg, setDiscoveryResetMsg] = useState<string | null>(null);
    function handleDiscoveryReset() {
        try { localStorage.removeItem(DISCOVERY_KEY); } catch { /* ignore */ }
        setDiscoveryResetMsg("Discovery cards reset — they will reappear next time you open Chat.");
    }

    // ─── O-3: First-message tip reset ────────────────────────────────────────
    const FIRST_MSG_KEY = "imotara.onboarding.firstMsgSeen.v1";
    const [firstMsgResetMsg, setFirstMsgResetMsg] = useState<string | null>(null);
    function handleFirstMsgReset() {
        try { localStorage.removeItem(FIRST_MSG_KEY); } catch { /* ignore */ }
        setFirstMsgResetMsg("Welcome tip reset — it will appear again on your next Chat visit.");
    }

    // ─── U-1: Trial banner permanent dismiss ─────────────────────────────────
    const TRIAL_BANNER_KEY = "imotara.trial.bannerDismissed.v1";
    const [trialBannerPerm, setTrialBannerPerm] = useState(false);
    useEffect(() => {
        try { setTrialBannerPerm(localStorage.getItem(TRIAL_BANNER_KEY) === "never"); } catch { /* ignore */ }
    }, []);
    function handleTrialBannerPermToggle(val: boolean) {
        setTrialBannerPerm(val);
        try {
            if (val) localStorage.setItem(TRIAL_BANNER_KEY, "never");
            else localStorage.removeItem(TRIAL_BANNER_KEY);
        } catch { /* ignore */ }
    }

    // C-4: Return-greeting threshold
    const RETURN_GREETING_KEY = "imotara.return.greeting.hours.v1";
    const [returnGreetingHours, setReturnGreetingHours] = useState(24);
    const RETURN_GREETING_OPTIONS = [6, 12, 24, 48] as const;
    useEffect(() => {
        try {
            const n = parseInt(localStorage.getItem(RETURN_GREETING_KEY) ?? "24", 10);
            setReturnGreetingHours(isFinite(n) ? n : 24);
        } catch { /* ignore */ }
    }, []);
    function handleReturnGreetingChange(hours: number) {
        setReturnGreetingHours(hours);
        try { localStorage.setItem(RETURN_GREETING_KEY, String(hours)); } catch { /* ignore */ }
    }

    // U-3: Search mode
    const SEARCH_MODE_KEY = "imotara.search.mode.v1";
    const [searchMode, setSearchMode] = useState<"fuzzy" | "exact">("fuzzy");
    useEffect(() => {
        try {
            const v = localStorage.getItem(SEARCH_MODE_KEY);
            if (v === "exact" || v === "fuzzy") setSearchMode(v);
        } catch { /* ignore */ }
    }, []);
    function handleSearchModeChange(val: "fuzzy" | "exact") {
        setSearchMode(val);
        try { localStorage.setItem(SEARCH_MODE_KEY, val); } catch { /* ignore */ }
    }

    // U-2: Reaction emoji set (web)
    const WEB_REACTIONS_SET_KEY = "imotara.reactions.set.v1";
    const [webReactionsSet, setWebReactionsSet] = useState<"default" | "minimal" | "extended">("default");
    useEffect(() => {
        try {
            const v = localStorage.getItem(WEB_REACTIONS_SET_KEY);
            if (v === "minimal" || v === "default" || v === "extended") setWebReactionsSet(v as "default" | "minimal" | "extended");
        } catch { /* ignore */ }
    }, []);
    function handleWebReactionsSetChange(val: "default" | "minimal" | "extended") {
        setWebReactionsSet(val);
        try { localStorage.setItem(WEB_REACTIONS_SET_KEY, val); } catch { /* ignore */ }
    }

    // G-1: Emotional arc cadence (web)
    const WEB_ARC_CADENCE_KEY = "imotara.arc.cadenceDays.v1";
    const [webArcCadenceDays, setWebArcCadenceDays] = useState(30);
    const WEB_CADENCE_OPTIONS = [7, 14, 30, 60] as const;
    useEffect(() => {
        try {
            const n = parseInt(localStorage.getItem(WEB_ARC_CADENCE_KEY) ?? "30", 10);
            setWebArcCadenceDays(isFinite(n) ? n : 30);
        } catch { /* ignore */ }
    }, []);
    function handleWebArcCadenceChange(days: number) {
        setWebArcCadenceDays(days);
        try { localStorage.setItem(WEB_ARC_CADENCE_KEY, String(days)); } catch { /* ignore */ }
    }

    // G-2: Companion letter cadence (web)
    const WEB_LETTER_CADENCE_KEY = "imotara.letter.cadenceDays.v1";
    const [webLetterCadenceDays, setWebLetterCadenceDays] = useState(30);
    useEffect(() => {
        try {
            const n = parseInt(localStorage.getItem(WEB_LETTER_CADENCE_KEY) ?? "30", 10);
            setWebLetterCadenceDays(isFinite(n) ? n : 30);
        } catch { /* ignore */ }
    }, []);
    function handleWebLetterCadenceChange(days: number) {
        setWebLetterCadenceDays(days);
        try { localStorage.setItem(WEB_LETTER_CADENCE_KEY, String(days)); } catch { /* ignore */ }
    }

    // G-3: Open-loop thresholds (web)
    const WEB_OPENLOOP_THREADS_KEY = "imotara.openloop.minThreads.v1";
    const WEB_OPENLOOP_AGE_KEY = "imotara.openloop.minAgeDays.v1";
    const [webOpenLoopThreads, setWebOpenLoopThreads] = useState(3);
    const [webOpenLoopAgeDays, setWebOpenLoopAgeDays] = useState(14);
    const WEB_THREAD_OPTIONS = [2, 3, 5] as const;
    const WEB_AGE_OPTIONS = [7, 14, 21, 30] as const;
    useEffect(() => {
        try {
            const t = parseInt(localStorage.getItem(WEB_OPENLOOP_THREADS_KEY) ?? "3", 10);
            setWebOpenLoopThreads(isFinite(t) ? t : 3);
            const a = parseInt(localStorage.getItem(WEB_OPENLOOP_AGE_KEY) ?? "14", 10);
            setWebOpenLoopAgeDays(isFinite(a) ? a : 14);
        } catch { /* ignore */ }
    }, []);
    function handleWebOpenLoopThreadsChange(n: number) {
        setWebOpenLoopThreads(n);
        try { localStorage.setItem(WEB_OPENLOOP_THREADS_KEY, String(n)); } catch { /* ignore */ }
    }
    function handleWebOpenLoopAgeChange(days: number) {
        setWebOpenLoopAgeDays(days);
        try { localStorage.setItem(WEB_OPENLOOP_AGE_KEY, String(days)); } catch { /* ignore */ }
    }

    // C-1: Typing indicator speed (web)
    const WEB_TYPING_SPEED_KEY = "imotara.typing.speed.v1";
    const [webTypingSpeed, setWebTypingSpeed] = useState<"slow" | "normal" | "fast">("normal");
    useEffect(() => {
        try {
            const v = localStorage.getItem(WEB_TYPING_SPEED_KEY);
            if (v === "slow" || v === "normal" || v === "fast") setWebTypingSpeed(v);
        } catch { /* ignore */ }
    }, []);
    function handleWebTypingSpeedChange(val: "slow" | "normal" | "fast") {
        setWebTypingSpeed(val);
        try { localStorage.setItem(WEB_TYPING_SPEED_KEY, val); } catch { /* ignore */ }
    }

    // P-1: Adult content guard sensitivity (web)
    const WEB_CONTENT_GUARD_KEY = "imotara.content.guard.v1";
    const [webContentGuard, setWebContentGuard] = useState<"strict" | "standard" | "relaxed">("standard");
    useEffect(() => {
        try {
            const v = localStorage.getItem(WEB_CONTENT_GUARD_KEY);
            if (v === "strict" || v === "standard" || v === "relaxed") setWebContentGuard(v as "strict" | "standard" | "relaxed");
        } catch { /* ignore */ }
    }, []);
    function handleWebContentGuardChange(val: "strict" | "standard" | "relaxed") {
        setWebContentGuard(val);
        try { localStorage.setItem(WEB_CONTENT_GUARD_KEY, val); } catch { /* ignore */ }
    }

    // P-2: Crisis detection threshold (web)
    const WEB_CRISIS_THRESHOLD_KEY = "imotara.crisis.threshold.v1";
    const [webCrisisThreshold, setWebCrisisThreshold] = useState<"sensitive" | "standard" | "conservative">("standard");
    useEffect(() => {
        try {
            const v = localStorage.getItem(WEB_CRISIS_THRESHOLD_KEY);
            if (v === "sensitive" || v === "standard" || v === "conservative") setWebCrisisThreshold(v as "sensitive" | "standard" | "conservative");
        } catch { /* ignore */ }
    }, []);
    function handleWebCrisisThresholdChange(val: "sensitive" | "standard" | "conservative") {
        setWebCrisisThreshold(val);
        try { localStorage.setItem(WEB_CRISIS_THRESHOLD_KEY, val); } catch { /* ignore */ }
    }

    // ─── Advanced accordion ───────────────────────────────────────────────────
    const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => {
        try { return sessionStorage.getItem("imotara.settings.advanced.v1") === "true"; } catch { return false; }
    });
    function toggleAdvanced() {
        setAdvancedOpen((prev) => {
            const next = !prev;
            try { sessionStorage.setItem("imotara.settings.advanced.v1", String(next)); } catch { /* ignore */ }
            return next;
        });
    }

    // ─── Delete Account ──────────────────────────────────────────────────────
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteAccountMsg, setDeleteAccountMsg] = useState<string | null>(null);

    async function handleDeleteAccount() {
        if (deletingAccount) return;
        const step1 = typeof window !== "undefined"
            ? window.confirm("Delete your account? This will permanently remove all your conversations, memories, and settings. This cannot be undone.")
            : false;
        if (!step1) return;
        const step2 = typeof window !== "undefined"
            ? window.confirm("This is irreversible. Are you absolutely sure?")
            : false;
        if (!step2) return;

        setDeletingAccount(true);
        setDeleteAccountMsg(null);
        try {
            // Clear local data first
            try { localStorage.removeItem("imotara:history:v1"); } catch { /* ignore */ }
            try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }

            // Call server-side account delete (uses cookie session)
            const res = await fetch("/api/account/delete", { method: "DELETE" });
            if (res.ok || res.status === 404) {
                setDeleteAccountMsg("Account deleted. All your data has been removed.");
                // Sign out via Supabase browser client
                try {
                    const { createBrowserClient } = await import("@supabase/ssr");
                    const sb = createBrowserClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    );
                    await sb.auth.signOut();
                } catch { /* ignore — user is already effectively signed out */ }
            } else {
                setDeleteAccountMsg("Could not delete account — please contact support.");
            }
        } catch {
            setDeleteAccountMsg("Something went wrong. Please try again.");
        } finally {
            setDeletingAccount(false);
        }
    }

    async function refreshLicenseStatus() {
        try {
            setLicLoading(true);
            const res = await fetch("/api/license/status", { method: "GET" });
            const json = (await res.json()) as LicenseStatusResponse;
            setLic(json);
        } catch (e: any) {
            setLic({ ok: false, error: e?.message || "Failed to read license status" });
        } finally {
            setLicLoading(false);
        }
    }

    async function refreshDonations() {
        // Always start from local receipts so the list is never empty for anonymous users
        const local = loadLocalDonations();

        try {
            setDonLoading(true);

            const res = await fetch("/api/donations/recent?limit=10", { method: "GET" });
            const json = await res.json();

            if (!res.ok || !json?.ok) {
                // Server unavailable / not authed — show local only, no error shown to user
                setDonations(local);
                return;
            }

            const serverItems: any[] = Array.isArray(json.items) ? json.items : [];

            // Merge: server items take precedence (richer data); fill in any local-only entries
            const serverPaymentIds = new Set(
                serverItems.map((d: any) => d.razorpay_payment_id).filter(Boolean)
            );
            const localOnly = local.filter((r) => !serverPaymentIds.has(r.paymentId));

            // Normalise local-only items to a display-compatible shape
            const normalisedLocal = localOnly.map((r) => ({
                id: r.paymentId,
                razorpay_payment_id: r.paymentId,
                razorpay_order_id: r.orderId ?? null,
                amount_paise: r.amount,
                currency: r.currency,
                status: "captured",
                is_test: false,
                created_at: new Date(r.timestamp).toISOString(),
                _source: "local" as const,
            }));

            // Sort combined list newest-first
            const combined = [...serverItems, ...normalisedLocal].sort(
                (a, b) =>
                    new Date(b.created_at ?? 0).getTime() -
                    new Date(a.created_at ?? 0).getTime()
            );

            setDonations(combined);
        } catch {
            // Network error — show local only
            setDonations(local);
        } finally {
            setDonLoading(false);
        }
    }


    useEffect(() => {
        // ✅ ensure client-only rendering for locale-dependent content
        setMounted(true);

        // Load Link Key (optional)
        try {
            const raw = localStorage.getItem(CHAT_LINK_KEY);
            if (raw) setLinkKey(raw);
        } catch { }

        // Read-only licensing status on page load
        refreshLicenseStatus();


        // Preload Razorpay script in the background for smoother UX
        setRzLoading(true);
        loadRazorpayScript()
            .then((ok) => setRzReady(!!ok))
            .catch(() => setRzReady(false))
            .finally(() => setRzLoading(false));

        // Load local receipts (always — no auth needed)
        setDonations(loadLocalDonations());
        // Also try fetching from server (works when user is signed in)
        refreshDonations();
        // Load companion memories (server-side; no-ops if not authenticated)
        loadMemories();
    }, []);

    async function handleDonate(presetId: string, presetLabel: string) {
        if (typeof window === "undefined") return;

        try {
            setDonating(true);
            setDonateStatus(null);

            // ✅ If script isn't ready yet, fail softly (buttons are disabled anyway)
            if (typeof window === "undefined") return;

            // If Razorpay isn't already present, try loading once
            if (!(window as any).Razorpay) {
                const scriptOk = await loadRazorpayScript();
                if (!scriptOk) {
                    setDonateStatus("Checkout is still loading. Please try again in a moment.");
                    return;
                }
            }

            const res = await fetch("/api/payments/donation-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    presetId,
                    purpose: "imotara_donation",
                    platform: "web",
                }),
            });

            const json = (await res.json()) as DonationIntentResponse;

            if (!res.ok || !json.ok || !json.razorpay) {
                setDonateStatus(json?.error || "Donation order failed.");
                return;
            }

            const rz = json.razorpay;

            const options: any = {
                key: rz.keyId,
                amount: rz.amount,
                currency: rz.currency || "INR",
                name: "Imotara",
                description:
                    "Support Imotara (UPI preferred) — privacy-first, non-commercial Indian initiative",
                order_id: rz.orderId,
                method: {
                    upi: true,
                    card: true,
                    netbanking: true,
                    wallet: false,
                },
                notes: {
                    purpose: "imotara_donation",
                },
                theme: { color: "#38bdf8" },
                handler: function (response: any) {
                    const pid = response?.razorpay_payment_id as string | undefined;

                    // ✅ Persist locally immediately — no server auth needed for receipt display
                    if (pid && rz.amount) {
                        saveLocalDonation({
                            paymentId: pid,
                            orderId: rz.orderId,
                            amount: rz.amount,
                            currency: rz.currency || "INR",
                            timestamp: Date.now(),
                        });
                        // Reflect new local receipt in UI immediately
                        setDonations(loadLocalDonations());
                    }

                    setDonateStatus("Donation received — thank you for supporting Imotara 🙏");

                    // Also attempt server refresh (succeeds when user is signed in)
                    void refreshDonations();
                },
                modal: {
                    ondismiss: function () {
                        setDonateStatus("Checkout closed. No payment was made.");
                    },
                },
            };

            const rzp = new (window as any).Razorpay(options);

            // ✅ Handle failure without breaking settings/chat
            rzp.on("payment.failed", function (resp: any) {
                const msg =
                    resp?.error?.description ||
                    resp?.error?.reason ||
                    resp?.error?.code ||
                    "Please try again.";
                setDonateStatus(`Payment failed. ${msg}`);
            });

            rzp.open();
        } catch (e: any) {
            setDonateStatus(e?.message || "Donation failed.");
        } finally {
            setDonating(false);
        }
    }

    const tierLabel = useMemo(() => {
        const t = (lic?.tier || "free").toLowerCase();
        if (t === "pro"      || t === "premium")    return "Pro";
        if (t === "plus")                           return "Plus";
        if (t === "family")                         return "Family";
        if (t === "edu"      || t === "education")  return "Education";
        if (t === "enterprise")                     return "Enterprise";
        return "Free";
    }, [lic?.tier]);

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-50 sm:px-6">
            <div className="space-y-6 text-sm text-zinc-100">
                {/* Page header */}
                <header className="imotara-glass-card rounded-2xl px-4 py-5 sm:px-5 sm:py-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                        Imotara · Settings
                    </p>
                    <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                        Settings &amp; Data
                    </h1>
                    <p className="mt-2 text-xs leading-6 text-zinc-400 sm:text-sm">
                        A single place to see your current analysis mode and manage how
                        Imotara stores data on this device.
                    </p>
                </header>

                {/* ── Group 1: Your companion ──────────────────────────── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">Your companion</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Tone & Context Preferences */}
                {mounted && <ToneAndContextTile />}

                {/* ── Group 2: Plan & support ──────────────────────────── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">Plan &amp; support</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Licensing — your plan card */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Your plan</h2>
                        <button
                            type="button"
                            onClick={refreshLicenseStatus}
                            disabled={licLoading}
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition disabled:opacity-40"
                        >
                            {licLoading ? "Refreshing…" : "Refresh"}
                        </button>
                    </div>

                    {/* Launch offer banner */}
                    {mounted && (() => {
                        const launchRaw = process.env.NEXT_PUBLIC_IMOTARA_LAUNCH_DATE;
                        const freeDays = parseInt(process.env.NEXT_PUBLIC_IMOTARA_FREE_DAYS ?? "90", 10) || 90;
                        if (!launchRaw) return null;
                        const launchMs = Date.parse(launchRaw);
                        if (isNaN(launchMs)) return null;
                        const endsAt = new Date(launchMs + freeDays * 24 * 60 * 60 * 1000);
                        if (Date.now() >= endsAt.getTime()) return null;
                        return (
                            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                                <span className="text-lg leading-none">🎁</span>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-200">
                                        Launch offer — everything free for everyone
                                    </p>
                                    <p className="mt-0.5 text-xs text-emerald-300/80">
                                        All Pro features are available at no cost until{" "}
                                        <span className="font-medium">
                                            {endsAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                                        </span>.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Current plan card */}
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                        {/* Tier badge */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                    tierLabel === "Pro"    ? "bg-indigo-500/25 text-indigo-300 border border-indigo-400/30" :
                                    tierLabel === "Plus"   ? "bg-sky-500/25 text-sky-300 border border-sky-400/30" :
                                    tierLabel === "Family" ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/30" :
                                    "bg-zinc-500/25 text-zinc-300 border border-zinc-400/20"
                                }`}>
                                    {tierLabel}
                                </span>
                                {lic?.license?.status === "trial" && (
                                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/20">
                                        Trial
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Feature bullets for current tier */}
                        <ul className="mt-3 space-y-1">
                            {(tierLabel === "Pro" ? [
                                "Unlimited replies",
                                "Unlimited history",
                                "Emotion insights (radar & heatmap)",
                                "Data export (JSON)",
                                "Cloud sync",
                            ] : tierLabel === "Plus" ? [
                                "Unlimited replies",
                                "90-day cloud history",
                                "Cloud sync",
                                "Companion mode",
                            ] : tierLabel === "Family" ? [
                                "Unlimited history",
                                "Cloud sync",
                                "Multi-profile support",
                                "Child-safe mode",
                            ] : [
                                "20 replies / day",
                                "On-device replies (unlimited)",
                                "7-day history",
                            ]).map((f) => (
                                <li key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-emerald-400" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA */}
                    {tierLabel === "Free" && (
                        <div className="mt-4">
                            <p className="mb-2 text-xs text-zinc-400">
                                Remove the daily reply limit, extend history to 90 days or unlimited, and unlock insights.
                            </p>
                            <Link
                                href="/upgrade"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
                            >
                                View plans &amp; upgrade →
                            </Link>
                        </div>
                    )}
                    {tierLabel === "Plus" && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Link
                                href="/upgrade"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
                            >
                                Upgrade to Pro →
                            </Link>
                            <span className="text-[11px] text-zinc-500">Adds unlimited history + insights</span>
                        </div>
                    )}
                    {(tierLabel === "Pro" || tierLabel === "Family") && (
                        <p className="mt-3 text-xs text-zinc-500">
                            Need to manage your subscription?{" "}
                            <Link href="/upgrade" className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100 transition">
                                Visit the upgrade page
                            </Link>
                        </p>
                    )}

                    {lic?.error && (
                        <p className="mt-3 text-[11px] text-rose-200/90">{lic.error}</p>
                    )}
                </section>

                {/* Donations (web) */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Support Imotara (Donate)
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        Imotara is privacy-first and non-commercial. Donations help keep it
                        running and improving. (UPI preferred)
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        {DONATION_PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleDonate(p.id, p.label)}
                                disabled={donating || rzLoading || !rzReady}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                                title={`Donate ${formatINRFromPaise(p.amount)}`}
                            >
                                {donating ? "Opening…" : p.label}
                            </button>
                        ))}
                    </div>

                    {donateStatus && (
                        <p className="mt-3 text-[11px] text-zinc-400">{donateStatus}</p>
                    )}

                    <p className="mt-3 text-[11px] text-zinc-500">
                        Note: Final confirmation is recorded via secure server webhook after payment.
                    </p>
                </section>

                {/* Recent donations — always shown, sourced from localStorage + server */}
                {mounted && (
                    <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                                    Your Donations
                                </h2>
                                <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                                    Receipts are saved on this device immediately. Server records sync when you&apos;re signed in.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={refreshDonations}
                                disabled={donLoading}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {donLoading ? "Refreshing…" : "Refresh"}
                            </button>
                        </div>

                        {donations.length === 0 && (
                            <p className="mt-3 text-[11px] text-zinc-500">
                                No donations yet on this device.
                            </p>
                        )}

                        {donations.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {donations.map((d: any) => (
                                    <div
                                        key={d.id ?? d.razorpay_payment_id}
                                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-zinc-50">
                                                {formatINRFromPaise(Number(d.amount_paise || 0))}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-zinc-400">
                                                    {String(d.status || "captured").toUpperCase()}
                                                </span>
                                                {d.is_test && (
                                                    <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                                                        TEST
                                                    </span>
                                                )}
                                                {d._source === "local" && (
                                                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                                                        local
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="mt-1 text-[10px] text-zinc-500 font-mono">
                                            {d.razorpay_payment_id || "—"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-zinc-500">
                                            {d.created_at
                                                ? new Date(d.created_at).toLocaleString()
                                                : ""}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* ── Group 3: Experience ──────────────────────────────── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">Experience</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Browser push notifications */}
                {mounted && "Notification" in window && "PushManager" in window && (
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Browser notifications</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Get a gentle daily reminder to check in, even when the tab is closed.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                        {notifPermission === "denied" ? (
                            <p className="text-xs text-rose-400">
                                Notifications blocked by your browser. Allow them in your browser&apos;s site settings, then reload.
                            </p>
                        ) : notifSubscribed ? (
                            <button
                                type="button"
                                onClick={disableNotifications}
                                disabled={notifLoading}
                                className="rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/15 disabled:opacity-50"
                            >
                                {notifLoading ? "Disabling…" : "Disable notifications"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={enableNotifications}
                                disabled={notifLoading}
                                className="im-cta-bg rounded-xl px-4 py-2 text-xs font-medium text-black shadow transition hover:brightness-110 disabled:opacity-50"
                            >
                                {notifLoading ? "Enabling…" : "Enable notifications"}
                            </button>
                        )}
                        {notifSubscribed && (
                            <span className="text-xs text-emerald-400">Active ✓</span>
                        )}
                    </div>
                    {notifToast && (
                        <p className="mt-2 text-xs text-rose-400">{notifToast}</p>
                    )}
                    {/* Inactivity threshold */}
                    {notifSubscribed && (
                    <div className="mt-4">
                        <p className="text-xs font-medium text-zinc-300">Remind me if I haven&apos;t visited in</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {([24, 48, 72, 168] as const).map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => handleNotifInactivityChange(h)}
                                    className={`rounded-full border px-3 py-1 text-[11px] transition ${notifInactivityHours === h ? "border-sky-400/60 bg-sky-500/15 text-sky-300" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                                >
                                    {h === 168 ? "7 days" : h === 24 ? "24 h" : `${h} h`}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}
                </section>
                )}

                {/* ── Chat behaviour preferences ──────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Chat behaviour</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">Control what appears in your chat window.</p>

                    {/* Hands-free mode */}
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Hands-free conversation</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Speak → Imotara types, replies, and reads aloud — no tapping needed</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={handsfree}
                            onClick={() => handleHandsfreeToggle(!handsfree)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${handsfree ? "bg-violet-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${handsfree ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* G-4: Grow nudge permanent dismiss */}
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Hide &quot;Grow&quot; nudge</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Permanently hide the Grow feature suggestion in Chat</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={growNudgePerm}
                            onClick={() => handleGrowNudgePermToggle(!growNudgePerm)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${growNudgePerm ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${growNudgePerm ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* A-4: Tone reflection visibility */}
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Show tone reflection card</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Show the emotion summary card after sessions</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showToneReflect}
                            onClick={() => handleToneReflectToggle(!showToneReflect)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showToneReflect ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showToneReflect ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* U-1: Trial banner permanent dismiss */}
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Hide upgrade banner</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Permanently hide the upgrade notice in Chat (not just for today)</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={trialBannerPerm}
                            onClick={() => handleTrialBannerPermToggle(!trialBannerPerm)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${trialBannerPerm ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${trialBannerPerm ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* C-4: Return greeting threshold */}
                    <div className="mt-4">
                        <p className="mb-1 text-xs font-medium text-zinc-400">Return greeting after</p>
                        <p className="mb-2 text-[11px] text-zinc-500">Imotara greets you warmly when you haven&apos;t chatted for this long</p>
                        <div className="flex flex-wrap gap-2">
                            {RETURN_GREETING_OPTIONS.map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => handleReturnGreetingChange(h)}
                                    className={`rounded-full border px-4 py-1.5 text-xs transition ${
                                        returnGreetingHours === h
                                            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* U-3: Search mode */}
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Exact history search</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Match only exact phrases in history search (off = fuzzy match)</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={searchMode === "exact"}
                            onClick={() => handleSearchModeChange(searchMode === "exact" ? "fuzzy" : "exact")}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${searchMode === "exact" ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${searchMode === "exact" ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* U-2: Reactions set */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Message reactions</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["minimal", "default", "extended"] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleWebReactionsSetChange(v)}
                                    className={`flex-1 text-center rounded-full px-4 py-1 text-xs transition ${
                                        webReactionsSet === v
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {v === "minimal" ? "Minimal" : v === "default" ? "Default" : "Extended"}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">Controls the number of emoji reactions shown on messages.</p>
                    </div>
                </section>

                {/* ── Mindset Analysis Toggles ─────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Mindset Analysis</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Choose which time windows appear as psychological summaries on your History page.
                    </p>
                    {([
                        { key: "today",   label: "Today's mindset analysis",       desc: "A psychological snapshot of today's conversations." },
                        { key: "week7",   label: "Last 7 days mindset analysis",   desc: "A 7-day emotional pattern overview." },
                        { key: "days30",  label: "Last 30 days mindset analysis",  desc: "A 30-day mood trend summary." },
                        { key: "allTime", label: "All time mindset analysis",      desc: "A complete overview since you started." },
                    ] as { key: keyof MindsetPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                        <div key={key} className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                            <div>
                                <p className="text-xs font-medium text-zinc-200">{label}</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">{desc}</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={mindsetPrefs[key]}
                                onClick={() => handleMindsetToggle(key)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${mindsetPrefs[key] ? "bg-violet-500" : "bg-zinc-600"}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mindsetPrefs[key] ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                        </div>
                    ))}
                </section>

                {/* ── Appearance ─────────────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Appearance</h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400">Accent colour and text size — saved on this device.</p>

                    {/* Accent picker */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Accent colour</p>
                        <div className="flex flex-wrap gap-2">
                            {ACCENT_OPTIONS.map((o) => {
                                const active = accent === o.value;
                                const swatchStyle = o.gradient
                                    ? { backgroundImage: o.gradient }
                                    : { backgroundColor: o.color };
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        onClick={() => setAccent(o.value)}
                                        title={o.value === "twilight" ? "Twilight (default)" : o.label}
                                        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition"
                                        style={active ? {
                                            borderColor: o.color,
                                            backgroundColor: `${o.color}28`,
                                            color: "#f4f4f5",
                                            boxShadow: `0 0 14px ${o.color}55`,
                                        } : {
                                            borderColor: "rgba(255,255,255,0.10)",
                                            backgroundColor: "rgba(255,255,255,0.05)",
                                            color: "#a1a1aa",
                                        }}
                                    >
                                        <span className="h-3 w-3 rounded-full shrink-0" style={swatchStyle} />
                                        {o.label}
                                        {active && <span className="ml-0.5 text-[10px] opacity-60">✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Font size */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Text size</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {FONT_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setFontSize(o.value)}
                                    className={`flex-1 text-center rounded-full px-4 py-1 transition ${
                                        fontSize === o.value
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                    style={{ fontSize: o.value === "sm" ? "11px" : o.value === "lg" ? "15px" : "13px" }}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color mode */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Color mode</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["dark", "light"] as ColorMode[]).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setColorMode(m)}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1 text-xs transition ${
                                        colorMode === m
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <span aria-hidden>{m === "dark" ? "🌙" : "☀️"}</span>
                                    {m === "dark" ? "Dark" : "Light"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* H-1: Haptic feedback */}
                    <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Haptic feedback</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Vibration on taps and emotion moments (mobile browsers)</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={hapticEnabled}
                            onClick={() => handleHapticToggle(!hapticEnabled)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${hapticEnabled ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hapticEnabled ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* C-2: Reduced motion */}
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Reduced motion</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Use instant scroll instead of smooth animation (helps with motion sensitivity)</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={reducedMotion}
                            onClick={() => handleReducedMotionToggle(!reducedMotion)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${reducedMotion ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reducedMotion ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* C-3: Show timestamps */}
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                        <div>
                            <p className="text-xs font-medium text-zinc-200">Show message timestamps</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Display time sent on each chat bubble</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showTimestamps}
                            onClick={() => handleShowTimestampsToggle(!showTimestamps)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showTimestamps ? "bg-sky-500" : "bg-zinc-600"}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showTimestamps ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* C-1: Typing indicator speed */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Typing indicator speed</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["slow", "normal", "fast"] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleWebTypingSpeedChange(v)}
                                    className={`flex-1 text-center rounded-full px-4 py-1 text-xs transition ${
                                        webTypingSpeed === v
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {v === "slow" ? "Slow" : v === "normal" ? "Normal" : "Fast"}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">Speed of the animated dots while Imotara is composing a reply.</p>
                    </div>

                    {/* H-3: TTS rate + pitch */}
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3 space-y-3">
                        <p className="text-xs font-medium text-zinc-200">Voice playback speed &amp; pitch</p>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-zinc-400">
                                <span>Speed: {ttsRate.toFixed(2)}×</span>
                                <span className="text-zinc-600">0.50 — 1.50</span>
                            </div>
                            <input type="range" min="0.5" max="1.5" step="0.05" value={ttsRate}
                                onChange={(e) => handleTtsRateChange(parseFloat(e.target.value))}
                                className="w-full accent-sky-400 cursor-pointer" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-zinc-400">
                                <span>Pitch: {ttsPitch.toFixed(2)}</span>
                                <span className="text-zinc-600">0.50 — 1.50</span>
                            </div>
                            <input type="range" min="0.5" max="1.5" step="0.05" value={ttsPitch}
                                onChange={(e) => handleTtsPitchChange(parseFloat(e.target.value))}
                                className="w-full accent-sky-400 cursor-pointer" />
                        </div>
                        <p className="text-[10px] text-zinc-600">Applies to voice preview on avatar taps in Chat.</p>
                    </div>
                </section>

                {/* ── Group 4: Privacy & safety ────────────────────────── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">Privacy &amp; safety</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Analysis mode overview */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Emotion analysis mode
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        This mode is shared between Chat, History, and Settings and is stored only in
                        this browser.
                    </p>

                    <div className="mt-3 inline-flex flex-wrap items-center gap-2">
                        <span
                            className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] backdrop-blur-sm",
                                consentBadgeClass,
                            ].join(" ")}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : mode === "auto" ? "bg-violet-400" : "bg-zinc-500"
                                    }`}
                            />
                            {consentLabel}
                        </span>

                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-300">
                            Change this from the Chat page using the toggle.
                        </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        <Link
                            href="/chat"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                        >
                            Go to Chat
                        </Link>
                        <Link
                            href="/history"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                        >
                            View Emotion History
                        </Link>
                    </div>
                </section>

                {/* ── Safety settings ──────────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Safety &amp; crisis resources</h2>

                    {/* A-3: Auto-routing transparency */}
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        In <span className="text-zinc-200 font-medium">Auto</span> mode, Imotara tries local analysis first. Data is sent to the cloud only when local confidence is low.
                        Use <span className="text-zinc-200 font-medium">Local only</span> to keep everything on-device.
                    </p>

                    {/* P-3: Crisis country override */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Crisis resources country</p>
                        <p className="mb-2 text-[11px] text-zinc-500">By default, resources are auto-detected from your browser locale. Override if you need resources for a different country.</p>
                        <select
                            value={crisisCountry}
                            onChange={(e) => handleCrisisCountryChange(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20"
                        >
                            {CRISIS_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* P-1: Content guard sensitivity */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Content sensitivity</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["relaxed", "standard", "strict"] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleWebContentGuardChange(v)}
                                    className={`flex-1 text-center rounded-full px-4 py-1 text-xs transition ${
                                        webContentGuard === v
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {v === "relaxed" ? "Relaxed" : v === "standard" ? "Standard" : "Strict"}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">Strict blocks adult content; Relaxed turns off the content filter.</p>
                    </div>

                    {/* P-2: Crisis detection threshold */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Crisis detection sensitivity</p>
                        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["sensitive", "standard", "conservative"] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleWebCrisisThresholdChange(v)}
                                    className={`flex-1 text-center rounded-full px-4 py-1 text-xs transition ${
                                        webCrisisThreshold === v
                                            ? "im-seg-selected bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {v === "sensitive" ? "Sensitive" : v === "standard" ? "Standard" : "Conservative"}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">Sensitive surfaces resources at earliest signs; Conservative only for clear distress.</p>
                    </div>
                </section>

                {/* Local data controls */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Local data controls
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        These actions affect only this browser on this device. They do not
                        touch any future cloud backups or accounts.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        <button
                            type="button"
                            onClick={handleClearChat}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "chat" || busy === "all" ? "Clearing chat…" : "Clear Chat conversations"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearHistory}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "history" || busy === "all" ? "Clearing history…" : "Clear Emotion History"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={busy !== null}
                            className="rounded-xl border border-rose-400/50 bg-rose-600/20 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "all" ? "Clearing all…" : "Clear ALL local Imotara data"}
                        </button>
                    </div>

                    {status && <p className="mt-3 text-[11px] text-zinc-400">{status}</p>}
                </section>

                {/* ── Export Data (JSON) ──────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Export data</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Download all your local chat history as a JSON file. This only includes messages stored on this device.
                    </p>
                    <button
                        type="button"
                        onClick={handleExportData}
                        disabled={exportBusy}
                        className="mt-3 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-50"
                    >
                        {exportBusy ? "Preparing…" : "Download JSON"}
                    </button>
                </section>

                {/* ── Remote History Sync ─────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Remote history sync</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Push your local history to the Imotara cloud and pull any records from other devices. Requires being signed in.
                    </p>
                    <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={syncBusy}
                        className="mt-3 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
                    >
                        {syncBusy ? "Syncing…" : "Sync now"}
                    </button>
                    {syncMsg && <p className="mt-2 text-[11px] text-zinc-400">{syncMsg}</p>}
                </section>

                {/* Cross-device continuity (optional) */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Sync with another device (optional)
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        If you enter the same Link Key on both Web and Mobile, your remote chat history
                        will appear on both. Treat this key like a private password.
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <input
                            value={linkKey}
                            onChange={(e) => {
                                setLinkKey(e.target.value);
                                setLinkKeyStatus(null);
                            }}
                            placeholder="Paste a Link Key (e.g., 8–20 characters)"
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/20"
                        />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={saveLinkKey}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-100 shadow-sm transition hover:bg-white/20"
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={copyLinkKey}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-100 shadow-sm transition hover:bg-white/20"
                            >
                                Copy
                            </button>
                            <button
                                type="button"
                                onClick={clearLinkKey}
                                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-zinc-100 shadow-sm transition hover:bg-black/45"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {linkKeyStatus ? (
                        <p className="mt-2 text-xs text-zinc-400">{linkKeyStatus}</p>
                    ) : null}

                    <p className="mt-3 text-[11px] text-zinc-500">
                        Tip: Use a short memorable phrase (no spaces) and set the same value on mobile later.
                    </p>
                </section>

                {/* ── Group 5: Advanced ────────────────────────────────── */}
                <button
                    type="button"
                    onClick={toggleAdvanced}
                    className="flex w-full items-center gap-2"
                    aria-expanded={advancedOpen}
                >
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">Advanced</span>
                    <div className="flex-1 h-px bg-white/10" />
                    <svg
                        className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <polyline points="2,4 6,8 10,4" />
                    </svg>
                </button>

                {advancedOpen && (<>

                {/* ── Companion insights ───────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Companion insights</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">Control how often Imotara generates your emotional arc, companion letter, and open-loop prompts.</p>

                    {/* G-1: Emotional arc cadence */}
                    <div className="mt-4">
                        <p className="mb-1 text-xs font-medium text-zinc-400">Emotional arc — every</p>
                        <p className="mb-2 text-[11px] text-zinc-500">How many days between narrative summaries of your emotional journey</p>
                        <div className="flex flex-wrap gap-2">
                            {[7, 14, 30, 60].map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => handleWebArcCadenceChange(d)}
                                    className={`rounded-full border px-4 py-1.5 text-xs transition ${
                                        webArcCadenceDays === d
                                            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {d} days
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* G-2: Companion letter cadence */}
                    <div className="mt-4">
                        <p className="mb-1 text-xs font-medium text-zinc-400">Companion letter — every</p>
                        <p className="mb-2 text-[11px] text-zinc-500">How many days between personal letters from your companion</p>
                        <div className="flex flex-wrap gap-2">
                            {[7, 14, 30, 60].map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => handleWebLetterCadenceChange(d)}
                                    className={`rounded-full border px-4 py-1.5 text-xs transition ${
                                        webLetterCadenceDays === d
                                            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {d} days
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* G-3: Open-loop thresholds */}
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/4 px-3 py-3 space-y-3">
                        <p className="text-xs font-medium text-zinc-200">Open-loop detection</p>
                        <div className="space-y-1">
                            <p className="mb-1 text-[11px] text-zinc-400">Minimum threads before showing a prompt</p>
                            <div className="flex flex-wrap gap-2">
                                {[2, 3, 5, 8].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => handleWebOpenLoopThreadsChange(n)}
                                        className={`rounded-full border px-3 py-1 text-xs transition ${
                                            webOpenLoopThreads === n
                                                ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                                : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="mb-1 text-[11px] text-zinc-400">Minimum days since last mention</p>
                            <div className="flex flex-wrap gap-2">
                                {[7, 14, 21, 30].map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => handleWebOpenLoopAgeChange(d)}
                                        className={`rounded-full border px-3 py-1 text-xs transition ${
                                            webOpenLoopAgeDays === d
                                                ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                                : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                        }`}
                                    >
                                        {d}d
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── History management ───────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">History management</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">Auto-delete emotion history older than a chosen threshold to manage storage.</p>

                    {/* M-2: Auto-cleanup */}
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Auto-delete records older than</p>
                        <div className="flex flex-wrap gap-2">
                            {AUTO_CLEANUP_OPTIONS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => handleAutoCleanupChange(d)}
                                    className={`rounded-full border px-4 py-1.5 text-xs transition ${
                                        autoCleanupDays === d
                                            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {d === 0 ? "Never" : `${d} days`}
                                </button>
                            ))}
                        </div>
                        {autoCleanupDays > 0 && (
                            <p className="mt-2 text-[11px] text-zinc-500">Records older than {autoCleanupDays} days will be removed when you open this page.</p>
                        )}
                    </div>
                </section>

                {/* ── Tips, tours & notices ────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Tips &amp; tours</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">Reset in-app tips and feature discovery cards.</p>
                    <div className="mt-4 space-y-3">
                        {/* O-1: Discovery reset */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                            <div>
                                <p className="text-xs font-medium text-zinc-200">Feature discovery cards</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">Cards that introduce Trends, Offline mode, Companion, and more</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDiscoveryReset}
                                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                            >
                                Reset
                            </button>
                        </div>
                        {discoveryResetMsg && <p className="text-[11px] text-sky-400">{discoveryResetMsg}</p>}

                        {/* O-3: First-message tip reset */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                            <div>
                                <p className="text-xs font-medium text-zinc-200">Welcome tip</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">The starter prompt shown when you open Chat for the first time</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleFirstMsgReset}
                                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                            >
                                Reset
                            </button>
                        </div>
                        {firstMsgResetMsg && <p className="text-[11px] text-sky-400">{firstMsgResetMsg}</p>}
                    </div>
                </section>

                {/* ── Data dashboard ──────────────────────────────────── */}
                <DataDashboard getStorageSummary={getStorageSummary} />

                {/* ── Emotional fingerprint ────────────────────────────── */}
                <EmotionalFingerprint />

                {/* ── Companion memory viewer ──────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Companion memory</h2>
                            <p className="mt-0.5 text-xs text-zinc-500">
                                Things Imotara has learned about you — used to personalise responses.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={loadMemories}
                            disabled={memoriesLoading}
                            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                        >
                            {memoriesLoading ? "Loading…" : "Refresh"}
                        </button>
                    </div>

                    {memories.length === 0 && !memoriesLoading && (
                        <p className="mt-3 text-xs text-zinc-500 italic">
                            No memories yet — Imotara will pick up facts as you chat.
                        </p>
                    )}

                    {memories.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {memories.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs text-zinc-100">{m.value}</p>
                                        <p className="mt-0.5 text-[10px] text-zinc-500">
                                            {m.type} · {m.key} · {Math.round(m.confidence * 100)}% confidence
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => deleteMemory(m.id)}
                                        disabled={memoriesDeletingId === m.id}
                                        aria-label="Forget this memory"
                                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-zinc-500 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40"
                                    >
                                        {memoriesDeletingId === m.id ? "…" : "Forget"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* NF-3: Family Emotional Snapshot */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <div className="mb-3">
                        <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Family Snapshot</h2>
                        <p className="mt-1 text-xs text-zinc-400">
                            Share a private link showing your week&apos;s emotional tone. No account needed — it&apos;s encoded in the link.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={generateFamilySnapshot}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                        Generate snapshot link
                    </button>
                    {familySnapUrl && (
                        <div className="mt-3 space-y-2 animate-fade-in">
                            <p className="break-all rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400 select-all">
                                {familySnapUrl}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={copyFamilySnapUrl}
                                    className="text-[11px] text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition"
                                >
                                    {familySnapCopied ? "Copied ✓" : "Copy link"}
                                </button>
                                <a
                                    href={familySnapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition underline underline-offset-2"
                                >
                                    Preview →
                                </a>
                            </div>
                            <p className="text-[10px] text-zinc-600">This link encodes your data locally — nothing is sent to a server.</p>
                        </div>
                    )}
                </section>

                {/* B-5: How It Works — prominent card (mirrors mobile HowItWorksModal) */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">ℹ️</span>
                        <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">How to use Imotara</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {([
                            { icon: "💬", title: "Just talk", body: "Share what's on your mind — worries, stress, or how your day went. No right way to start. Imotara listens without judgement." },
                            { icon: "🌐", title: "Works everywhere", body: "Online? Imotara crafts thoughtful replies. Offline? Local mode keeps conversations going — no interruptions." },
                            { icon: "🎨", title: "Make it yours", body: "Choose your companion's name, tone, language, and response style. Adjust accent colour and text size in Appearance above." },
                            { icon: "🔒", title: "Your data, your control", body: "Everything stays on this device unless you choose to sync. Nothing is sold. Export or delete your history anytime from Settings." },
                        ] as { icon: string; title: string; body: string }[]).map((step) => (
                            <div key={step.title} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                                <span className="mt-0.5 text-xl shrink-0">{step.icon}</span>
                                <div>
                                    <p className="text-xs font-semibold text-zinc-100">{step.title}</p>
                                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{step.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href="/guide"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                        >
                            Full guide →
                        </Link>
                        <Link
                            href="/privacy"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
                        >
                            Privacy policy
                        </Link>
                        <Link
                            href="/terms"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
                        >
                            Terms
                        </Link>
                    </div>
                </section>

                {/* Data & privacy copy */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Data &amp; privacy</h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        Imotara is designed as a quiet, local-first experiment. Most data is
                        stored only in this browser unless you explicitly allow remote
                        analysis or sync.
                    </p>

                    <p className="mt-3 text-[11px] text-zinc-500">
                        For full details, see our{" "}
                        <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-300">Privacy</Link>{" "}
                        and{" "}
                        <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-300">Terms</Link>{" "}
                        pages.
                    </p>
                </section>

                </>)}

                {/* ── Delete Account ───────────────────────────────────── */}
                <section className="imotara-glass-soft rounded-2xl border border-rose-500/15 px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-rose-300 sm:text-base">Delete account</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Permanently delete your Imotara account and all associated data — conversations, memories, and settings. This cannot be undone.
                    </p>
                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount}
                        className="mt-3 rounded-xl border border-rose-500/40 bg-rose-600/15 px-4 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-600/25 disabled:opacity-50"
                    >
                        {deletingAccount ? "Deleting…" : "Delete my account"}
                    </button>
                    {deleteAccountMsg && (
                        <p className="mt-2 text-[11px] text-zinc-400">{deleteAccountMsg}</p>
                    )}
                </section>

                {/* Version footer intentionally removed (global footer already shows version) */}
            </div>
        </main>
    );
}
