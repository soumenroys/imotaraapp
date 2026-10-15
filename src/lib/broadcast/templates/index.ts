// src/lib/broadcast/templates/index.ts
// The catalogue. See ./types.ts for the house style and why it is a
// deliverability decision rather than a stylistic one.

import { INDIVIDUALS } from "./individuals";
import { INDIVIDUALS_MORE } from "./individualsMore";
import { NGOS } from "./ngos";
import { NGOS_MORE } from "./ngosMore";
import { EDUCATION } from "./education";
import { EDUCATION_MORE } from "./educationMore";
import { CORPORATES } from "./corporates";
import { CORPORATES_MORE } from "./corporatesMore";
import { ELDERCARE } from "./eldercare";
import { ELDERCARE_MORE } from "./eldercareMore";
import { AUDIENCE_LABEL, ORGANISATIONAL, type Audience, type Template } from "./types";

export { AUDIENCE_LABEL, ORGANISATIONAL };
export type { Audience, Template };

export const TEMPLATES: readonly Template[] = [
    ...INDIVIDUALS, ...INDIVIDUALS_MORE, ...NGOS, ...NGOS_MORE, ...EDUCATION, ...EDUCATION_MORE, ...CORPORATES, ...CORPORATES_MORE, ...ELDERCARE, ...ELDERCARE_MORE,
];

/** Display order in the picker. `individuals` first — it is the real newsletter. */
export const AUDIENCES: readonly Audience[] = [
    "individuals", "ngos", "education", "corporates", "eldercare",
];

export function templatesFor(audience: Audience): Template[] {
    return TEMPLATES.filter((t) => t.audience === audience);
}

export function templateById(id: string): Template | undefined {
    return TEMPLATES.find((t) => t.id === id);
}

/**
 * Does this body still say what the template said?
 *
 * 🔑 The whole point of recording it. A template is a STARTING POINT the admin
 * then rewrites, so a bare usage count would claim a message still resembles
 * the template when it may not — and a counter that looks authoritative while
 * being wrong is worse than no counter.
 *
 * ⛔ Lives here, used by BOTH the create and the update route. It was inline in
 * each at first, which is exactly how the two drift: a later fix to one
 * (trimming, say) silently leaves the other disagreeing, and the disagreement
 * shows up only as numbers nobody can explain.
 *
 * Returns null when there is no template to compare against — null, not false,
 * because "written from scratch" is not the same fact as "unedited".
 */
export function templateEditedState(
    templateId: string | null | undefined,
    bodySource: string,
): boolean | null {
    if (!templateId) return null;
    const t = templateById(templateId);
    if (!t) return null;
    // Trimmed on both sides: a trailing newline the editor added is not an edit.
    return bodySource.trim() !== t.body.trim();
}
