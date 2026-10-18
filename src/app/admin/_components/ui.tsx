"use client";

// The admin panel's shared furniture: one nav, one card, one tile, one shell.
//
// 🔴 WHY THIS EXISTS. The panel grew in two design languages. /admin uses
// white-alpha surfaces — `bg-white/5`, `border-white/8`, `rounded-2xl` — and
// the screens added later used the zinc palette — `bg-zinc-900/40`,
// `border-zinc-800`, `rounded-xl`. Side by side they read as two different
// products, which is exactly what the owner said: "some of the menus and pages
// look isolated from the main Imotara theme".
//
// ⛔ AND ZINC BACKGROUNDS ARE A TRAP BESIDES. globals.css inverts the zinc
// palette under `[data-theme="light"]`, so `bg-zinc-900` renders LIGHT on a
// light page. The admin layout now strips that attribute, which makes zinc
// safe here — but white-alpha is safe either way, and it is what the rest of
// the panel already uses. ⇒ White-alpha for surfaces, zinc for text only.

import React, { useEffect, useState } from "react";

/**
 * Which admin is looking, so the nav can hide what they may not open.
 *
 * ⚠️ Convenience only. Every route behind every tab checks the same rule
 * server-side — a hidden tab in front of an open route is a false sense of
 * security, not a security control.
 *
 * 🔑 Here rather than in each page because /admin, Activity, Crisis and the
 * five social screens all need the same answer, and three of them were
 * rendering the nav with `null` and quietly hiding Broadcast from its owner.
 */
export function useAdminRole(): string | null {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRole(d.admin?.role ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return role;
}

// ─────────────────────────────────────────────────────────────────────────────
// Where you can go
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every destination in the panel, in one list.
 *
 * 🔴 THE OWNER'S COMPLAINT, EXACTLY: "Activity, Crisis Event and Social three
 * buttons look separate than comment, license etc. — three buttons are
 * separate and other buttons/pages menus are in one panel." They were: seven
 * sections sat in a pill group and three routes hung off the end as separately
 * coloured chips, because the first seven switch state in a page and the last
 * three are their own URLs. That is an implementation detail and it was
 * showing. ⇒ One list, one panel, one appearance.
 */
export type NavKey =
  | "comments" | "licenses" | "organizations" | "connect" | "superadmins"
  | "broadcast" | "stats" | "analytics" | "crisis" | "social";

export type NavItem = {
  key: NavKey;
  icon: string;
  label: string;
  href: string;
  /** True when this is its own page rather than a section of /admin. */
  route?: boolean;
  ownerOnly?: boolean;
  /** Visible to a connect_reviewer, whose view is deliberately narrow. */
  reviewer?: boolean;
};

export const ADMIN_NAV: NavItem[] = [
  { key: "comments",      icon: "💬", label: "Comments",      href: "/admin?section=comments",      reviewer: true },
  { key: "licenses",      icon: "🔑", label: "Licenses",      href: "/admin?section=licenses" },
  { key: "organizations", icon: "🏢", label: "Organisations", href: "/admin?section=organizations" },
  { key: "connect",       icon: "🤝", label: "Connect",       href: "/admin?section=connect",       reviewer: true },
  { key: "superadmins",   icon: "👑", label: "Admins",        href: "/admin?section=superadmins" },
  { key: "broadcast",     icon: "📣", label: "Broadcast",     href: "/admin?section=broadcast",     ownerOnly: true },
  { key: "stats",         icon: "📊", label: "Dashboard",     href: "/admin?section=stats" },
  { key: "analytics",     icon: "📈", label: "Activity",      href: "/admin/analytics",      route: true },
  { key: "crisis",        icon: "🆘", label: "Crisis",        href: "/admin/crisis-events",  route: true },
  { key: "social",        icon: "📅", label: "Social",        href: "/admin/social",         route: true },
];

/**
 * What this admin may see.
 *
 * ⚠️ Hiding a tab is convenience, never a gate — every route behind one checks
 * the same rule server-side, and a hidden tab whose route is open is a false
 * sense of security, not a security control.
 */
export function navFor(role: string | null): NavItem[] {
  if (role === "connect_reviewer") return ADMIN_NAV.filter((i) => i.reviewer);
  return ADMIN_NAV.filter((i) => !i.ownerOnly || role === "owner");
}

export function AdminNav({
  current,
  role,
  onSelect,
}: {
  current: NavKey;
  role: string | null;
  /** Supplied by /admin, which switches section in place rather than navigating. */
  onSelect?: (key: NavKey) => void;
}) {
  const items = navFor(role);
  return (
    /**
     * ⚠️ WRAPS, it does not scroll sideways. Ten destinations do not fit on
     * one line at this width, and the first version scrolled — which put a
     * scrollbar under the nav and cut "Social" off at the right edge, so the
     * newest section was the one you could not see. A row that wraps shows
     * everything at every width, and on a phone three short rows beat a
     * horizontal scroll nobody discovers.
     */
    <nav aria-label="Admin sections" className="mb-6">
      <div className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
        {items.map((item) => {
          const active = item.key === current;
          const className =
            `flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition ${
              active ? "bg-white/10 font-semibold text-zinc-100" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`;
          // 🔑 A section of /admin switches in place when we are already on
          // /admin; from anywhere else it is a link to the same place. Same
          // button either way — the reader should not be able to tell which.
          if (onSelect && !item.route) {
            return (
              <button key={item.key} type="button" onClick={() => onSelect(item.key)}
                aria-current={active ? "page" : undefined} className={className}>
                <span aria-hidden>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sr-only sm:hidden">{item.label}</span>
              </button>
            );
          }
          return (
            <a key={item.key} href={item.href} aria-current={active ? "page" : undefined} className={className}>
              <span aria-hidden>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sr-only sm:hidden">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

export function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-md sm:p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>}
      {hint && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p>}
      {(title || hint) && <div className="h-3" />}
      {children}
    </section>
  );
}

const TILE_TONES = {
  indigo:  "text-indigo-300",
  amber:   "text-amber-300",
  emerald: "text-emerald-300",
  rose:    "text-rose-300",
  sky:     "text-sky-300",
  zinc:    "text-zinc-200",
} as const;

export type TileTone = keyof typeof TILE_TONES;

/**
 * A big number.
 *
 * 🔴 THE OWNER: "the big data with tiles are not hyperlinked so that anyone can
 * click on the tiles and see the details or reach the required pages." They
 * were plain divs. A number that answers "how many?" and cannot answer "which
 * ones?" makes the reader hunt for the screen that can.
 *
 * ⚠️ So a tile with somewhere to go is a real link or button, with a focus
 * ring and a cursor, and it SAYS where it goes. A tile with nowhere sensible
 * to go stays a div rather than becoming a control that does nothing — a
 * clickable-looking thing that does not respond is worse than a plain one.
 */
export function Tile({
  label,
  value,
  tone = "zinc",
  sub,
  href,
  onClick,
  goesTo,
}: {
  label: string;
  value: React.ReactNode;
  tone?: TileTone;
  sub?: string;
  href?: string;
  onClick?: () => void;
  /** What the reader will see after clicking, e.g. "the pending list". */
  goesTo?: string;
}) {
  const body = (
    <>
      <p className={`text-2xl font-bold tabular-nums ${TILE_TONES[tone]}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{sub}</p>}
      {(href || onClick) && goesTo && (
        <p className="mt-1.5 text-[11px] text-indigo-400 group-hover:text-indigo-300">{goesTo} →</p>
      )}
    </>
  );

  const shell =
    "group block w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center backdrop-blur-md transition";
  const interactive =
    "hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60";

  if (href) return <a href={href} className={`${shell} ${interactive}`}>{body}</a>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${shell} ${interactive}`}>
        {body}
      </button>
    );
  return <div className={shell}>{body}</div>;
}

const CHIP_TONES = {
  zinc:    "border-white/10 bg-white/5 text-zinc-300",
  green:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber:   "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rose:    "border-rose-500/30 bg-rose-500/10 text-rose-300",
  indigo:  "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  sky:     "border-sky-500/30 bg-sky-500/10 text-sky-300",
} as const;

export function Chip({
  children,
  tone = "zinc",
  title,
}: {
  children: React.ReactNode;
  tone?: keyof typeof CHIP_TONES;
  title?: string;
}) {
  return (
    <span title={title} className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** A question the reader might have, answered where they would ask it. */
export function Explain({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
        {q}
      </summary>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The page itself
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The frame every admin screen sits in.
 *
 * ⚠️ One width, one header, one nav, one gutter. Before this the main panel was
 * max-w-4xl, activity was max-w-5xl and the social screens were their own
 * width with no Imotara mark at all — so moving between them felt like leaving
 * the product.
 */
export function AdminShell({
  title,
  lede,
  current,
  role,
  onSelect,
  actions,
  children,
}: {
  title: string;
  lede?: string;
  current: NavKey;
  role: string | null;
  onSelect?: (key: NavKey) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* ⚠️ A plain <img>: next/image on a 32px mark behind a login buys
              nothing and makes this component await a server boundary. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/android-chrome-192.png" width={32} height={32} alt="" className="rounded-xl" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Imotara · Admin</p>
            <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
            {lede && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-zinc-500">{lede}</p>}
          </div>
        </div>
        {actions}
      </header>

      <AdminNav current={current} role={role} onSelect={onSelect} />

      {children}
    </main>
  );
}

/** The sign-out control, identical on every screen that can offer one. */
export function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
    >
      Sign out
    </button>
  );
}
