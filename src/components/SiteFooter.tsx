import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const version = "Web Beta v0.9.7";

  return (
    <footer className="mt-auto border-t border-white/10 bg-gradient-to-t from-black/75 via-slate-950/60 to-transparent backdrop-blur-xl">
      <div className="mx-auto w-full max-w-5xl px-4 py-7 text-xs text-zinc-500 sm:px-6 sm:py-8 sm:text-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* LEFT: Brand & copyright */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              Imotara · Quiet Emotional Companion
            </p>
            <p className="text-[11px] text-zinc-500 sm:text-xs">
              © {year} Imotara. All rights reserved. Experimental local-first
              preview — not a medical or crisis service.
            </p>

            {/* Version indicator */}
            <p className="text-[11px] text-zinc-500 sm:text-xs">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 backdrop-blur-sm">
                {version}
              </span>
            </p>
          </div>

          {/* RIGHT: Footer navigation */}
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
