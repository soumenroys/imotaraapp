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

function speakPreview(gender: string, lang: string, onResult?: (info: string, missing: boolean) => void) {
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

        // Non-English: always use pre-generated Azure MP3s — they have proper
        // gender-specific voices. Native TTS for non-English typically only ships
        // one voice (usually female, e.g. Lekha for Hindi) so gender selection
        // would be ignored. Azure MP3s are pre-generated with correct male/female.
        if (lang !== "en") {
            const genderFile = previewGenderFile(gender);
            const src = `/tts-preview/${lang}-${genderFile}.mp3`;
            onResult?.(`Azure Neural (${lang}-${genderFile})`, false);
            const audio = new Audio(src);
            audio.playbackRate = 0.95;
            audio.play().catch(err => console.warn("[speakPreview] audio play failed:", err));
            return;
        }

        // English: use native Web Speech API (always available, good gender support).
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

        const utt = new SpeechSynthesisUtterance(PREVIEW_TEXT_BY_LANG["en"]);
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

    useEffect(() => {
        // Hydration-safe: only read localStorage after mount
        const existing = safeParseProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
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
                                    onClick={() => speakPreview(userGender, preferredLang, (text, missing) => setUserVoiceInfo({ text, missing }))}
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
                                        onClick={() => speakPreview(compGender, preferredLang, (text, missing) => setCompVoiceInfo({ text, missing }))}
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
                                className={`rounded-full px-3 py-1 text-xs transition ${clearDays === d ? "bg-white/20 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}
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
            : mode === "local-only"
                ? "On-device only (local analysis)"
                : "Analysis mode: unknown";

    const consentBadgeClass =
        mode === "allow-remote"
            ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-200"
            : mode === "local-only"
                ? "border-zinc-400/70 bg-zinc-900/40 text-zinc-100"
                : "border-zinc-600/70 bg-zinc-900/60 text-zinc-300";

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
                                className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
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
                </section>
                )}

                {/* NEW: Tone & Context Preferences (client-only safe) */}
                {mounted && <ToneAndContextTile />}

                {/* Licensing — user-facing plan card */}
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
                                "Unlimited AI replies",
                                "Unlimited history",
                                "Emotion insights (radar & heatmap)",
                                "Data export (JSON)",
                                "Cloud sync",
                            ] : tierLabel === "Plus" ? [
                                "Unlimited AI replies",
                                "90-day cloud history",
                                "Cloud sync",
                                "Companion mode",
                            ] : tierLabel === "Family" ? [
                                "Unlimited history",
                                "Cloud sync",
                                "Multi-profile support",
                                "Child-safe mode",
                            ] : [
                                "20 AI replies / day",
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
                                Remove the daily AI limit, extend history to 90 days or unlimited, and unlock insights.
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

                {/* NEW: Donations (web) */}
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
                        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {FONT_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setFontSize(o.value)}
                                    className={`rounded-full px-4 py-1 transition ${
                                        fontSize === o.value
                                            ? "bg-white/20 text-zinc-50"
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
                        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
                            {(["dark", "light"] as ColorMode[]).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setColorMode(m)}
                                    className={`flex items-center gap-1.5 rounded-full px-4 py-1 text-xs transition ${
                                        colorMode === m
                                            ? "bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <span aria-hidden>{m === "dark" ? "🌙" : "☀️"}</span>
                                    {m === "dark" ? "Dark" : "Light"}
                                </button>
                            ))}
                        </div>
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

                {/* Data & privacy copy */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Data &amp; privacy</h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        Imotara is designed as a quiet, local-first experiment. Most data is
                        stored only in this browser unless you explicitly allow remote
                        analysis or sync.
                    </p>
                    <p className="mt-2 text-xs leading-6 text-zinc-400 sm:text-sm">
                        In upcoming steps, this page will let you download richer exports
                        and review how your information is used across devices.
                    </p>

                    <p className="mt-3 text-[11px] text-zinc-500">
                        For full details, see our{" "}
                        <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-300">
                            Privacy
                        </Link>{" "}
                        and{" "}
                        <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-300">
                            Terms
                        </Link>{" "}
                        pages.
                    </p>

                    <p className="mt-4 text-[11px] text-zinc-500">
                        New to Imotara?{" "}
                        <Link href="/guide" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
                            How to use Imotara →
                        </Link>
                    </p>
                </section>
                {/* Version footer intentionally removed (global footer already shows version) */}
            </div>
        </main>
    );
}
