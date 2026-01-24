export type SoftEnforcementSeverity = "none" | "low";

export type SoftEnforcementResult = {
  adjustedText: string;
  severity: SoftEnforcementSeverity;
  notes: string[]; // QA-only notes; never show to user
};

type Args = {
  text: string;
  debugMode?: boolean; // kept for future steps; not required in baby step #1
  userPrefs?: {
    companionTone?: string;
    ageTone?: string | number;
    genderTone?: string;
  };
};

/**
 * Phase 4 — Baby Step #1 (QA-only soft enforcement)
 * - Must NEVER throw
 * - Must NEVER refuse/block
 * - Keep changes minimal and safe
 */
export function applySoftEnforcement(args: Args): SoftEnforcementResult {
  const original = args?.text ?? "";
  let text = original;
  const notes: string[] = [];

  try {
    // 1) Remove robotic "Follow-up question:" prefix (user requirement)
    const followupPrefix = /^\s*(follow[-\s]?up\s*question\s*:\s*)/i;
    if (followupPrefix.test(text)) {
      text = text.replace(followupPrefix, "");
      notes.push("Removed 'Follow-up question:' prefix.");
    }

    // 2) Remove leading "As an AI..." disclaimer if it appears at the start
    const asAiStart = /^\s*(as an ai[^,.!?]*[,.!?]\s*)/i;
    if (asAiStart.test(text)) {
      text = text.replace(asAiStart, "");
      notes.push("Removed leading 'As an AI...' disclaimer.");
    }

    // 3) De-duplicate identical adjacent lines (very conservative)
    const lines = text.split(/\n+/);
    const deduped: string[] = [];
    for (const line of lines) {
      if (deduped.length > 0 && deduped[deduped.length - 1].trim() === line.trim()) {
        notes.push("De-duplicated repeated line.");
        continue;
      }
      deduped.push(line);
    }
    text = deduped.join("\n");

    // 4) Soften either/or questions (common "interrogation" feel)
    // If it’s a question and contains " or ", keep only the first option.
    if (text.includes("?") && /\sor\s/i.test(text)) {
      const m = text.match(/^([\s\S]*?)\sor\s[\s\S]*\?(\s*)$/i);
      if (m) {
        const cleaned = m[1].trim().replace(/[,\-–—:;]\s*$/g, "");
        text = `${cleaned}?${m[2] ?? ""}`;
        notes.push("Softened either/or follow-up to reduce interrogation feel.");
      }
    }

    // 5) Soften direct diagnosis language (Imotara should seldom diagnose)
    // Very conservative: only soften when the assistant asserts diagnosis directly.
    const diagnosisPatterns: Array<{ re: RegExp; replace: (m: RegExpMatchArray) => string; label: string }> = [
      {
        re: /\byou have (adhd|add|depression|anxiety disorder|bipolar disorder|ocd|ptsd)\b/gi,
        replace: (m) => `it can feel like ${m[1]}`,
        label: "Softened 'you have <condition>' to non-diagnostic phrasing.",
      },
      {
        re: /\byou are (bipolar|depressed|anxious)\b/gi,
        replace: (m) => `it can feel like you're ${m[1]}`,
        label: "Softened 'you are <condition>' to non-diagnostic phrasing.",
      },
    ];

    for (const p of diagnosisPatterns) {
      if (p.re.test(text)) {
        // reset lastIndex because we used .test() on a /g regex
        p.re.lastIndex = 0;
        text = text.replace(p.re, (...args) => {
          const match = args[0];
          const groups = match.match(p.re);
          // Fallback-safe: if grouping fails, keep original match
          if (!groups) return match;
          const mm = match.match(/\b(adhd|add|depression|anxiety disorder|bipolar disorder|ocd|ptsd|bipolar|depressed|anxious)\b/i);
          if (!mm) return match;
          return p.replace([match, mm[1]] as any);
        });
        notes.push(p.label);
      }
    }

    // 6) QA-only: tone mismatch softening (mentor/coach + very young age tone)
    // We intentionally do NOT "fix" the mismatch; we just make the phrasing a bit less polished.
    const role = (args.userPrefs?.companionTone ?? "").toLowerCase();
    const age = String(args.userPrefs?.ageTone ?? "").toLowerCase();

    const roleIsAdultish = role === "mentor" || role === "coach";
    const ageLooksVeryYoung =
      /under|kid|child|u13|13|12|11|10|9|8|7/.test(age);

    if (roleIsAdultish && ageLooksVeryYoung) {
      notes.push("Detected age/role mismatch (QA-only).");

      // Minimal softening: shorten and simplify a touch
      // 1) Reduce multiple clauses by trimming after the first sentence if very long
      if (text.length > 160) {
        const firstSentenceEnd = text.search(/[.!?]\s/);
        if (firstSentenceEnd > 40) {
          text = text.slice(0, firstSentenceEnd + 1);
          notes.push("Shortened response due to age/role mismatch.");
        }
      }

      // 2) Tiny simplifications (safe replacements)
      const before = text;
      text = text
        .replace(/\bperhaps\b/gi, "maybe")
        .replace(/\bpractical\b/gi, "simple")
        .replace(/\bclarity\b/gi, "understanding");

      if (text !== before) {
        notes.push("Softened phrasing due to age/role mismatch.");
      }
    }

    const severity: SoftEnforcementSeverity = notes.length > 0 ? "low" : "none";
    return { adjustedText: text, severity, notes };
  } catch {
    // Hard guarantee: never fail the response
    return { adjustedText: original, severity: "none", notes: ["Soft enforcement error (ignored)."] };
  }
}
