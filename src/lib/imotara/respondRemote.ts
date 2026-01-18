// src/lib/imotara/respondRemote.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";

export async function respondRemote(input: {
    message: string;
    context?: unknown;
}): Promise<ImotaraResponse> {
    const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: input.message,
            context: input.context,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `[imotara] /api/respond failed: ${res.status} ${res.statusText} ${text}`
        );
    }

    return (await res.json()) as ImotaraResponse;
}
