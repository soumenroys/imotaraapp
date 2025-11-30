// src/app/api/export/route.ts
//
// Server-side export of Imotara "cloud"/remote history.
// This is designed to be additive and safe:
// - It does NOT touch localStorage (that is handled in PrivacyActionsPanel).
// - It tries to reuse the existing /api/history endpoint.
// - If history is unavailable, it still returns a JSON payload explaining why.
//
// Later, you can attach a UI button (e.g. "Download cloud copy")
// that simply calls this endpoint and triggers a file download.

import { NextResponse } from "next/server";

export async function GET() {
    const timestamp = new Date().toISOString();

    let remoteHistory: unknown = null;

    try {
        // We try to call the existing /api/history?mode=array endpoint,
        // because the sync engine already relies on it.
        //
        // This avoids coupling to whatever storage backend you use under the hood.
        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:3000");

        const historyUrl = `${baseUrl}/api/history?mode=array`;

        const res = await fetch(historyUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            // We want a fresh snapshot, not a cached one.
            cache: "no-store",
        });

        if (res.ok) {
            // Whatever /api/history returns (likely an array of EmotionRecord)
            // is included as-is in the export.
            remoteHistory = await res.json();
        } else {
            remoteHistory = {
                error: "history-endpoint-unavailable",
                status: res.status,
                statusText: res.statusText,
            };
        }
    } catch (err) {
        console.error("[Imotara] /api/export: history fetch failed", err);
        remoteHistory = {
            error: "history-fetch-failed",
            message:
                err instanceof Error ? err.message : "Unknown error while fetching history",
        };
    }

    const snapshot = {
        meta: {
            exportedAt: timestamp,
            app: "Imotara",
            kind: "server-history-export",
            note:
                "Server-side snapshot of any history Imotara keeps for this user/session. It does NOT include this browser's local-only data.",
        },
        remoteHistory,
    };

    try {
        const safeTimestamp = timestamp.replace(/[:.]/g, "-");
        const fileName = `imotara-cloud-export-${safeTimestamp}.json`;

        return new NextResponse(JSON.stringify(snapshot, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error("[Imotara] /api/export: response construction failed", error);
        return NextResponse.json(
            {
                error: "export_failed",
                message: "Could not build export response.",
            },
            { status: 500 }
        );
    }
}
