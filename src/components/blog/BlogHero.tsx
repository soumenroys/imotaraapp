// src/components/blog/BlogHero.tsx
// Renders a rich gradient hero banner for a blog post.
// Uses the post's coverImage (if set) or falls back to a
// category-specific gradient with the coverEmoji.

import Image from "next/image";
import type { BlogCategory } from "@/lib/blog";

const CATEGORY_GRADIENTS: Record<BlogCategory, string> = {
  "Mental Health":
    "from-sky-800/70 via-indigo-800/50 to-slate-900",
  Mindfulness:
    "from-emerald-800/70 via-teal-800/50 to-slate-900",
  Product:
    "from-indigo-700/70 via-violet-800/50 to-slate-900",
  Research:
    "from-violet-700/70 via-purple-800/50 to-slate-900",
  Stories:
    "from-rose-700/70 via-pink-800/50 to-slate-900",
};

const CATEGORY_ORBS: Record<BlogCategory, string> = {
  "Mental Health":  "bg-sky-400/25",
  Mindfulness:      "bg-emerald-400/25",
  Product:          "bg-indigo-400/30",
  Research:         "bg-violet-400/30",
  Stories:          "bg-rose-400/25",
};

const CATEGORY_GLOW: Record<BlogCategory, string> = {
  "Mental Health":  "rgba(14,165,233,0.25)",
  Mindfulness:      "rgba(16,185,129,0.25)",
  Product:          "rgba(99,102,241,0.25)",
  Research:         "rgba(139,92,246,0.25)",
  Stories:          "rgba(244,63,94,0.25)",
};

interface BlogHeroProps {
  category: BlogCategory;
  coverEmoji?: string;
  coverImage?: string;
  title: string;
  /** compact = smaller height, used on list cards */
  compact?: boolean;
}

export default function BlogHero({
  category,
  coverEmoji,
  coverImage,
  title,
  compact = false,
}: BlogHeroProps) {
  const height = compact ? "h-40" : "h-52 sm:h-64";

  if (coverImage) {
    return (
      <div className={`relative w-full overflow-hidden ${height}`}>
        <Image
          src={coverImage}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        {/* Overlay so text on top stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>
    );
  }

  // Gradient fallback — no border-radius: the parent card's overflow-hidden + rounded-2xl clips this cleanly
  return (
    <div
      suppressHydrationWarning
      className={`relative flex w-full items-center justify-center overflow-hidden ${height} bg-gradient-to-br ${CATEGORY_GRADIENTS[category]}`}
    >
      {/* Orb 1 */}
      <div
        aria-hidden
        className={`absolute -left-10 -top-10 h-48 w-48 rounded-full ${CATEGORY_ORBS[category]} blur-3xl`}
      />
      {/* Orb 2 */}
      <div
        aria-hidden
        className={`absolute -bottom-10 -right-10 h-48 w-48 rounded-full ${CATEGORY_ORBS[category]} blur-3xl`}
      />
      {/* Emoji */}
      {coverEmoji && (
        <span
          aria-hidden
          className={compact ? "relative z-10 text-6xl drop-shadow-lg" : "relative z-10 text-8xl drop-shadow-xl"}
          style={{ filter: `drop-shadow(0 0 32px ${CATEGORY_GLOW[category]})` }}
        >
          {coverEmoji}
        </span>
      )}
    </div>
  );
}
