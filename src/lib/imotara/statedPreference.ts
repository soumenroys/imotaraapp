// src/lib/imotara/statedPreference.ts
// Shared with imotara-mobile's aiClient.ts — keep the two in step.

/** The value meaning "work it out from what I write" rather than a chosen language. */
export const AUTO_LANG = "auto";

/**
 * Returns the profile language only when the user actually stated one.
 *
 * `undefined`, `""` and `"auto"` all mean "not stated" and must fall through
 * to detection. Anything else — including an explicit "en" — is a real choice
 * and outranks detection, so someone who deliberately wants English replies
 * while writing Bengali still gets them.
 *
 * Why this exists: preferredLang defaulted to "en" and was persisted for every
 * user, so a stored "en" could not be told apart from a chosen "en". Flipping
 * the precedence outright would have overridden people who really did pick
 * English. "auto" makes the distinction explicit instead of guessing.
 */
export function statedPreference(value: string | undefined | null): string | undefined {
    const v = (value ?? "").trim().toLowerCase();
    if (!v || v === AUTO_LANG) return undefined;
    return v;
}
