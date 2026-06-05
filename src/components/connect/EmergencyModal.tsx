// src/components/connect/EmergencyModal.tsx
"use client";

import { X, Phone, Globe } from "lucide-react";

const CRISIS_LINES: Record<string, Array<{ name: string; number?: string; url?: string }>> = {
  IN: [
    { name: "iCall",                number: "9152987821" },
    { name: "Vandrevala Foundation", number: "1860-2662-345" },
    { name: "Snehi",                number: "044-24640050" },
  ],
  US: [{ name: "988 Suicide & Crisis Lifeline", number: "988" }],
  GB: [{ name: "Samaritans",           number: "116 123"    }],
  AU: [{ name: "Lifeline Australia",   number: "13 11 14"   }],
  CA: [{ name: "Crisis Services Canada", number: "1-833-456-4566" }],
};
const DEFAULT_LINE = { name: "Find A Helpline", url: "https://findahelpline.com" };

interface Props {
  countryCode?: string;
  onClose: () => void;
}

export default function EmergencyModal({ countryCode = "IN", onClose }: Props) {
  const lines = CRISIS_LINES[countryCode] ?? CRISIS_LINES["IN"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="imotara-glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">Emergency Support</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-50">Crisis Helplines</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-300 leading-relaxed">
          If you are in distress or experiencing a mental health emergency, please reach out to a professional helpline immediately.
        </p>

        <div className="space-y-2">
          {lines.map((line) => (
            <a
              key={line.name}
              href={line.number ? `tel:${line.number}` : line.url}
              target={line.url ? "_blank" : undefined}
              rel={line.url ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                <Phone size={14} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{line.name}</p>
                <p className="text-xs text-zinc-400">{line.number ?? "Web resource"}</p>
              </div>
            </a>
          ))}

          <a
            href={DEFAULT_LINE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
              <Globe size={14} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">{DEFAULT_LINE.name}</p>
              <p className="text-xs text-zinc-400">International directory</p>
            </div>
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          This is not a substitute for emergency services. Call 112 / 911 for life-threatening emergencies.
        </p>
      </div>
    </div>
  );
}
