import type { AnalysisResult } from "@/types/analysis";
import { analyzeLocal } from "@/lib/imotara";
import { mapChatToAnalysisInputs, type ChatMessage } from "@/lib/imotara/mapChatToAnalysis";

/**
 * runLocalAnalysis
 * Converts chat messages → AnalysisInput[] and invokes analyzeLocal.
 * windowSize: how many recent messages to include in the snapshot (default 10)
 */
export async function runLocalAnalysis(
  messages: ChatMessage[],
  windowSize: number = 10
): Promise<AnalysisResult> {
  const inputs = mapChatToAnalysisInputs(messages);
  return analyzeLocal(inputs, { windowSize });
}
