// src/lib/imotara/respondRemote.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";

export async function respondRemote(input: {
    message: string;
    context?: unknown;
}): Promise<ImotaraResponse> {
    const qa =
        typeof window !== "undefined" &&
        window.localStorage.getItem("imotaraQa") === "1";

    const res = await fetch("/api/respond", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(qa ? { "x-imotara-qa": "1" } : {}),
        },
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
