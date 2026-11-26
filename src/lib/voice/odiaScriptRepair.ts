// src/lib/voice/odiaScriptRepair.ts
//
// #48 (27 Nov 2026): an Odia transcript came back with BENGALI letters mixed in —
// "ଆଜି ମୋତে ବହୁତ ଲାଗୁଛে।" (the vowel sign ে is Bengali; Odia's is େ). Speech models confuse
// the two scripts (they are close cousins), and Odia has no `language` code the models accept,
// so it rides on a script hint only (see transcribe/route.ts).
//
// 🔑 The two Unicode blocks are laid out in parallel (Bengali U+0980–U+09FF, Odia
// U+0B00–U+0B7F, offset 0x180), so a stray Bengali character maps to the same Odia character.
//
// ⛔ Only when the text is MOSTLY Odia — real Bengali text is never touched — and only for
// characters whose Odia counterpart exists and means the same thing. U+09F0 (ৰ, Assamese ra)
// lands on U+0B70 (୰, Odia isshar, a symbol) — skipped. Unassigned targets are skipped.

const BENGALI = /[ঀ-৿]/g;
const ODIA = /[଀-୿]/g;
const OFFSET = 0x0b00 - 0x0980;
const NOT_THE_SAME = new Set([0x09f0]);
const IS_ODIA = /^\p{Script=Oriya}$/u;

export function repairOdiaScript(text: string): string {
    const t = String(text ?? "");
    const bengali = (t.match(BENGALI) ?? []).length;
    if (bengali === 0) return t;
    const odia = (t.match(ODIA) ?? []).length;
    if (odia <= bengali) return t; // mostly Bengali (or a tie) — leave it alone
    return t.replace(BENGALI, (ch) => {
        const cp = ch.codePointAt(0)!;
        if (NOT_THE_SAME.has(cp)) return ch;
        const mapped = String.fromCodePoint(cp + OFFSET);
        return IS_ODIA.test(mapped) ? mapped : ch;
    });
}
