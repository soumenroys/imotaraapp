'use client';

import React, { useMemo, useState } from 'react';
import type { Conflict } from '@/types/sync';

type Choice = 'local' | 'remote';

type Props = {
  open: boolean;
  conflicts: Conflict[];
  onClose: () => void;
  /** Called with the user’s choices; parent will handle applying later */
  onSubmit: (choices: Array<{ id: string; keep: Choice }>) => void;
};

export default function ConflictPanel({ open, conflicts, onClose, onSubmit }: Props) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  // initialize defaults only when conflicts change (prefer newest by updatedAt)
  useMemo(() => {
    const init: Record<string, Choice> = {};
    for (const c of conflicts) {
      const lu = c.local?.updatedAt ?? 0;
      const ru = c.remote?.updatedAt ?? 0;
      init[c.id] = lu >= ru ? 'local' : 'remote';
    }
    setChoices(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(conflicts.map(c => c.id))]);

  if (!open) return null;

  const submit = () => {
    const payload = conflicts.map(c => ({ id: c.id, keep: choices[c.id] ?? 'local' }));
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Resolve Conflicts
          </h2>
          <button
            className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto p-4">
          {conflicts.length === 0 ? (
            <p className="text-sm text-zinc-500">No conflicts to resolve.</p>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100">
                      Record: <span className="font-mono text-xs">{c.id}</span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {c.reason}
                    </span>
                  </div>

                  {/* Preview rows */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {/* Local */}
                    <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold">Local</span>
                        <span className="text-[10px] text-zinc-500">
                          {c.local?.updatedAt
                            ? new Date(c.local.updatedAt).toLocaleString()
                            : '—'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        <div><b>Emotion:</b> {c.local?.emotion ?? '—'}</div>
                        <div><b>Intensity:</b> {c.local?.intensity ?? '—'}</div>
                        <div className="line-clamp-3"><b>Message:</b> {c.local?.message ?? '—'}</div>
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={(choices[c.id] ?? 'local') === 'local'}
                          onChange={() =>
                            setChoices((prev) => ({ ...prev, [c.id]: 'local' }))
                          }
                        />
                        Keep Local
                      </label>
                    </div>

                    {/* Remote */}
                    <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold">Remote</span>
                        <span className="text-[10px] text-zinc-500">
                          {c.remote?.updatedAt
                            ? new Date(c.remote.updatedAt).toLocaleString()
                            : '—'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        <div><b>Emotion:</b> {c.remote?.emotion ?? '—'}</div>
                        <div><b>Intensity:</b> {c.remote?.intensity ?? '—'}</div>
                        <div className="line-clamp-3"><b>Message:</b> {c.remote?.message ?? '—'}</div>
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={(choices[c.id] ?? 'local') === 'remote'}
                          onChange={() =>
                            setChoices((prev) => ({ ...prev, [c.id]: 'remote' }))
                          }
                        />
                        Keep Remote
                      </label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">
            {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              onClick={submit}
              disabled={conflicts.length === 0}
            >
              Apply Choices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
