// src/components/imotara/PrivacyActionsPanel.tsx
"use client";

import { useState } from "react";
import {
    Download,
    Trash2,
    CloudDownload,
    CloudOff,
    Shield,
    Sparkles,
    Wand2,
} from "lucide-react";
import {
    exportHistoryAsJsonFile,
    deleteAllRemoteHistory,
} from "@/lib/imotara/privacyClientActions";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

type ExportState = "idle" | "running" | "done" | "error";
type CloudExportState = "idle" | "running" | "done" | "error";
type DeleteState = "idle" | "running" | "done" | "error";
type RemoteDeleteState = "idle" | "running" | "done" | "error";

function safeParseJson(raw: string | null) {
    if (raw == null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

export default function PrivacyActionsPanel() {
    const [exportState, setExportState] = useState<ExportState>("idle");
    const [cloudExportState, setCloudExportState] =
        useState<CloudExportState>("idle");
    const [deleteState, setDeleteState] = useState<DeleteState>("idle");
    const [remoteDeleteState, setRemoteDeleteState] =
        useState<RemoteDeleteState>("idle");
    const [message, setMessage] = useState<string | null>(null);

    const { mode: consentMode, setMode, ready: consentLoaded } = useAnalysisConsent();

    const isBusy =
        exportState === "running" ||
        cloudExportState === "running" ||
        deleteState === "running" ||
        remoteDeleteState === "running";

    /* ------------------------------------------------------------------------
     * Consent handlers
     * ----------------------------------------------------------------------*/

    const handleSelectLocalOnly = () => {
        setMode("local-only");
        setMessage(
            "Imotara will keep analysis on this device only. You can change this anytime."
        );
    };

    const handleSelectAuto = () => {
        setMode("auto");
        setMessage(
            "Imotara will choose the best approach for each message — local when possible, cloud when it helps."
        );
    };

    const handleSelectAllowRemote = () => {
        setMode("allow-remote");
        setMessage(
            "Imotara may use secure cloud analysis to give deeper emotional support. You’re still in control."
        );
    };

    /* ------------------------------------------------------------------------
     * Local export
     * ----------------------------------------------------------------------*/

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
                    environment: "web",
                    note:
                        "This file contains a best-effort export of Imotara-related data from this browser's local storage.",
                },
                localStorage: collected,
            };

            const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
                type: "application/json",
            });

            const fileName = `imotara-export-${timestamp.replace(/[:.]/g, "-")}.json`;

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setExportState("done");
            setMessage("Export ready — check your downloads for the JSON file.");
        } catch (err) {
            console.error("Imotara local export failed:", err);
            setExportState("error");
            setMessage("Something went wrong while exporting your data.");
        } finally {
            // Small auto-reset of visual state; does NOT affect the downloaded file.
            setTimeout(() => setExportState("idle"), 2000);
        }
    };

    /* ------------------------------------------------------------------------
     * Cloud export (remote history via /api/history)
     * ----------------------------------------------------------------------*/

    const handleCloudExport = async () => {
        if (typeof window === "undefined") return;

        try {
            setCloudExportState("running");
            setMessage(null);

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `imotara-cloud-export-${timestamp}.json`;

            // Use the new helper which calls GET /api/history?mode=array&includeDeleted=1
            await exportHistoryAsJsonFile(fileName);

            setCloudExportState("done");
            setMessage(
                "Cloud export ready — check your downloads for the JSON file (if any remote data exists)."
            );
        } catch (err) {
            console.error("Imotara cloud export failed:", err);
            setCloudExportState("error");
            setMessage(
                "Something went wrong while exporting your cloud data (if any)."
            );
        } finally {
            setTimeout(() => setCloudExportState("idle"), 2500);
        }
    };

    /* ------------------------------------------------------------------------
     * Local delete (this device)
     * ----------------------------------------------------------------------*/

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
            // Visual reset only, real deletion has already happened above.
            setTimeout(() => setDeleteState("idle"), 2500);
        }
    };

    /* ------------------------------------------------------------------------
     * Remote / cloud delete (via DELETE /api/history)
     * ----------------------------------------------------------------------*/

    const handleRemoteDelete = async () => {
        if (typeof window === "undefined") return;

        const confirmed = window.confirm(
            "This will ask Imotara to clear any synced/remote copy of your history for this app (if such a copy exists).\n\nIt will NOT delete anything stored only on this browser. For that, use the device delete option.\n\nContinue with remote delete?"
        );
        if (!confirmed) return;

        try {
            setRemoteDeleteState("running");
            setMessage(null);

            // Use the new helper which calls DELETE /api/history with an empty body
            const payload = await deleteAllRemoteHistory();

            console.info("Imotara remote delete response:", payload);

            setRemoteDeleteState("done");
            setMessage(
                "If a synced/remote copy existed for this app, it has now been asked to delete. You can export again later to verify."
            );
        } catch (err) {
            console.error("Imotara remote delete failed:", err);
            setRemoteDeleteState("error");
            setMessage(
                "Something went wrong while requesting remote delete. Please try again later."
            );
        } finally {
            setTimeout(() => setRemoteDeleteState("idle"), 2500);
        }
    };

    // Derive a subtle tone for the status message (does not change behavior)
    const messageToneClass =
        deleteState === "error" ||
            exportState === "error" ||
            cloudExportState === "error" ||
            remoteDeleteState === "error"
            ? "text-rose-300"
            : deleteState === "done" ||
                exportState === "done" ||
                cloudExportState === "done" ||
                remoteDeleteState === "done"
                ? "text-emerald-300"
                : "text-zinc-400";

    const isLocalOnly = consentMode === "local-only";
    const isAuto = consentMode === "auto";
    const isAllowRemote = consentMode === "allow-remote";

    return (
        <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-inner">
            {/* Consent choice section – three cards */}
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                How Imotara processes your feelings
            </p>
            <p className="mt-2 text-sm text-zinc-300">
                Choose how you want Imotara to think with you. You can switch anytime.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {/* Local-only card */}
                <button
                    type="button"
                    onClick={handleSelectLocalOnly}
                    disabled={isBusy || !consentLoaded}
                    className={`group flex h-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${isLocalOnly
                        ? "border-emerald-400/70 bg-emerald-500/10 shadow-md shadow-emerald-900/40"
                        : "border-zinc-700/80 bg-zinc-900/60 hover:border-emerald-400/60 hover:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${isLocalOnly
                                ? "border-emerald-400/80 bg-emerald-500/15 text-emerald-200"
                                : "border-zinc-600/80 bg-zinc-900 text-zinc-300 group-hover:border-emerald-400/70"
                                }`}
                        >
                            <Shield className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">
                            On-device only
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                        Imotara analyses your words only in this browser. Nothing is sent to
                        any server. Safest and most private.
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-emerald-300/90">
                        {isLocalOnly ? "Selected" : "Tap to switch"}
                    </p>
                </button>

                {/* Auto card */}
                <button
                    type="button"
                    onClick={handleSelectAuto}
                    disabled={isBusy || !consentLoaded}
                    className={`group flex h-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${isAuto
                        ? "border-violet-400/80 bg-violet-500/10 shadow-md shadow-violet-900/40"
                        : "border-zinc-700/80 bg-zinc-900/60 hover:border-violet-400/60 hover:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${isAuto
                                ? "border-violet-400/80 bg-violet-500/15 text-violet-200"
                                : "border-zinc-600/80 bg-zinc-900 text-zinc-300 group-hover:border-violet-400/70"
                                }`}
                        >
                            <Wand2 className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">
                            Auto (smart routing)
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                        Imotara decides per message — local when possible, cloud when it
                        helps give deeper support.
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-violet-300/90">
                        {isAuto ? "Selected" : "Tap to switch"}
                    </p>
                </button>

                {/* Allow-remote card */}
                <button
                    type="button"
                    onClick={handleSelectAllowRemote}
                    disabled={isBusy || !consentLoaded}
                    className={`group flex h-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${isAllowRemote
                        ? "border-sky-400/80 bg-sky-500/10 shadow-md shadow-sky-900/40"
                        : "border-zinc-700/80 bg-zinc-900/60 hover:border-sky-400/70 hover:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${isAllowRemote
                                ? "border-sky-400/80 bg-sky-500/15 text-sky-200"
                                : "border-zinc-600/80 bg-zinc-900 text-zinc-300 group-hover:border-sky-400/70"
                                }`}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">
                            Cloud analysis
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                        Imotara always uses secure cloud technology for more nuanced,
                        supportive responses. Your data is handled with care.
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-sky-300/90">
                        {isAllowRemote ? "Selected" : "Tap to switch"}
                    </p>
                </button>
            </div>

            {/* Divider text for the rest of tools */}
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Manage data & privacy
            </p>
            <p className="mt-2 text-sm text-zinc-300">
                These controls affect the data Imotara uses in this browser and, where
                available, any synced copy for this experience. You stay in
                control here.
            </p>

            <div className="mt-4 flex flex-col gap-3">
                {/* Local Export */}
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-medium text-emerald-100 shadow-sm transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Download className="h-4 w-4" />
                    {exportState === "running"
                        ? "Preparing your download…"
                        : "Download everything you wrote (this device)"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    This saves a copy of your chats and emotion history that are stored
                    locally in this browser. Nothing new is uploaded anywhere.
                </p>

                {/* Cloud / Server Export */}
                <button
                    type="button"
                    onClick={handleCloudExport}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/70 px-4 py-2 text-sm font-medium text-sky-100 shadow-sm transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <CloudDownload className="h-4 w-4" />
                    {cloudExportState === "running"
                        ? "Fetching cloud copy…"
                        : "Download cloud copy (if available)"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    If Imotara keeps a synced history for this app in the cloud, this
                    downloads that copy as a JSON file. If no remote data exists yet, the
                    file will say so.
                </p>

                {/* Remote / Cloud Delete */}
                <button
                    type="button"
                    onClick={handleRemoteDelete}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-400/80 px-4 py-2 text-sm font-medium text-amber-50/90 shadow-sm transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <CloudOff className="h-4 w-4" />
                    {remoteDeleteState === "running"
                        ? "Requesting remote delete…"
                        : "Delete cloud copy (if any)"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    This asks Imotara to clear any synced/remote history for this app
                    (if such a copy exists). It does not touch data stored only on this
                    browser.
                </p>

                {/* Local Delete */}
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/80 px-4 py-2 text-sm font-medium text-rose-100/90 shadow-sm transition hover:bg-rose-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Trash2 className="h-4 w-4" />
                    {deleteState === "running" ? "Deleting…" : "Delete what’s stored on this device"}
                </button>
                <p className="text-[11px] text-zinc-500">
                    This only deletes Imotara data on this browser. You can always start
                    fresh and keep using the app.
                </p>
            </div>

            {/* Status message area (screen-reader friendly) */}
            {message && (
                <p className={`mt-3 text-xs ${messageToneClass}`} aria-live="polite">
                    {message}
                </p>
            )}
        </div>
    );
}
