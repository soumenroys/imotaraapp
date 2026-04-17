"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import GlobalSearch from "@/components/imotara/GlobalSearch";

// Primary nav — always visible on desktop
const PRIMARY_LINKS = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/history", label: "History" },
  { href: "/grow", label: "Grow" },
  { href: "/settings", label: "Settings" },
];

// Overflow nav — behind "···" on desktop / included in mobile drawer
const MORE_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/connect", label: "Connect" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const NAV_CLASS =
  "hidden sm:flex flex-1 mx-3 items-center gap-1 text-xs sm:gap-2 sm:text-sm text-zinc-600 dark:text-zinc-300";

const BASE_LINK_CLASS =
  "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 transition-colors";

const ACTIVE_LINK_CLASS =
  "imotara-nav-active bg-zinc-900/90 text-zinc-50 shadow-sm ring-1 ring-white/25 dark:bg-zinc-100 dark:text-zinc-900";

const INACTIVE_LINK_CLASS =
  "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50";

export default function SiteHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  // Desktop ··· dropdown — separate from mobile
  const [moreOpen, setMoreOpen] = useState(false);
  // Mobile hamburger drawer — separate state to avoid mousedown race condition
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Cmd+K / Ctrl+K → search; Escape → close any open overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close desktop ··· dropdown when clicking outside its ref
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  // Close both menus on route change
  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const isMoreActive = mounted && MORE_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* Mobile backdrop — sits behind the drawer, tap it to close */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 sm:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="sticky top-0 z-40 w-full border-b border-white/12 bg-white/75 bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.16),transparent_55%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.16),transparent_55%)] backdrop-blur-xl transition-colors dark:border-zinc-800/80 dark:bg-black/70">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-zinc-900 focus:rounded"
        >
          Skip to main content
        </a>
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* LEFT: Logo / brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 transition hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            aria-label="Imotara home"
          >
            <Image
              src="/android-chrome-192.png"
              width={28}
              height={28}
              alt="Imotara"
              className="rounded-xl shadow-[0_10px_25px_rgba(15,23,42,0.8)]"
              priority
            />
            <span className="hidden sm:inline">Imotara</span>
          </Link>

          {/* CENTER: Primary navigation (desktop only) */}
          <nav className={NAV_CLASS} aria-label="Main navigation">
            {PRIMARY_LINKS.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`${BASE_LINK_CLASS} ${active ? ACTIVE_LINK_CLASS : INACTIVE_LINK_CLASS}`}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Desktop ··· dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More pages"
                aria-expanded={moreOpen}
                className={`${BASE_LINK_CLASS} ${isMoreActive ? ACTIVE_LINK_CLASS : INACTIVE_LINK_CLASS} select-none`}
              >
                ···
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-full mt-1.5 min-w-[120px] rounded-2xl border border-white/15 bg-white/80 py-1.5 shadow-lg backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/90">
                  {MORE_LINKS.map((l) => {
                    const active = pathname.startsWith(l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`block px-4 py-2 text-xs transition-colors ${
                          active
                            ? "font-semibold text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                        }`}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* RIGHT: Search + mobile hamburger */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 dark:border-zinc-700/60"
            >
              <span aria-hidden>🔍</span>
              <span className="hidden sm:inline text-[10px] opacity-60">⌘K</span>
            </button>

            {/* Mobile hamburger — sm:hidden so only appears on small screens */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 sm:hidden"
            >
              <span className="text-base leading-none">{mobileOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {/* Mobile drawer — controlled by mobileOpen, independent of desktop state */}
        {mobileOpen && (
          <div className="border-t border-white/10 bg-white/90 px-4 py-3 backdrop-blur-xl dark:bg-zinc-900/95 sm:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {[...PRIMARY_LINKS, ...MORE_LINKS].map((l) => {
                const active =
                  l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-zinc-900/10 font-semibold text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
