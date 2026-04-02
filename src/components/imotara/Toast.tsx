// src/components/imotara/Toast.tsx
"use client";

import { useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

type Props = {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
};

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-400/35 bg-emerald-950/80 text-emerald-100",
  error:   "border-red-400/35 bg-red-950/80 text-red-100",
  info:    "border-indigo-400/35 bg-indigo-950/80 text-indigo-100",
};

const ICON_CLASS: Record<ToastType, string> = {
  success: "text-emerald-300",
  error:   "text-red-300",
  info:    "text-indigo-300",
};

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  error: 5000,
};

export default function Toast({ message, type = "success", onDismiss, duration }: Props) {
  const ms = duration ?? DEFAULT_DURATION[type];
  useEffect(() => {
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [onDismiss, ms]);

  const Icon = type === "success" ? CheckCircle : type === "error" ? AlertCircle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-28 sm:bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-slide-up whitespace-nowrap ${STYLES[type]}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${ICON_CLASS[type]}`} aria-hidden="true" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 opacity-50 hover:opacity-100 transition"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
