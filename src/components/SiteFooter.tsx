import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-gradient-to-t from-black/70 via-slate-950/60 to-transparent backdrop-blur-xl">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-zinc-500 sm:px-6 sm:py-7 sm:text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: brand + line */}
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
              Imotara · Quiet Emotional Companion
            </p>
            <p className="text-[11px] text-zinc-500 sm:text-xs">
              © {year} Imotara. All rights reserved. Experimental, local-first
              preview — not a medical or crisis service.
            </p>
          </div>

          {/* Right: links */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs">
            <Link
              href="/privacy"
              className="text-zinc-400 transition hover:text-zinc-200 hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-zinc-400 transition hover:text-zinc-200 hover:underline"
            >
              Terms
            </Link>
            <Link
              href="/connect"
              className="text-zinc-400 transition hover:text-zinc-200 hover:underline"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
