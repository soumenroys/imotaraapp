// src/components/imotara/ConflictReviewModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, GitPullRequest, Layers, X } from "lucide-react";
import type { ConflictList, HistoryConflict } from "@/types/sync";
import {
  getPendingConflicts,
  removeConflict,
  setPendingConflicts,
} from "@/lib/imotara/conflictsStore";
import type { EmotionRecord } from "@/types/history";
import { applyConflictResolution } from "@/lib/imotara/syncHistory";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ConflictReviewModal({ open, onClose }: Props) {
  const [conflicts, setConflicts] = useState<ConflictList>([]);
  const [active, setActive] = useState<HistoryConflict | null>(null);
  const [merged, setMerged] = useState<EmotionRecord | null>(null);

  useEffect(() => {
    if (!open) return;

    const list = getPendingConflicts().filter((c) => !c.resolution);

    // Defer state updates to avoid "set-state-in-effect" lint error
    const t = window.setTimeout(() => {
      setConflicts(list);
      setActive(list[0] ?? null);
      setMerged(null);
    }, 0);

    return () => window.clearTimeout(t);
  }, [open]);

  const remaining = conflicts.length;

  const prettyReason = useMemo(() => {
    if (!active) return "";
    switch (active.reason) {
      case "newer-local":
        return "Local changed after remote";
      case "newer-remote":
        return "Remote changed after local";
      case "same-updatedAt-diff-content":
        return "Both updated at same time but content differs";
      case "duplicate-id":
        return "Duplicate ID detected";
      default:
        return "";
    }
  }, [active]);

  async function resolve(decision: "kept-local" | "kept-remote" | "merged") {
    if (!active) return;

    const mergedRecord =
      decision === "merged" ? merged ?? active.local ?? active.remote ?? null : undefined;

    // New signature: applyConflictResolution(decisions: ConflictDecision[])
    // We send one decision; cast the array to any to avoid over-constraining the literal.
    await applyConflictResolution(
      [
        {
          id: active.id,
          recordId: active.recordId,
          decision,
          mergedRecord: mergedRecord || undefined,
        },
      ] as any
    );

    // mark as resolved locally
    const all = getPendingConflicts();
    const idx = all.findIndex((c) => c.id === active.id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        resolution: decision,
        resolvedAt: Date.now(),
        mergedRecord: decision === "merged" ? mergedRecord ?? undefined : undefined,
      };
      setPendingConflicts(all);
    }
    removeConflict(active.id);

    const pending = all.filter((c) => !c.resolution);
    setConflicts(pending);
    setActive(pending[0] ?? null);
    setMerged(null);
    if (pending.length === 0) onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* modal */}
      <div className="relative z-[61] w-[min(960px,92vw)] max-h-[86vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-zinc-300" />
            <h2 className="text-base font-semibold text-zinc-100">Resolve Sync Conflicts</h2>
            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {remaining} pending
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {active ? (
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            {/* Local */}
            <Pane title="Local" record={active.local} badge="LOCAL" />
            {/* Remote */}
            <Pane title="Remote" record={active.remote} badge="REMOTE" />
          </div>
        ) : (
          <div className="p-6 text-sm text-zinc-300">No conflicts 🎉</div>
        )}

        {/* footer actions */}
        {active && (
          <div className="border-t border-zinc-800 px-5 py-3">
            <div className="mb-2 text-xs text-zinc-400">
              Record: <span className="font-mono text-zinc-300">{active.recordId}</span> • Reason:{" "}
              {prettyReason}
            </div>
            {/* Merge editor */}
            <div className="mb-3 rounded-xl border border-zinc-800 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                <Layers className="h-4 w-4" />
                <span>Merge & Edit (optional)</span>
              </div>
              <textarea
                className="h-24 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none"
                placeholder="Write a merged message or tweak fields (this populates only the message field; other fields picked from Local if present, else Remote)."
                value={merged?.message ?? ""}
                onChange={(e) => {
                  const base: EmotionRecord | undefined = active.local ?? active.remote ?? undefined;
                  if (!base) return setMerged(null);
                  setMerged({
                    ...base,
                    message: e.target.value,
                    // bump updatedAt to now for the merged record
                    updatedAt: Date.now(),
                  });
                }}
              />
              <div className="mt-2 text-xs text-zinc-400">
                Tip: If you leave this empty, “Merge & Save” will fallback to the Local (if present)
                else Remote record.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-400">
                Choose how to resolve. Your choice will be saved and conflicts list will update.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resolve("kept-local")}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  Keep Local
                </button>
                <button
                  onClick={() => resolve("kept-remote")}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  Keep Remote
                </button>
                <button
                  onClick={() => resolve("merged")}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  <Check className="h-4 w-4" />
                  Merge & Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pane({
  title,
  record,
  badge,
}: {
  title: string;
  record?: EmotionRecord | null;
  badge: "LOCAL" | "REMOTE";
}) {
  if (!record) {
    return (
      <div className="border-b border-zinc-800 p-5 md:border-b-0 md:border-r">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
            {badge}
          </span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-400">
          Not available
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-zinc-800 p-5 md:border-b-0 md:border-r">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
          {badge}
        </span>
      </div>
      <div className="grid gap-2">
        <KV k="Updated" v={new Date(record.updatedAt ?? 0).toLocaleString()} />
        <KV k="Created" v={new Date(record.createdAt).toLocaleString()} />
        <KV k="Emotion" v={String(record.emotion)} />
        <KV k="Intensity" v={String(record.intensity)} />
        <KV k="Source" v={String(record.source ?? "")} />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="pb-1 text-xs text-zinc-500">Message</div>
          <div className="whitespace-pre-wrap text-sm text-zinc-100">{record.message}</div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
      <div className="text-xs text-zinc-400">{k}</div>
      <div className="max-w-[60%] truncate text-sm text-zinc-100">{v}</div>
    </div>
  );
}
