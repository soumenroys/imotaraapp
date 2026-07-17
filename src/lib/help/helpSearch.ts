// src/lib/help/helpSearch.ts
// Lightweight retrieval over the public help knowledge base (no external
// deps, no embeddings): docs are split into ## sections, sections are scored
// by keyword overlap with the question, and the top sections are assembled
// into a context block for the help-chat model call.
//
// The KB itself is the sanitized, user-safe doc set in src/content/help/,
// compiled to helpKb.json by scripts/build-help-kb.mjs.

import helpKb from "@/content/help/helpKb.json";

export type HelpSection = {
  docId: string;
  docTitle: string;
  heading: string;
  content: string; // includes the heading line
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "can", "cant",
  "cannot", "how", "what", "when", "where", "why", "who", "which", "my", "your",
  "i", "me", "you", "it", "its", "this", "that", "at", "as", "by", "from", "not",
  "no", "yes", "will", "would", "should", "could", "have", "has", "had", "get",
  "if", "so", "we", "our", "am", "up", "about", "into", "than", "then", "there",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Split every doc into sections at ## headings; the pre-heading intro of each
// doc becomes its own section so doc-level descriptions stay searchable.
function buildSections(): HelpSection[] {
  const sections: HelpSection[] = [];
  for (const doc of helpKb.docs) {
    const parts = doc.content.split(/\n(?=##\s)/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const headingMatch = trimmed.match(/^#{1,3}\s*(.+)$/m);
      sections.push({
        docId: doc.id,
        docTitle: doc.title,
        heading: headingMatch?.[1]?.trim() ?? doc.title,
        content: trimmed,
      });
    }
  }
  return sections;
}

const SECTIONS: HelpSection[] = buildSections();

// Precompute token frequencies per section.
const SECTION_TOKENS: Map<HelpSection, Map<string, number>> = new Map(
  SECTIONS.map((s) => {
    const freq = new Map<string, number>();
    for (const tok of tokenize(s.content)) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    return [s, freq] as const;
  })
);

/**
 * Score sections against the question and return the best ones, capped by
 * total character budget so the model context stays bounded.
 */
export function retrieveHelpContext(
  question: string,
  maxSections = 6,
  maxChars = 9000
): { sections: HelpSection[]; contextText: string } {
  const qTokens = tokenize(question);
  const scored = SECTIONS.map((section) => {
    const freq = SECTION_TOKENS.get(section)!;
    let score = 0;
    for (const tok of qTokens) {
      const tf = freq.get(tok);
      if (tf) score += 1 + Math.min(tf, 5) * 0.2;
      // Heading/title hits matter more than body hits.
      if (section.heading.toLowerCase().includes(tok)) score += 2;
      if (section.docTitle.toLowerCase().includes(tok)) score += 1;
    }
    return { section, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: HelpSection[] = [];
  let used = 0;
  for (const { section } of scored) {
    if (picked.length >= maxSections) break;
    if (used + section.content.length > maxChars && picked.length > 0) continue;
    picked.push(section);
    used += section.content.length;
  }

  // Nothing matched — fall back to the getting-started doc intro so the model
  // can still orient the user instead of hallucinating.
  if (picked.length === 0 && SECTIONS.length > 0) {
    picked.push(SECTIONS[0]);
  }

  const contextText = picked
    .map((s) => `[${s.docTitle} — ${s.heading}]\n${s.content}`)
    .join("\n\n---\n\n");

  return { sections: picked, contextText };
}
