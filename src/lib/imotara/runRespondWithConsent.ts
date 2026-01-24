// src/lib/imotara/runRespondWithConsent.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";
import { respondRemote } from "@/lib/imotara/respondRemote";
import { getImotaraProfile } from "@/lib/imotara/profile"; // ✅ NEW

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
    // If user did NOT allow remote, return a human, non-engine-exposing stub.
    // (Do NOT mention Cloud/Remote/AI engines.)
    if (!remoteAllowed) {
        return {
            message:
                "I’m here with you. If you want, you can share one more line about what’s going on.",
            followUp: "What’s the main thing you want help with right now?",
        };
    }

    // ✅ NEW: attach web Tone & Context profile to /api/respond, unless caller already provided toneContext
    const ctxObj =
        context && typeof context === "object" && !Array.isArray(context)
            ? (context as any)
            : {};

    if (ctxObj.toneContext == null) {
        ctxObj.toneContext = getImotaraProfile() ?? undefined;
    }

    return await respondRemote({ message, context: ctxObj });
}
