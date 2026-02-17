"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { saveHistory } from "@/lib/imotara/historyPersist";

const SHOW_DONATION_RECEIPTS = process.env.NODE_ENV !== "production";
const CHAT_STORAGE_KEY = "imotara.chat.v1";

// Cross-device Chat Link Key (same value on web + mobile => same remote chat scope)
const CHAT_LINK_KEY = "imotara.linkKey.v1";



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

type ImotaraProfileV1 = {
    user: {
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
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
            },
            companion: {
                enabled: compEnabled,
                name: compEnabled ? (compName.trim() || undefined) : undefined,
                ageRange: compEnabled ? (compAge === "prefer_not" ? undefined : compAge) : undefined,
                gender: compEnabled ? (compGender === "prefer_not" ? undefined : compGender) : undefined,
                relationship: compEnabled ? (compRel === "prefer_not" ? undefined : compRel) : undefined,
            },
        };
    }, [userName, userAge, userGender, compEnabled, compName, compAge, compGender, compRel]);

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

export default function SettingsPage() {
    const { mode } = useAnalysisConsent();

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
    const [donError, setDonError] = useState<string | null>(null);

    const licenseMode = useMemo(() => {
        // This is a PUBLIC env var and is safe to display.
        return process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE || "off";
    }, []);

    const DONATION_PRESETS = useMemo(
        () => [
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
        try {
            setDonLoading(true);
            setDonError(null);

            const res = await fetch("/api/donations/recent?limit=10", { method: "GET" });
            const json = await res.json();

            if (!res.ok || !json?.ok) {
                setDonError(json?.error || "Failed to load donations");
                setDonations([]);
                return;
            }

            setDonations(Array.isArray(json.items) ? json.items : []);
        } catch (e: any) {
            setDonError(e?.message || "Failed to load donations");
            setDonations([]);
        } finally {
            setDonLoading(false);
        }
    }

    // ✅ Webhook can lag; poll receipts briefly so user sees confirmation automatically.
    // - Uses useRef so overlap-guard persists across re-renders
    // - Provides calm status updates
    const pollRunningRef = useRef(false);

    async function pollDonationConfirmation(paymentId?: string) {
        if (!paymentId) return;

        // Prevent overlapping polls (double click / repeated handler calls)
        if (pollRunningRef.current) return;
        pollRunningRef.current = true;

        try {
            for (let i = 0; i < 7; i++) {
                try {
                    const res = await fetch("/api/donations/recent?limit=10", { method: "GET" });
                    const json = await res.json().catch(() => null);

                    const ok = !!(json as any)?.ok;
                    const items = Array.isArray((json as any)?.items) ? (json as any).items : [];

                    // keep UI list fresh even while polling
                    if (ok) setDonations(items);

                    const found =
                        Array.isArray(items) &&
                        items.some((d: any) => d?.razorpay_payment_id === paymentId);

                    if (found) {
                        setDonateStatus("Donation confirmed. Thank you for supporting Imotara 🙏");
                        return;
                    }

                    // Gentle progress hints (non-spammy)
                    if (i === 1) setDonateStatus("Confirming receipt… (webhook may take a moment)");
                    if (i === 4) setDonateStatus("Still confirming… thanks for your patience 🙏");
                } catch {
                    // ignore (settings must never break)
                }

                await new Promise((r) => setTimeout(r, 1200));
            }

            setDonateStatus(
                "Checkout completed. Receipt may take a little longer to appear. You can refresh Recent Donations shortly."
            );
        } finally {
            pollRunningRef.current = false;
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

        // Recent donations (read-only) — DEV ONLY
        if (SHOW_DONATION_RECEIPTS) {
            refreshDonations();
        }
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
                    card: false,
                    netbanking: false,
                    wallet: false,
                },
                notes: {
                    purpose: "imotara_donation",
                },
                theme: { color: "#38bdf8" },
                handler: function (response: any) {
                    // Note: real verification is via webhook on server; this is only UX feedback.
                    setDonateStatus(
                        `Checkout completed. Payment ID: ${response?.razorpay_payment_id || "—"}. Confirming receipt…`
                    );

                    // Refresh list immediately (may still be empty until webhook records it)
                    refreshDonations();

                    // 🔁 Auto-confirm once webhook records the receipt
                    void pollDonationConfirmation(response?.razorpay_payment_id);
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
                        Link this device (optional)
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
                                {lic?.message ||
                                    "Upgrade flows will appear here once web purchase is enabled."}
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

                {/* NEW: Recent donations (web) — rendered client-only to avoid hydration mismatch */}
                {mounted && SHOW_DONATION_RECEIPTS && (
                    <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                                    Recent Donations
                                </h2>
                                <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                                    Receipts appear here after the secure server webhook records the payment.
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

                        {donError && <p className="mt-3 text-[11px] text-rose-200/90">{donError}</p>}

                        {!donError && donations.length === 0 && (
                            <p className="mt-3 text-[11px] text-zinc-400">
                                No receipts yet. (This is expected until production webhooks are hitting your deployed backend.)
                            </p>
                        )}

                        {donations.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {donations.map((d) => (
                                    <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-zinc-50">
                                                {formatINRFromPaise(Number(d.amount_paise || 0))}
                                            </p>
                                            <p className="text-[11px] text-zinc-400">
                                                {String(d.status || "—").toUpperCase()}
                                                {d.is_test ? " · TEST" : ""}
                                            </p>
                                        </div>
                                        <p className="mt-1 text-[11px] text-zinc-400">
                                            Payment: {d.razorpay_payment_id || "—"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                            {d.created_at ? new Date(d.created_at).toLocaleString() : ""}
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
