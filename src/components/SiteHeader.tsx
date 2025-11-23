"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";

// Navigation links (Settings grouped with Chat/History)
const links = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
  { href: "/connect", label: "Connect" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/12 bg-white/75 bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.16),transparent_55%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.16),transparent_55%)] backdrop-blur-xl transition-colors dark:border-zinc-800/80 dark:bg-black/70">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* LEFT: Logo / brand */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 transition hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
          aria-label="Imotara home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-[11px] font-bold text-white shadow-[0_10px_25px_rgba(15,23,42,0.8)]">
            I
          </span>
          <span className="hidden sm:inline">Imotara</span>
        </Link>

        {/* CENTER: Navigation */}
        <nav
          className="flex max-w-[55vw] items-center justify-center gap-1 overflow-x-auto text-xs text-zinc-600 sm:max-w-none sm:gap-3 sm:text-sm dark:text-zinc-300"
          aria-label="Main navigation"
        >
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);

            const base =
              "relative whitespace-nowrap rounded-full px-2.5 py-1 transition-colors";
            const activeClass = [
              "imotara-nav-active",
              "bg-zinc-900/90 text-zinc-50 shadow-sm ring-1 ring-white/25",
              "dark:bg-zinc-100 dark:text-zinc-900",
            ].join(" ");
            const inactiveClass =
              "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50";

            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={[base, active ? activeClass : inactiveClass].join(
                  " "
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Global Conflicts button (shared component) */}
        <div className="flex items-center justify-end pl-3">
          <ConflictReviewButton />
        </div>
      </div>
    </header>
  );
}
