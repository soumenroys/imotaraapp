// src/lib/imotara/mapChatToAnalysis.ts
import type { AnalysisInput } from "@/types/analysis";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: number; // epoch ms (optional)
};

/** Narrow to messages we actually analyze */
function isAnalyzable(
  m: ChatMessage
): m is Omit<ChatMessage, "role"> & { role: "user" | "assistant" } {
  return m.role === "user" || m.role === "assistant";
}

/**
 * Maps chat messages to AnalysisInput[] expected by analyzeLocal.
 * - Drops `system` messages via the type guard.
 * - Uses content as both `message` and legacy `text` for compatibility.
 * - Fills missing createdAt with Date.now() to avoid hydration drift.
 */
export function mapChatToAnalysisInputs(
  messages: ChatMessage[]
): AnalysisInput[] {
  const now = Date.now();
  return messages
    .filter(isAnalyzable)
    .map((m) => ({
      id: m.id,
      message: m.content,
      text: m.content, // legacy alias
      createdAt: m.createdAt ?? now,
      role: m.role, // now correctly narrowed to "user" | "assistant"
    }));
}
