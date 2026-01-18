import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
    return NextResponse.json(
        {
            ok: false,
            error: "deprecated_route",
            message: "This endpoint has been retired. Use POST /api/respond instead.",
            canonical: "/api/respond",
        },
        { status: 410 }
    );
}

export async function GET() {
    return NextResponse.json(
        {
            ok: false,
            error: "deprecated_route",
            message: "This endpoint has been retired. Use POST /api/respond instead.",
            canonical: "/api/respond",
        },
        { status: 410 }
    );
}
