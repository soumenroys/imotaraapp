// src/components/imotara/PrivacyActionsPanel.tsx
"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";

type ExportState = "idle" | "running" | "done" | "error";
type DeleteState = "idle" | "running" | "done" | "error";

function safeParseJson(raw: string | null) {
    if (raw == null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        // If it’s not valid JSON, just return the raw string so it’s not lost.
        return raw;
    }
}

export default function PrivacyActionsPanel() {
    const [exportState, setExportState] = useState<ExportState>("idle");
    const [deleteState, setDeleteState] = useState<DeleteState>("idle");
    const [message, setMessage] = useState<string | null>(null);

    const isBusy = exportState === "running" || deleteState === "running";

    const handleExport = () => {
        if (typeof window === "undefined") return;
        try {
            setExportState("running");
            setMessage(null);

            const now = new Date();
            const timestamp = now.toISOString();

            // Collect relevant keys from localStorage (non-destructive).
            const collected: Record<string, unknown> = {};
            const lowerMatchFragments = [
                "imotara",
                "emotion",
                "history",
                "consent",
                "sync",
                "chat",
            ];

            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (!key) continue;

                const lowerKey = key.toLowerCase();
                const matches = lowerMatchFragments.some((frag) =>
                    lowerKey.includes(frag)
                );

                if (matches) {
                    const raw = window.localStorage.getItem(key);
                    collected[key] = safeParseJson(raw);
                }
            }

            const snapshot = {
                meta: {
                    exportedAt: timestamp,
                    app: "Imotara",
                    environment: "web-preview",
                    note:
                        "This file contains a best-effort export of Imotara-related data from this browser's local storage.",
                },
                localStorage: collected,
            };

            const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
                type: "application/json",
            });

            const fileName = `imotara-export-${timestamp.replace(
                /[:.]/g,
                "-"
            )}.json`;

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setExportState("done");
            setMessage(
                "Export ready — check your downloads for the JSON file."
            );
        } catch (err) {
            console.error("Imotara export failed:", err);
            setExportState("error");
            setMessage("Something went wrong while exporting your data.");
        } finally {
            setTimeout(() => setExportState("idle"), 2000);
        }
    };

    const handleDelete = () => {
        if (typeof window === "undefined") return;

        const confirmed = window.confirm(
            "This will clear Imotara data stored on THIS browser (chat, mood history, consent & sync state) and then return you to the chat screen.\n\nThis only affects this device and cannot be undone. You can still use Imotara again afterwards, but it will start fresh here.\n\nContinue?"
        );
        if (!confirmed) return;

        try {
            setDeleteState("running");
            setMessage(null);

            const lowerMatchFragments = [
                "imotara",
                "emotion",
                "history",
                "consent",
                "sync",
                "chat",
            ];

            const keysToRemove: string[] = [];

            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (!key) continue;

                const lowerKey = key.toLowerCase();
                const matches = lowerMatchFragments.some((frag) =>
                    lowerKey.includes(frag)
                );
                if (matches) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach((key) => {
                window.localStorage.removeItem(key);
            });

            setDeleteState("done");
            setMessage(
                "Imotara data on this device has been cleared. Redirecting you to chat..."
            );

            // Gentle redirect to chat after a short delay.
            setTimeout(() => {
                window.location.href = "/chat";
            }, 900);
        } catch (err) {
            console.error("Imotara delete failed:", err);
            setDeleteState("error");
            setMessage("Something went wrong while deleting your data.");
        } finally {
            setTimeout(() => setDeleteState("idle"), 2500);
        }
    };

    return (
        <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-inner">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Manage data on this device
            </p>
            <p className="mt-2 text-sm text-zinc-300">
                These controls only affect the data stored locally in this browser for
                the current Imotara preview. They don&apos;t touch any future
                cloud-based accounts. You stay in control here.
            </p>

            <div className="mt-4 flex flex-col gap-3">
                {/* Export */}
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-medium text-emerald-100 shadow-sm transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Download className="h-4 w-4" />
                    {exportState === "running"
                        ? "Preparing your download…"
                        : "Download everything you wrote"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    This saves a copy of your chats and emotion history on your device.
                    Nothing is uploaded anywhere.
                </p>

                {/* Delete */}
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/80 px-4 py-2 text-sm font-medium text-rose-100/90 shadow-sm transition hover:bg-rose-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Trash2 className="h-4 w-4" />
                    {deleteState === "running"
                        ? "Deleting…"
                        : "Delete what’s stored on this device"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    This only deletes Imotara data on this browser. You can always start
                    fresh and keep using the app.
                </p>
            </div>

            {message && (
                <p className="mt-3 text-xs text-zinc-400">
                    {message}
                </p>
            )}
        </div>
    );
}
