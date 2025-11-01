// src/components/emotion/EmotionHistoryChart.tsx
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

type Point = { t: number; intensity: number | null; emotion: string | null; source: string };

type Props = {
  data: Point[];
  height?: number;
  label?: string;
};

export default function EmotionHistoryChart({ data, height = 280, label = "Intensity" }: Props) {
  // recharts ignores nulls (gaps)
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
            formatter={(value: any, name: any, props: any) => {
              if (name === "y") return [value, label];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload;
              return format(new Date(p.ts), "MMM d, yyyy HH:mm");
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
        Shows primary emotion intensity (0–1) across your messages. Gaps mean the filtered emotion didn’t occur.
      </p>
    </div>
  );
}
