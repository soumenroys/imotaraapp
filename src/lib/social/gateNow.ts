// #154 (15 Nov 2026) — today's word check on posts that can still be approved
// or published.
//
// 🔴 A post's stored `gate_result` is the verdict from the day it was WRITTEN.
// A draft written on 4 Nov showed "privacy ✓"; the rule against "chat history
// stays on your phone" came on 11 Nov. Approving re-checks against today's
// rules, so the server refused while the card still said it had passed — and
// the owner saw an Approve button that "does nothing".
// ⇒ the review screen shows THIS result, computed when the list is read.

import { checkVoice, type GateOverlay } from "@/lib/social/voiceGate";

export type GateNow = {
  ok: boolean;
  findings: { list: string; matched: string; because: string }[];
  listsRun: string[];
  listsUnavailable: string[];
};

/** Statuses whose words can still go out — the only ones worth re-checking. */
export const RECHECKED_STATUSES = ["needs_review", "approved"] as const;

export function gateNowFor(
  row: { status?: unknown; subject?: unknown; body?: unknown; language?: unknown },
  overlay?: GateOverlay,
): GateNow | undefined {
  if (!RECHECKED_STATUSES.includes(row.status as (typeof RECHECKED_STATUSES)[number])) return undefined;
  try {
    // ⚠️ The same text the approve route checks: subject + newline + body.
    const g = checkVoice(`${String(row.subject ?? "")}\n${String(row.body ?? "")}`, String(row.language), overlay);
    return {
      ok: g.ok,
      findings: g.findings.map((f) => ({ list: f.list, matched: f.matched, because: f.because })),
      listsRun: g.listsRun,
      listsUnavailable: g.listsUnavailable,
    };
  } catch {
    // An unsupported language throws; the stored verdict is all there is.
    return undefined;
  }
}
