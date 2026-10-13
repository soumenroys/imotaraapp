// src/lib/lang/rtlLangs.ts
//
// ONE home for "is this language right-to-left?" on the web.
//
// ⚠️ This set previously existed only inline in components/imotara/RtlInit.tsx.
// The mobile repo had the same set in two places and one of them was wrong for
// months — see trap_blunt_fix_trades_one_failure_for_its_opposite. Mobile was
// consolidated into src/lib/lang/rtlLangs.ts; this is the web twin, so there is
// exactly one definition per repo rather than one per component.
//
// ⛔ Do not re-inline this set anywhere. Import it.

export const RTL_LANGS: ReadonlySet<string> = new Set(["ar", "he", "ur"]);

/**
 * True for Arabic, Hebrew and Urdu.
 *
 * Tolerates region tags ("ar-EG") and casing, and is safe with null/undefined
 * so callers do not each invent their own guard.
 */
export function isRtlLang(lang: string | null | undefined): boolean {
    if (!lang) return false;
    return RTL_LANGS.has(String(lang).trim().toLowerCase().split(/[-_]/)[0]);
}
