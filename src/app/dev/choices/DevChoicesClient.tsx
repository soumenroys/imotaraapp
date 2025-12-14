// src/app/dev/choices/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import type { Choice } from "@/types/choice";
import { ChoiceAction } from "@/types/choice";
import ChoicePills from "@/components/imotara/ChoicePills";
import { getHistory } from "@/lib/imotara/history";

function seedChoices(rec: EmotionRecord): Choice[] {
    // Seed a few deterministic choices based on current state
    const baseId = `rec-${rec.id}`;
    const choices: Choice[] = [
        {
            id: `${baseId}-set-calm`,
            label: "Set emotion → calm",
            action: ChoiceAction.SetEmotion,
            payload: { emotion: "neutral" }, // you can change to "joy" or others later
            tooltip: "Sets the emotion to neutral",
        },
        {
            id: `${baseId}-intensity-35`,
            label: "Intensity → 0.35",
            action: ChoiceAction.SetIntensity,
            payload: { intensity: 0.35 },
            tooltip: "Sets intensity to 0.35",
        },
        {
            id: `${baseId}-tag-sleep`,
            label: "Tag: sleep",
            action: ChoiceAction.TagTopic,
            payload: { tag: "sleep" },
            tooltip: "Adds 'sleep' tag",
        },
        {
            id: `${baseId}-followup-break`,
            label: "Create follow-up",
            action: ChoiceAction.CreateFollowUp,
            payload: { text: "Take a 5-minute breathing break" },
            tooltip: "Adds a small follow-up",
        },
        {
            id: `${baseId}-important`,
            label: "Mark important",
            action: ChoiceAction.MarkImportant,
            tooltip: "Marks this record as important",
        },
    ];

    return choices;
}

export default function DevChoicesPage() {
    const [record, setRecord] = useState<EmotionRecord | null>(null);

    useEffect(() => {
        (async () => {
            const list = await getHistory();
            if (!list.length) {
                setRecord(null);
                return;
            }
            // show the latest by updatedAt
            const latest = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
            // Attach choices in-memory for this demo page only
            const demoChoices = seedChoices(latest);
            setRecord({ ...latest, choices: demoChoices });
        })();
    }, []);

    const tags = useMemo(() => record?.topicTags ?? [], [record?.topicTags]);
    const followUps = useMemo(() => record?.followUps ?? [], [record?.followUps]);

    if (!record) {
        return (
            <main className="mx-auto max-w-2xl p-6 text-zinc-900 dark:text-zinc-100">
                <h1 className="text-2xl font-semibold">Choices Demo</h1>
                <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                    No history found. Please use the app to create at least one entry, then
                    revisit <code>/dev/choices</code>.
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-2xl p-6 text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-semibold">Choices Demo</h1>

            <section className="mt-6 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    <div><span className="font-medium text-zinc-700 dark:text-zinc-200">Record ID:</span> {record.id}</div>
                    <div><span className="font-medium text-zinc-700 dark:text-zinc-200">Message:</span> {record.message}</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                        <div className="text-zinc-500 dark:text-zinc-400">Emotion</div>
                        <div className="mt-1 text-lg font-medium">{record.emotion}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                        <div className="text-zinc-500 dark:text-zinc-400">Intensity</div>
                        <div className="mt-1 text-lg font-medium">{record.intensity.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                        <div className="text-zinc-500 dark:text-zinc-400">Tags</div>
                        <div className="mt-1 text-lg font-medium">
                            {tags.length ? tags.join(", ") : "—"}
                        </div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                        <div className="text-zinc-500 dark:text-zinc-400">Important</div>
                        <div className="mt-1 text-lg font-medium">
                            {record.important ? "Yes" : "No"}
                        </div>
                    </div>
                </div>

                <ChoicePills
                    className="mt-5"
                    record={record}
                    onAfterApply={(updated) => {
                        // Keep the same demo choices visible after apply,
                        // but reflect updated fields from the saved record.
                        setRecord({ ...updated, choices: seedChoices(updated) });
                    }}
                />

                <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
                    <div className="text-zinc-500 dark:text-zinc-400">Follow-ups</div>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                        {followUps.length ? (
                            followUps.map((fu) => (
                                <li key={fu.id} className="text-zinc-700 dark:text-zinc-200">
                                    {fu.text}
                                </li>
                            ))
                        ) : (
                            <li className="text-zinc-500 dark:text-zinc-400">—</li>
                        )}
                    </ul>
                </div>
            </section>

            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                Note: This page seeds choices only in memory to demo the flow. Your actual UI
                can provide choices from analysis or templates.
            </p>
        </main>
    );
}
