// src/lib/imotara/response/badPlaceholderText.ts
// Extracted from chat-reply/route.ts (P2-20, code_review_audit_2026_08_14) so
// it can be shared between the server (non-streaming JSON path, which already
// used this) and the web client (respondRemote.ts's streaming consumer, which
// previously had no equivalent check at all — a real reply-quality gap
// between the two pipelines, since streaming is the primary path). Pure
// function, no server-only imports — safe to bundle into browser code.

export function isBadPlaceholderText(s: string): boolean {
  const t = (s ?? "").trim();
  if (!t) return true;

  // The exact string you reported + common variants
  return (
    t.includes("soft, placeholder reply") ||
    t.includes("I tried to connect to Imotara's AI engine") ||
    t.includes("but something went wrong")
  );
}
