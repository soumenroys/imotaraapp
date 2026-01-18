// src/lib/imotara/runRespondWithConsent.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";
import { respondRemote } from "@/lib/imotara/respondRemote";

export async function runRespondWithConsent(
    userMessage: string,
    remoteAllowed: boolean,
    context?: unknown
): Promise<ImotaraResponse> {
    const message = (userMessage ?? "").trim();

    if (!message) {
        return {
            message: "Tell me what’s on your mind—one line is enough.",
            followUp: "What’s the main thing you want help with right now?",
        };
    }

    // If user did NOT allow remote, return a safe local stub
    // (Keep it consistent with how mobile behaves when remote is off.)
    if (!remoteAllowed) {
        return {
            message:
                "Remote responses are turned off right now. If you enable Cloud AI, I can respond properly.",
            followUp: "Do you want to turn on Cloud AI for this chat?",
        };
    }

    return await respondRemote({ message, context });
}
