// src/lib/imotara/response/endCleanly.ts
//
// #17 B (26 Nov 2026): a reply that hit the length limit used to be shown as it was —
// cut off mid-sentence or mid-word ("…he kept showing up as hi"). 3 of 42 replies in one
// day did, on the one path that even logged it; the streaming path logged nothing.
//
// 🔑 When — and ONLY when — the model stopped at the length limit, cut back to the end of
// the last complete sentence. A reply that finished on its own is never touched.
//
// ⚖️ Never trade the whole reply away for tidiness: if the last full sentence ends too early
// (less than MIN_KEEP of the text), keep the text and end it with "…" instead. A short
// complete thought is better than a ragged one, but a stub is worse than both.

/** Sentence ends across the scripts we answer in: Latin, Hindi/Bengali danda, Urdu, CJK, plus a closing quote or bracket. */
// Latin marks count only before a space or the end ("3.5", "e.g" are not ends); danda, Urdu
// and CJK marks always end a sentence (CJK runs on without spaces).
const SENTENCE_END = /[.!?…]["'”’»)\]]*(?=\s|$)|[।॥۔。！？]["'”’»)\]]*/g;

/** Keep at least this share of the text when cutting back to a sentence end. */
export const MIN_KEEP = 0.5;

export function endCleanly(text: string): string {
    const t = text.replace(/\s+$/u, "");
    if (!t) return text;

    let lastEnd = -1;
    for (const m of t.matchAll(SENTENCE_END)) lastEnd = (m.index ?? 0) + m[0].length;

    // Already ends on a sentence end — nothing was lost.
    if (lastEnd === t.length) return t;

    if (lastEnd > 0 && lastEnd >= t.length * MIN_KEEP) return t.slice(0, lastEnd);

    // No usable sentence end: drop the half-word, mark the pause honestly.
    const lastSpace = t.search(/\s\S*$/u);
    const base = (lastSpace > t.length * MIN_KEEP ? t.slice(0, lastSpace) : t).replace(/[\s,;:—–-]+$/u, "");
    return base + "…";
}
