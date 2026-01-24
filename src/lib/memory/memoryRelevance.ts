// src/lib/memory/memoryRelevance.ts

import type { UserMemoryRow } from "@/lib/memory/fetchUserMemories";

export type ScoredMemory = UserMemoryRow & { score: number };

function tokenize(s: string): string[] {
    return (s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
}

function jaccard(a: string[], b: string[]): number {
    const A = new Set(a);
    const B = new Set(b);
    if (A.size === 0 || B.size === 0) return 0;

    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;

    const union = A.size + B.size - inter;
    return union <= 0 ? 0 : inter / union;
}

/**
 * Score how relevant a memory row is to the current user message.
 * Conservative + cheap: lexical overlap + confidence weighting.
 */
export function scoreMemoryRow(memory: UserMemoryRow, userMessage: string): number {
    const msgTokens = tokenize(userMessage);
    const memText = `${memory.type} ${memory.key} ${memory.value}`;
    const memTokens = tokenize(memText);

    const overlap = jaccard(msgTokens, memTokens); // 0..1
    const conf = Number.isFinite(memory.confidence) ? memory.confidence : 0.5; // 0..1 expected
    const confWeight = Math.max(0, Math.min(1, conf));

    // Favor overlap; confidence is a mild multiplier
    const score = overlap * (0.7 + 0.3 * confWeight);

    return Math.max(0, Math.min(1, score));
}

export function selectPinnedRecall(
    memories: UserMemoryRow[],
    userMessage: string,
    opts?: {
        maxItems?: number;
        minScore?: number;
        minConfidence?: number;
    }
): { pinnedRecall: string[]; pinnedRecallRelevant: boolean; scored: ScoredMemory[] } {
    const maxItems = opts?.maxItems ?? 3;

    // Conservative default: require at least small lexical match
    const minScore = opts?.minScore ?? 0.18;

    // Optional confidence guard (don’t surface low-confidence memories)
    const minConfidence = opts?.minConfidence ?? 0.35;

    const scored: ScoredMemory[] = (memories || [])
        .filter((m) => (m?.value ?? "").trim().length > 0)
        .filter((m) => (Number.isFinite(m.confidence) ? m.confidence : 0.5) >= minConfidence)
        .map((m) => ({ ...m, score: scoreMemoryRow(m, userMessage) }))
        .sort((a, b) => b.score - a.score);

    const winners = scored.filter((m) => m.score >= minScore).slice(0, maxItems);

    // Compact strings only (avoid dumping raw rows into prompt)
    const pinnedRecall = winners.map((m) => `${m.type}:${m.key}=${m.value}`);

    const pinnedRecallRelevant = winners.length > 0;

    return { pinnedRecall, pinnedRecallRelevant, scored };
}
