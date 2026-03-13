"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { saveHistory } from "@/lib/imotara/historyPersist";
import { useAppearance, type Accent, type FontSize } from "@/hooks/useAppearance";

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

type SupportedLang = "en" | "hi" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "kn" | "ml" | "or";
type ResponseStyle = "comfort" | "reflect" | "motivate" | "advise";

type ImotaraProfileV1 = {
    user: {
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
        preferredLang?: SupportedLang;
        responseStyle?: ResponseStyle; // #16
    };
    companion: {
        enabled?: boolean;
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
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

function TinyBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-white/10">
            {children}
        </span>
    );
}

function ToneAndContextTile() {
    const [loaded, setLoaded] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Personal info
    const [userName, setUserName] = useState("");
    const [userAge, setUserAge] = useState<AgeRange>("prefer_not");
    const [userGender, setUserGender] = useState<Gender>("prefer_not");
    const [preferredLang, setPreferredLang] = useState<SupportedLang | "auto">("auto");
    const [responseStyle, setResponseStyle] = useState<ResponseStyle | "auto">("auto"); // #16

    // Expected companion details (tone guidance)
    const [compEnabled, setCompEnabled] = useState(false);
    const [compName, setCompName] = useState("");
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

    useEffect(() => {
        // Hydration-safe: only read localStorage after mount
        const existing = safeParseProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
        if (existing) {
            setUserName(existing.user?.name ?? "");
            setUserAge((existing.user?.ageRange as AgeRange) ?? "prefer_not");
            setUserGender((existing.user?.gender as Gender) ?? "prefer_not");
            setPreferredLang((existing.user?.preferredLang as SupportedLang) ?? "auto");
            setResponseStyle((existing.user?.responseStyle as ResponseStyle) ?? "auto");

            const enabled = !!existing.companion?.enabled;
            setCompEnabled(enabled);
            setCompName(existing.companion?.name ?? "");
            setCompAge((existing.companion?.ageRange as AgeRange) ?? "prefer_not");
            setCompGender((existing.companion?.gender as Gender) ?? "prefer_not");
            setCompRel((existing.companion?.relationship as any) ?? "prefer_not");
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
            },
            companion: {
                enabled: compEnabled,
                name: compEnabled ? (compName.trim() || undefined) : undefined,
                ageRange: compEnabled ? (compAge === "prefer_not" ? undefined : compAge) : undefined,
                gender: compEnabled ? (compGender === "prefer_not" ? undefined : compGender) : undefined,
                relationship: compEnabled ? (compRel === "prefer_not" ? undefined : compRel) : undefined,
            },
        };
    }, [userName, userAge, userGender, preferredLang, compEnabled, compName, compAge, compGender, compRel]);

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
            setToast("Saved ✓");
            window.setTimeout(() => setToast(null), 1800);
        } catch (e) {
            console.error("[imotara] profile save failed:", e);
            setToast("Save failed");
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
        setPreferredLang("auto");
        setResponseStyle("auto");
        setCompEnabled(false);
        setCompName("");
        setCompAge("prefer_not");
        setCompGender("prefer_not");
        setCompRel("prefer_not");
        setToast("Reset ✓");
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
                <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    {toast}
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
                                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/20"
                            />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1">
                                <span className="text-xs text-zinc-300">Age range</span>
                                <select
                                    value={userAge}
                                    onChange={(e) => setUserAge(e.target.value as AgeRange)}
                                    className={[
                                        "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
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
                                {userAge === "13_17" && (
                                    <p className="text-[10px] text-amber-400/80 mt-0.5">
                                        If you are under 13, please use Imotara with a parent or guardian.
                                    </p>
                                )}
                            </label>

                            <label className="grid gap-1">
                                <span className="text-xs text-zinc-300">Gender</span>
                                <select
                                    value={userGender}
                                    onChange={(e) => setUserGender(e.target.value as Gender)}
                                    className={[
                                        "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                        selectActiveClass(userGender !== "prefer_not"),
                                    ].join(" ")}
                                >
                                    <option value="prefer_not">Prefer not to say</option>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                    <option value="nonbinary">Non-binary</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                        </div>

                        <label className="grid gap-1">
                            <span className="text-xs text-zinc-300">Preferred language</span>
                            <select
                                value={preferredLang}
                                onChange={(e) => setPreferredLang(e.target.value as SupportedLang | "auto")}
                                className={[
                                    "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                    selectActiveClass(preferredLang !== "auto"),
                                ].join(" ")}
                            >
                                <option value="auto">Auto-detect</option>
                                <option value="en">English</option>
                                <option value="hi">Hindi (हिंदी)</option>
                                <option value="mr">Marathi (मराठी)</option>
                                <option value="bn">Bengali (বাংলা)</option>
                                <option value="ta">Tamil (தமிழ்)</option>
                                <option value="te">Telugu (తెలుగు)</option>
                                <option value="gu">Gujarati (ગુજરાતી)</option>
                                <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                                <option value="ml">Malayalam (മലയാളം)</option>
                                <option value="or">Odia (ଓଡ଼ିଆ)</option>
                            </select>
                        </label>

                        {/* #16: Response style preference */}
                        <label className="grid gap-1">
                            <span className="text-xs text-zinc-300">How should Imotara respond?</span>
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
                                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/20"
                                />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                    <span className="text-xs text-zinc-300">Age range</span>
                                    <select
                                        value={compAge}
                                        onChange={(e) => setCompAge(e.target.value as AgeRange)}
                                        className={[
                                            "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
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

                                <label className="grid gap-1">
                                    <span className="text-xs text-zinc-300">Gender</span>
                                    <select
                                        value={compGender}
                                        onChange={(e) => setCompGender(e.target.value as Gender)}
                                        className={[
                                            "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20",
                                            selectActiveClass(compGender !== "prefer_not"),
                                        ].join(" ")}
                                    >
                                        <option value="prefer_not">Prefer not to say</option>
                                        <option value="female">Female</option>
                                        <option value="male">Male</option>
                                        <option value="nonbinary">Non-binary</option>
                                        <option value="other">Other</option>
                                    </select>
                                </label>
                            </div>

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

const ACCENT_OPTIONS: { value: Accent; label: string; color: string }[] = [
    { value: "indigo",  label: "Indigo",  color: "#6366f1" },
    { value: "teal",    label: "Teal",    color: "#14b8a6" },
    { value: "rose",    label: "Rose",    color: "#f43f5e" },
    { value: "amber",   label: "Amber",   color: "#f59e0b" },
    { value: "emerald", label: "Emerald", color: "#10b981" },
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
    const { accent, setAccent, fontSize, setFontSize } = useAppearance();

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const t = (lic?.tier || "FREE").toUpperCase();
        if (t === "PREMIUM") return "Premium";
        if (t === "FAMILY") return "Family";
        if (t === "EDU") return "Education";
        if (t === "ENTERPRISE") return "Enterprise";
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

                {/* NEW: Tone & Context Preferences (client-only safe) */}
                {mounted && <ToneAndContextTile />}

                {/* NEW: Licensing status */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    {/* Launch offer banner */}
                    {mounted && (() => {
                        const launchRaw = process.env.NEXT_PUBLIC_IMOTARA_LAUNCH_DATE;
                        const freeDays = parseInt(process.env.NEXT_PUBLIC_IMOTARA_FREE_DAYS ?? "90", 10) || 90;
                        if (!launchRaw) return null;
                        const launchMs = Date.parse(launchRaw);
                        if (isNaN(launchMs)) return null;
                        const endsAt = new Date(launchMs + freeDays * 24 * 60 * 60 * 1000);
                        const active = Date.now() < endsAt.getTime();
                        if (!active) return null;
                        return (
                            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                                <span className="text-lg leading-none">🎁</span>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-200">
                                        Launch offer — everything free for everyone
                                    </p>
                                    <p className="mt-0.5 text-xs text-emerald-300/80">
                                        All features are available at no cost until{" "}
                                        <span className="font-medium">
                                            {endsAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                                        </span>
                                        . No sign-up, no payment required.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                                Licensing
                            </h2>
                            <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                                Current plan status for this web session. Enforcement is
                                controlled by license mode.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={refreshLicenseStatus}
                            disabled={licLoading}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {licLoading ? "Refreshing…" : "Refresh"}
                        </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                                Plan
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-50">
                                {tierLabel}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-zinc-400">
                                {lic?.license?.status === "trial"
                                    ? "Launch offer active — all features unlocked for everyone."
                                    : lic?.message || "All features are free during the launch period."}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                                License mode
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-50">
                                {String(lic?.mode || licenseMode)}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-zinc-400">
                                off = disabled, log = observe only, enforce = block gated features.
                            </p>
                        </div>
                    </div>

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
                                    Receipts are saved on this device immediately. Server records sync when you're signed in.
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
                            {ACCENT_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setAccent(o.value)}
                                    title={o.label}
                                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                                        accent === o.value
                                            ? "border-white/40 bg-white/15 text-zinc-50"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                                    }`}
                                >
                                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                                    {o.label}
                                    {accent === o.value && <span className="ml-0.5 text-[10px] opacity-60">✓</span>}
                                </button>
                            ))}
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
                                    className={`rounded-full px-4 py-1 text-xs transition ${
                                        fontSize === o.value
                                            ? "bg-white/20 text-zinc-50"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Data dashboard ──────────────────────────────────── */}
                <DataDashboard getStorageSummary={getStorageSummary} />

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
                </section>
                {/* Version footer intentionally removed (global footer already shows version) */}
            </div>
        </main>
    );
}
