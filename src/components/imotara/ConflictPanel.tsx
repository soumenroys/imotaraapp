"use client";

import React, { useEffect, useState } from "react";
import type { ConflictPreview } from "@/lib/imotara/syncHistory";

type ChoiceKeep = "local" | "remote";

type Props = {
  open: boolean;
  conflicts: ConflictPreview[]; // synced with real sync engine
  onClose: () => void;
  onSubmit: (choices: Array<{ id: string; keep: ChoiceKeep }>) => void;
};

export default function ConflictPanel({
  open,
  conflicts,
  onClose,
  onSubmit,
}: Props) {
  const [choices, setChoices] = useState<Record<string, ChoiceKeep>>({});

  // Initialize defaults when the panel opens or conflicts change
  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      setChoices({});
      return;
    }

    const initial: Record<string, ChoiceKeep> = {};
    for (const c of conflicts) {
      const lu = c.local?.updatedAt ?? 0;
      const ru = c.remote?.updatedAt ?? 0;
      initial[c.id] = lu >= ru ? "local" : "remote";
    }
    setChoices(initial);
  }, [open, conflicts]);

  if (!open) return null;

  const hasConflicts = conflicts.length > 0;

  const submit = () => {
    if (!hasConflicts) {
      onClose();
      return;
    }
    const payload = conflicts.map((c) => ({
      id: c.id,
      keep: choices[c.id] ?? "local",
    }));
    onSubmit(payload);
  };

  const setAll = (keep: ChoiceKeep) => {
    const next: Record<string, ChoiceKeep> = {};
    for (const c of conflicts) {
      next[c.id] = keep;
    }
    setChoices(next);
  };

  const isFieldChanged = (c: ConflictPreview, field: string) =>
    Array.isArray(c.diffs) && c.diffs.includes(field);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-panel-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel (Aurora glass bottom sheet) */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-3xl border border-white/15 bg-white/10 shadow-[0_-18px_60px_rgba(15,23,42,0.9)] backdrop-blur-xl dark:bg-black/70">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="space-y-1">
            <h2
              id="conflict-panel-title"
              className="text-sm font-semibold text-zinc-50"
            >
              Resolve Conflicts
            </h2>
            <p className="text-[11px] text-zinc-300">
              Choose whether to keep your local edit or the version from the
              server. Fields with a soft highlight differ between local and
              remote.
            </p>
          </div>

          <button
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-zinc-100 shadow-sm transition hover:bg-white/20"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Conflict list */}
        <div className="max-h-[60vh] overflow-auto px-4 py-3">
          {!hasConflicts ? (
            <p className="text-sm text-zinc-200">No conflicts to resolve.</p>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((c) => {
                const choice = choices[c.id] ?? "local";
                const localSelected = choice === "local";
                const remoteSelected = choice === "remote";

                const emotionChanged = isFieldChanged(c, "emotion");
                const intensityChanged = isFieldChanged(c, "intensity");
                const messageChanged = isFieldChanged(c, "message");

                return (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-white/12 bg-white/5 p-3 text-sm text-zinc-100 shadow-sm backdrop-blur-md transition hover:bg-white/10"
                  >
                    {/* Title row */}
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-medium text-zinc-50">
                        Record:{" "}
                        <span className="font-mono text-[11px] text-zinc-300">
                          {c.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* summary badge */}
                        {c.summary && (
                          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-300/30">
                            {c.summary}
                          </span>
                        )}
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-200">
                          Keeping:{" "}
                          <span className="font-semibold text-emerald-200">
                            {choice === "local" ? "Local" : "Remote"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* diff info */}
                    {Array.isArray(c.diffs) && c.diffs.length > 0 && (
                      <div className="mb-2 text-[10px] text-zinc-300">
                        Changed fields: {c.diffs.join(", ")}
                      </div>
                    )}

                    {/* 2-column comparison */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {/* Local */}
                      <div
                        className={[
                          "rounded-xl border p-2 transition-colors",
                          localSelected
                            ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.5)]"
                            : "border-white/10 bg-white/5",
                        ].join(" ")}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-50">
                            Local
                          </span>
                          <span className="text-[10px] text-zinc-300">
                            {c.local?.updatedAt
                              ? new Date(
                                c.local.updatedAt
                              ).toLocaleString()
                              : "—"}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-zinc-100">
                          <div
                            className={[
                              "rounded",
                              emotionChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Emotion:</b> {c.local?.emotion ?? "—"}
                          </div>
                          <div
                            className={[
                              "rounded",
                              intensityChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Intensity:</b> {c.local?.intensity ?? "—"}
                          </div>
                          <div
                            className={[
                              "line-clamp-3 rounded",
                              messageChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Message:</b> {c.local?.message ?? "—"}
                          </div>
                        </div>

                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-100">
                          <input
                            type="radio"
                            name={`choice-${c.id}`}
                            checked={localSelected}
                            onChange={() =>
                              setChoices((prev) => ({
                                ...prev,
                                [c.id]: "local",
                              }))
                            }
                          />
                          Keep Local
                        </label>
                      </div>

                      {/* Remote */}
                      <div
                        className={[
                          "rounded-xl border p-2 transition-colors",
                          remoteSelected
                            ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.5)]"
                            : "border-white/10 bg-white/5",
                        ].join(" ")}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-50">
                            Remote
                          </span>
                          <span className="text-[10px] text-zinc-300">
                            {c.remote?.updatedAt
                              ? new Date(
                                c.remote.updatedAt
                              ).toLocaleString()
                              : "—"}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-zinc-100">
                          <div
                            className={[
                              "rounded",
                              emotionChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Emotion:</b> {c.remote?.emotion ?? "—"}
                          </div>
                          <div
                            className={[
                              "rounded",
                              intensityChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Intensity:</b> {c.remote?.intensity ?? "—"}
                          </div>
                          <div
                            className={[
                              "line-clamp-3 rounded",
                              messageChanged
                                ? "bg-amber-400/15 px-1"
                                : "",
                            ].join(" ")}
                          >
                            <b>Message:</b> {c.remote?.message ?? "—"}
                          </div>
                        </div>

                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-100">
                          <input
                            type="radio"
                            name={`choice-${c.id}`}
                            checked={remoteSelected}
                            onChange={() =>
                              setChoices((prev) => ({
                                ...prev,
                                [c.id]: "remote",
                              }))
                            }
                          />
                          Keep Remote
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 text-xs text-zinc-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div>
              {conflicts.length} conflict
              {conflicts.length === 1 ? "" : "s"}
            </div>
            {hasConflicts && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-300">Quick actions:</span>
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-100 transition hover:bg-white/10"
                  onClick={() => setAll("local")}
                >
                  Prefer Local for All
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-100 transition hover:bg-white/10"
                  onClick={() => setAll("remote")}
                >
                  Prefer Remote for All
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-zinc-100 transition hover:bg-white/10"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
              onClick={submit}
              disabled={!hasConflicts}
            >
              Apply Choices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
