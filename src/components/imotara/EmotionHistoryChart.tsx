// src/components/imotara/EmotionHistoryChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

type Point = {
  t: number; // timestamp (ms)
  intensity: number | null; // 0..1 or null (gap)
  emotion: string | null;
  source: string;
};

type Props = {
  data: Point[];
  height?: number;
  label?: string;
};

export default function EmotionHistoryChart({
  data,
  height = 280,
  label = "Intensity",
}: Props) {
  // Deterministic prep (no Date.now())
  const formatted = data.map((d) => ({
    ...d,
    ts: d.t,
    x: format(new Date(d.t), "MMM d"),
    y: d.intensity,
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Emotion Trend
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formatted}>
          <CartesianGrid strokeOpacity={0.2} />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />

          <Tooltip
            // Recharts types vary by version; keep handlers broadly typed with `unknown`
            formatter={(value: unknown, _name: unknown, ctx: unknown) => {
              // `ctx` is typically a Payload with a `dataKey`
              const dataKey = (ctx as { dataKey?: string } | undefined)?.dataKey;
              if (dataKey === "y") {
                return [value as number, label] as [number, string];
              }
              return [value as number, String(_name)] as [number, string];
            }}
            labelFormatter={(_label: unknown, payload: readonly unknown[]) => {
              // payload[0]?.payload.ts (timestamp we injected above)
              const p0 = payload?.[0] as { payload?: { ts?: number } } | undefined;
              const ts = p0?.payload?.ts ?? 0;
              return ts ? format(new Date(ts), "MMM d, yyyy HH:mm") : "";
            }}
          />

          <Line
            type="monotone"
            dataKey="y"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
        Shows primary emotion intensity (0–1) across your messages. Gaps mean the
        filtered emotion didn’t occur.
      </p>
    </div>
  );
}
