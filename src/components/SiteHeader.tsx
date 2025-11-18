"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";

// Navigation links
const links = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/history", label: "History" },
  { href: "/connect", label: "Connect" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/70 backdrop-blur dark:border-zinc-800/80 dark:bg-black/50">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        {/* LEFT: Logo */}
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Imotara
        </Link>

        {/* CENTER: Navigation */}
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2 py-1 transition ${active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Global Conflicts button (reuses working component) */}
        <div className="flex items-center">
          <ConflictReviewButton />
        </div>
      </div>
    </header>
  );
}
