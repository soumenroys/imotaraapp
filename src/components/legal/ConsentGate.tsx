"use client";
// src/components/legal/ConsentGate.tsx
//
// The first-use acceptance gate. Shown ONCE, before the first message, to
// everyone — signed in or not.
//
// ⛔ WHY FIRST USE AND NOT FIRST LOGIN: people chat before signing in (the
// sign-in prompt is a prompt, not a gate). Gating on login would miss the
// person who opens Imotara once, in distress, and never creates an account —
// exactly the person this exists for.
//
// ⛔ The helpline numbers are NOT hard-coded here. They come from
// getCrisisResourcesForCountry() so this screen and the crisis card can never
// drift apart.
//
// Styling uses the app's own tokens (--im-accent, --im-surface, --im-border-soft)
// rather than a private palette, so it follows the light/dark switch and any
// future rebrand without being touched.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsentCopy } from "@/lib/legal/consentCopy";
import {
    TERMS_ACCEPTANCE_KEY,
    buildAcceptance,
    hasAcceptedCurrentTerms,
    parseAcceptance,
    type TermsAcceptance,
} from "@/lib/legal/termsVersion";
import { getCrisisResourcesForCountry } from "@/lib/safety/crisisResources";
import { isRtlLang } from "@/lib/lang/rtlLangs";

type Props = {
    /** Resolved UI language. Never "auto". */
    lang?: string | null;
    /** ISO country for helpline selection; defaults to India inside the resolver. */
    countryCode?: string | null;
    /** Called once accepted, so the host can persist server-side. */
    onAccepted?: (record: TermsAcceptance) => void;
};

export default function ConsentGate({ lang, countryCode, onAccepted }: Props) {
    // `null` = not yet determined. Rendering nothing until we know avoids a
    // flash of the gate for people who accepted long ago.
    const [needed, setNeeded] = useState<boolean | null>(null);
    // Pre-ticked, by the owner's explicit instruction (2026-10-13).
    const [checked, setChecked] = useState(true);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMS_ACCEPTANCE_KEY);
            setNeeded(!hasAcceptedCurrentTerms(parseAcceptance(raw)));
        } catch {
            // Private mode, blocked storage: show the gate rather than skip it.
            setNeeded(true);
        }
    }, []);

    // One frame after mount so the entrance transition actually runs.
    useEffect(() => {
        if (needed === true) {
            const id = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(id);
        }
    }, [needed]);

    if (needed !== true) return null;

    const copy = getConsentCopy(lang);
    const rtl = isRtlLang(lang);
    const resources = getCrisisResourcesForCountry(countryCode);
    const emergency = resources?.emergency;
    const firstLine = resources?.primary?.[0];

    const accept = () => {
        const record = buildAcceptance("web", lang || "en");
        try {
            window.localStorage.setItem(TERMS_ACCEPTANCE_KEY, JSON.stringify(record));
        } catch {
            // Storage can fail. Still let them through — blocking someone from
            // the app because their browser refuses storage would be worse, and
            // the durable copy is the server write in onAccepted.
        }
        onAccepted?.(record);
        setShown(false);
        // Let the exit transition finish before unmounting.
        window.setTimeout(() => setNeeded(false), 180);
    };

    // The label carries {terms} and {privacy} placeholders so each translation
    // controls word order rather than being forced into English's.
    const [beforeTerms, afterTerms = ""] = copy.agree.split("{terms}");
    const [betweenLinks, afterPrivacy = ""] = afterTerms.split("{privacy}");

    const linkClass =
        "font-medium underline decoration-dotted underline-offset-4 transition-colors hover:opacity-80";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-title"
            dir={rtl ? "rtl" : "ltr"}
            className={[
                "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-8",
                "bg-[rgba(10,7,13,0.78)] backdrop-blur-md transition-opacity duration-300",
                shown ? "opacity-100" : "opacity-0",
            ].join(" ")}
        >
            <div
                className={[
                    "relative w-full max-w-[416px] overflow-hidden rounded-3xl",
                    "border border-[var(--im-border-soft)] bg-[var(--im-surface)]",
                    "shadow-[0_24px_70px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl",
                    "transition-all duration-300 ease-out",
                    shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.97] opacity-0",
                ].join(" ")}
            >
                {/* Twilight accent rule — the app's own gradient. */}
                <div
                    aria-hidden="true"
                    className="h-[3px] w-full"
                    style={{
                        background:
                            "linear-gradient(90deg, var(--im-accent), var(--im-accent-mid), var(--im-accent-soft))",
                    }}
                />

                <div className="px-7 pb-7 pt-8">
                    {/* Mark, with a soft halo rather than a bare emoji. */}
                    <div className="mb-5 flex justify-center">
                        <div
                            className="flex h-16 w-16 items-center justify-center rounded-full text-[28px]"
                            style={{
                                background:
                                    "radial-gradient(circle at 50% 45%, var(--im-accent-glow), transparent 68%)",
                            }}
                            aria-hidden="true"
                        >
                            💛
                        </div>
                    </div>

                    <h1
                        id="consent-title"
                        className="mb-3 text-center text-[22px] font-semibold leading-snug tracking-[-0.01em] text-zinc-900 dark:text-zinc-50"
                    >
                        {copy.title}
                    </h1>

                    {/* The warm line leads. Owner decision 2026-10-13: what Imotara
                        IS comes before what it is not, so the first thing someone in
                        distress reads is not a legal shield. */}
                    <p className="mb-3.5 text-center text-[15.5px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                        {copy.warm}
                    </p>

                    {/* The disclaimer. ⛔ Demoted in WEIGHT only — still explicit,
                        still above the fold, still unambiguous. */}
                    <p className="mb-5 text-center text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {copy.body}
                    </p>

                    {/* Emergency block. Deliberately warm, not alarming — this is
                        the first thing a person in distress may ever read here.
                        Numbers come from the shared crisis resources. */}
                    <div
                        className={[
                            "mb-6 rounded-2xl px-4 py-3.5",
                            rtl ? "border-r-[3px]" : "border-l-[3px]",
                            "border-amber-500/70 bg-amber-500/[0.08] dark:bg-amber-400/[0.07]",
                        ].join(" ")}
                    >
                        <p className="text-[14px] leading-relaxed text-amber-800 dark:text-amber-200/90">
                            {copy.emergencyLead}
                        </p>
                        {(emergency || firstLine) && (
                            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-amber-900 dark:text-amber-100">
                                {emergency && (
                                    <span className="whitespace-nowrap">
                                        {emergency.label} <span className="tabular-nums">{emergency.contact}</span>
                                    </span>
                                )}
                                {emergency && firstLine && (
                                    <span aria-hidden="true" className="opacity-50">·</span>
                                )}
                                {firstLine && (
                                    <span className="whitespace-nowrap">
                                        {firstLine.label} <span className="tabular-nums">{firstLine.contact}</span>
                                    </span>
                                )}
                            </p>
                        )}
                    </div>

                    <label className="mb-6 flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="mt-[3px] h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border-zinc-400 accent-[var(--im-accent)] dark:border-zinc-600"
                        />
                        <span>
                            {beforeTerms}
                            <Link href="/terms" target="_blank" className={linkClass} style={{ color: "var(--im-accent)" }}>
                                {copy.termsLabel}
                            </Link>
                            {betweenLinks}
                            <Link href="/privacy" target="_blank" className={linkClass} style={{ color: "var(--im-accent)" }}>
                                {copy.privacyLabel}
                            </Link>
                            {afterPrivacy}
                        </span>
                    </label>

                    <button
                        type="button"
                        onClick={accept}
                        disabled={!checked}
                        className={[
                            "w-full rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-white",
                            "transition-all duration-200",
                            checked
                                ? "shadow-[0_8px_24px_-8px_var(--im-accent-glow)] hover:brightness-110 active:scale-[0.985]"
                                : "cursor-not-allowed opacity-40",
                        ].join(" ")}
                        style={{
                            background: checked
                                ? "linear-gradient(135deg, var(--im-accent), var(--im-accent-mid))"
                                : "rgba(120,120,135,0.35)",
                        }}
                    >
                        {copy.cta}
                    </button>
                </div>
            </div>
        </div>
    );
}
