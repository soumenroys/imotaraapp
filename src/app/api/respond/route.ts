import { NextResponse } from "next/server";
import { runImotara } from "@/lib/ai/orchestrator/runImotara";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({} as any));

    // Support multiple payload shapes without adding any AI logic here:
    // Preferred: { message, context }
    // Legacy: { text }
    // Older: { inputs: [{ text: string, ... }], options?: ... }
    const message =
        (body?.message ??
            body?.text ??
            (Array.isArray(body?.inputs) && body.inputs.length
                ? body.inputs[body.inputs.length - 1]?.text
                : "") ??
            "") as string;

    const result = await runImotara({
        userMessage: message,
        sessionContext: body?.context ?? body?.options ?? undefined,
    });

    return NextResponse.json(
        {
            ...result,
            meta: {
                ...(result as any)?.meta,
                styleContract: "1.0",
                blueprint: "1.0",
            },
        },
        { status: 200 }
    );
}

export async function GET() {
    return NextResponse.json(
        {
            ok: true,
            route: "/api/respond",
            contract: "ImotaraResponse",
            note: "User-facing response endpoint. Use this across Web/iOS/Android for parity.",
        },
        { status: 200 }
    );
}
