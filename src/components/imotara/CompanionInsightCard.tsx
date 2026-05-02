// src/components/imotara/CompanionInsightCard.tsx
// Shared card for P3 (Companion's Letter) and P5 (Emotional Arc Narrative).

"use client";

import { Mail, BookOpen, X } from "lucide-react";

export type InsightCardVariant = "letter" | "arc";

type Props = {
  variant: InsightCardVariant;
  title: string;   // e.g. "A letter from Imotara" or "Your April — an emotional arc"
  body: string;
  onDismiss: () => void;
};

const CONFIG: Record<InsightCardVariant, { icon: typeof Mail; accent: string; badge: string }> = {
  letter: {
    icon: Mail,
    accent: "from-indigo-500/10 border-indigo-500/25",
    badge: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30",
  },
  arc: {
    icon: BookOpen,
    accent: "from-emerald-500/10 border-emerald-500/25",
    badge: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  },
};

export default function CompanionInsightCard({ variant, title, body, onDismiss }: Props) {
  const { icon: Icon, accent, badge } = CONFIG[variant];

  return (
    <div className={`relative mx-3 mb-3 rounded-2xl border bg-gradient-to-b ${accent} to-transparent px-4 py-4`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge}`}>
          <Icon className="h-3 w-3" />
          {variant === "letter" ? "Monthly letter" : "Your emotional arc"}
        </span>
        <button
          onClick={onDismiss}
          className="ml-auto text-zinc-600 hover:text-zinc-300 transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title */}
      <p className="mb-2 text-sm font-semibold text-zinc-200">{title}</p>

      {/* Body — preserve line breaks */}
      <div className="space-y-3">
        {body.split(/\n\n+/).map((para, i) => (
          <p key={i} className="text-sm leading-relaxed text-zinc-400">{para}</p>
        ))}
      </div>
    </div>
  );
}
