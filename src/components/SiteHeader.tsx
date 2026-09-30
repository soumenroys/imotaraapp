"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import GlobalSearch from "@/components/imotara/GlobalSearch";
import { APP_ROUTES } from "@/lib/appRoutes";
import useLicense from "@/hooks/useLicense";
import { prettyTier } from "@/types/license";

// Primary nav — always visible on desktop (daily actions only)
const PRIMARY_LINKS = [
  { href: "/", label: "Home", accent: false },
  { href: "/chat", label: "Chat", accent: true },
  { href: "/history", label: "History", accent: false },
  { href: "/grow", label: "Grow", accent: true },
  { href: "/connect", label: "Connect", accent: false },
];

// Overflow nav — behind "···" on desktop / included in mobile drawer
type MoreItem =
  | { kind?: "link";  href: string; label: string; children?: never }
  | { kind:  "group"; href?: never; label: string; children: { href: string; label: string }[] };

const MORE_LINKS: MoreItem[] = [
  {
    kind: "group",
    label: "🌿 Join Imotara Movement",
    children: [
      { href: "/connect/register", label: "🤝 As Wellness Companion" },
    ],
  },
  { href: "/settings",  label: "Settings"  },
  { href: "/tutorial",  label: "Tutorial"  },
  { href: "/help",      label: "Help"      },
  { href: "/blog",      label: "Blog"      },
  { href: "/about",     label: "About"     },
  { href: "/careers",   label: "Careers"   },
  { href: "/privacy",   label: "Privacy"   },
  { href: "/terms",     label: "Terms"     },
  { href: "/admin",     label: "🔒 Admin"  },
];

const NAV_CLASS =
  "hidden sm:flex flex-1 mx-3 items-center gap-1 text-xs sm:gap-2 sm:text-sm text-zinc-600 dark:text-zinc-300";

const BASE_LINK_CLASS =
  "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 transition-colors";

const ACTIVE_LINK_CLASS =
  "imotara-nav-active im-site-active bg-zinc-900/90 text-zinc-50 shadow-sm ring-1 ring-white/25 dark:bg-zinc-100 dark:text-zinc-900";

const INACTIVE_LINK_CLASS =
  "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50";

export default function SiteHeader() {
  const pathname = usePathname();
  const onAppRoute = APP_ROUTES.some((r) => (pathname ?? "") === r || (pathname ?? "").startsWith(`${r}/`));
  const [mounted, setMounted] = useState(false);
  // Desktop ··· dropdown — separate from mobile
  const [moreOpen, setMoreOpen] = useState(false);
  // Mobile hamburger drawer — separate state to avoid mousedown race condition
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const [isMac, setIsMac] = useState(false);
  const [user, setUser] = useState<any>(null);
  // 🔑 Same hook the rest of the app uses, so the header can never disagree
  // with the plan card. It re-reads on auth change, tab focus and after a
  // purchase — see lib/imotara/licenseRefresh.ts.
  const license = useLicense();
  const [orgHref, setOrgHref] = useState<string | null>(null);
  const sbRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    setIsMac(/Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { createBrowserClient } = await import("@supabase/ssr");
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      sbRef.current = sb;
      const { data: { session } } = await sb.auth.getSession();
      setUser(session?.user ?? null);
      const { data: { subscription } } = sb.auth.onAuthStateChange((_e: any, s: any) => {
        setUser(s?.user ?? null);
      });
      sub = subscription;
    })();
    return () => { sub?.unsubscribe(); };
  }, []);

  // Org-dashboard nav entry — only shown to signed-in org members/admins.
  useEffect(() => {
    if (!user) { setOrgHref(null); return; }
    let cancelled = false;
    fetch("/api/license/status", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setOrgHref(json?.org?.orgId ? "/org/dashboard" : null); })
      .catch(() => { if (!cancelled) setOrgHref(null); });
    return () => { cancelled = true; };
  }, [user]);

  // 🔴 Mirrors settings/page.tsx's handleSignIn. The header first linked to
  // /login — WRONG: that page is the organisation email+password form ("For
  // organisation accounts set up by an Imotara admin"), not the way ordinary
  // users sign in. Reported 2026-10-01: Settings worked, the header did not.
  //
  // 🔑 `prompt: "select_account"` is NOT optional. Without it Google silently
  // reuses whichever Google account is already active in the browser, signing
  // someone into a completely different Imotara account with no visible choice
  // — a real bug that was fixed once already; do not "tidy" it away.
  const [signingIn, setSigningIn] = useState(false);
  const handleSignIn = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const sb = sbRef.current ?? (await import("@supabase/ssr")).createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const target = (pathname ?? "/chat").startsWith("/") ? (pathname ?? "/chat") : "/chat";
      const redirectTo = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(target)}`;
      await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
    } catch { setSigningIn(false); }
  }, [signingIn, pathname]);

  const handleSignOut = useCallback(async () => {
    if (sbRef.current) await sbRef.current.auth.signOut();
  }, []);

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

  const moreLinks: MoreItem[] = [
    ...(orgHref ? [{ href: orgHref, label: "🏢 Organisation" }] : []),
    ...(mounted && !user ? [{ href: "/settings", label: "🔑 Sign in" }] : []),
    ...MORE_LINKS,
  ];

  const isMoreActive = moreLinks.some((item) =>
    item.kind === "group"
      ? item.children.some((c) => pathname.startsWith(c.href))
      : item.href ? pathname.startsWith(item.href) : false
  );

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

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-zinc-900 focus:rounded"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 w-full border-b border-white/12 bg-white/75 bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.16),transparent_55%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.16),transparent_55%)] backdrop-blur-xl transition-colors dark:border-zinc-800/80 dark:bg-black/70">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* LEFT: Logo / brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 transition hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            aria-label="Imotara home"
          >
            {/* dangerouslySetInnerHTML opts this node out of React hydration entirely,
                so browser extensions that remove <img> tags don't cause warnings. */}
            <span
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html:
                '<img src="/android-chrome-192.png" width="28" height="28" alt="Imotara"' +
                ' class="rounded-xl shadow-[0_10px_25px_rgba(15,23,42,0.8)]" decoding="async" />'
              }}
            />
            <span className="hidden sm:inline">Imotara</span>
          </Link>

          {/* CENTER: Primary navigation (desktop only) */}
          <nav className={NAV_CLASS} aria-label="Main navigation">
            {/* Render nav links only after hydration to prevent structural mismatches
                caused by stale Turbopack SSR cache during development. */}
            {mounted && PRIMARY_LINKS.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              const accentInactive = l.accent
                ? "text-indigo-600 hover:bg-indigo-50/60 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-200 font-medium"
                : INACTIVE_LINK_CLASS;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`${BASE_LINK_CLASS} ${active ? ACTIVE_LINK_CLASS : accentInactive}`}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Desktop ··· dropdown */}
            {mounted && <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More pages"
                aria-expanded={moreOpen}
                className={`${BASE_LINK_CLASS} ${isMoreActive ? ACTIVE_LINK_CLASS : INACTIVE_LINK_CLASS} select-none`}
              >
                ···
              </button>

              {moreOpen && (
                <div className="absolute end-0 top-full mt-1.5 min-w-[160px] rounded-2xl border border-zinc-200 bg-white py-1.5 shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/90">
                  {moreLinks.map((item, idx) => {
                    if (item.kind === "group") {
                      return (
                        <div key={idx}>
                          <p className="px-4 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            {item.label}
                          </p>
                          {item.children.map((child) => {
                            const active = pathname.startsWith(child.href);
                            return (
                              <Link key={child.href} href={child.href}
                                className={`block ps-7 pe-4 py-1.5 text-xs transition-colors ${
                                  active ? "font-semibold text-zinc-900 dark:text-zinc-50"
                                         : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                                }`}>
                                {child.label}
                              </Link>
                            );
                          })}
                          <div className="my-1 mx-3 border-t border-zinc-100 dark:border-zinc-700/40" />
                        </div>
                      );
                    }
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link key={`${idx}-${item.href}`} href={item.href}
                        className={`block px-4 py-2 text-xs transition-colors ${
                          active ? "font-semibold text-zinc-900 dark:text-zinc-50"
                                 : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                        }`}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>}
          </nav>

          {/* RIGHT: plan + search + conflicts + sign in/out + mobile hamburger */}
          <div className="flex items-center gap-2">
            {/* Current plan — desktop, left of the search box.
                🔑 Reuses useLicense() and prettyTier() rather than mapping tiers
                here. A second mapping is how "edu" once rendered as two
                different words in two places.
                ⚠️ Hidden until `loading` clears. The hook starts from the env
                snapshot, which is `free`, so rendering early would flash "Free"
                at a Plus subscriber — the exact thing that cost 2026-09-30. */}
            {mounted && user && !license.loading && (
              <Link
                href="/settings"
                aria-label={`Your plan: ${prettyTier(license.tier)}`}
                title="Your plan"
                className={`hidden sm:inline-flex items-center rounded-full border px-3 py-1.5 text-xs transition ${
                  license.tier === "free"
                    ? "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 dark:border-zinc-700/60"
                    : "border-indigo-400/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200"
                }`}
              >
                {prettyTier(license.tier)}
              </Link>
            )}

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 dark:border-zinc-700/60"
            >
              <span aria-hidden>🔍</span>
              <span className="hidden sm:inline text-[10px] opacity-60" suppressHydrationWarning>
                {mounted ? (isMac ? "⌘K" : "Ctrl K") : ""}
              </span>
            </button>

            {/* Conflicts — was TopBar's, and the only thing it had that this
                header did not. ConflictReviewButton was already imported here
                and never rendered; it renders on app routes, where a sync
                conflict is something you can actually act on. */}
            {onAppRoute && (
              <div className="hidden sm:block h-7">
                <ConflictReviewButton />
              </div>
            )}

            {/* Sign in / Sign out — desktop only, immediately right of the
                conflict capsule.

                🔑 This slot used to render ONLY when signed in, so a signed-out
                visitor had no way into the app from the header at all — they had
                to find the capsule buried in Settings. Both states now occupy the
                same slot, so the header never silently loses a control.

                ⚠️ Both are behind `mounted`. `user` is resolved client-side from
                the Supabase session, so rendering either label during SSR would
                guess wrong half the time and hydrate into a flicker — briefly
                offering "Sign in" to someone who is already signed in. */}
            {mounted && (user ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 dark:border-zinc-700/60"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                aria-label="Sign in"
                className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 disabled:opacity-60 dark:border-zinc-700/60"
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </button>
            ))}

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
            <nav className="flex flex-col gap-0.5" aria-label="Mobile navigation">
              {/* Primary links */}
              {PRIMARY_LINKS.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                      active ? "bg-zinc-900/10 font-semibold text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
                             : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                    }`}>
                    {l.label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-white/10 dark:border-zinc-700/40" />
              {/* Overflow links + groups */}
              {moreLinks.map((item, idx) => {
                if (item.kind === "group") {
                  return (
                    <div key={idx}>
                      <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        {item.label}
                      </p>
                      {item.children.map((child) => {
                        const active = pathname.startsWith(child.href);
                        return (
                          <Link key={child.href} href={child.href} onClick={() => setMobileOpen(false)}
                            className={`rounded-xl py-2 ps-7 pe-3 text-sm transition-colors ${
                              active ? "bg-zinc-900/10 font-semibold text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
                                     : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
                            }`}>
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link key={`${idx}-${item.href}`} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                      active ? "bg-zinc-900/10 font-semibold text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
                             : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                    }`}>
                    {item.label}
                  </Link>
                );
              })}
              {/* Sign in / Sign out — mobile drawer. Mirrors the desktop slot:
                  the drawer previously offered nothing to a signed-out visitor. */}
              {mounted && (
                <>
                  <div className="my-1 border-t border-white/10 dark:border-zinc-700/40" />
                  {user ? (
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); handleSignOut(); }}
                      className="w-full rounded-xl px-3 py-2 text-start text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
                    >
                      Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); handleSignIn(); }}
                      disabled={signingIn}
                      className="w-full rounded-xl px-3 py-2 text-start text-sm text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-white/5"
                    >
                      {signingIn ? "Signing in…" : "Sign in"}
                    </button>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
