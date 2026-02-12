// src/app/api/delete-remote/route.ts
//
// Server-side "remote delete" helper for Imotara.
//
// Goal (privacy-first, non-breaking):
// - Tries to delete any remote/synced history by calling /api/history with DELETE.
// - If that endpoint is not implemented yet, we still return a friendly JSON
//   payload explaining that remote delete is not available in this preview.
// - Does NOT touch browser localStorage (that is handled in PrivacyActionsPanel).
//
// You can later wire this to a button like
// "Delete cloud copy (if any)" in the Privacy page.

import { NextResponse } from "next/server";

async function performRemoteDelete() {
    const timestamp = new Date().toISOString();

    let remoteDeleteResult: unknown = null;

    try {
        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:3000");

        const historyUrl = `${baseUrl}/api/history`;

        const res = await fetch(historyUrl, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        if (res.ok) {
            // If /api/history implements DELETE, we preserve its response payload
            // (if any) for transparency.
            let body: unknown = null;
            try {
                body = await res.json();
            } catch {
                // If there's no JSON body, that's okay.
                body = null;
            }

            remoteDeleteResult = {
                status: "ok",
                note:
                    "DELETE /api/history succeeded. Remote/synced history should now be cleared.",
                response: body,
            };
        } else {
            remoteDeleteResult = {
                status: "error",
                code: res.status,
                statusText: res.statusText,
                note:
                    "DELETE /api/history is not available or failed. Remote delete may not be fully wired yet.",
            };
        }
    } catch (err) {
        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

        if (SHOULD_LOG) {
            console.warn("[Imotara] /api/delete-remote: delete failed", String(err));
        }

        remoteDeleteResult = {
            status: "error",
            error: "history-delete-failed",
            message:
                err instanceof Error ? err.message : "Unknown error while deleting history",
        };
    }

    const payload = {
        meta: {
            deletedAt: timestamp,
            app: "Imotara",
            kind: "server-history-delete",
            note:
                "Best-effort attempt to delete any remote/synced history for this preview.",
        },
        remoteDeleteResult,
    };

    return NextResponse.json(payload, { status: 200 });
}

// Support both DELETE and POST so the client can call either.
export async function DELETE() {
    return performRemoteDelete();
}

export async function POST() {
    return performRemoteDelete();
}
