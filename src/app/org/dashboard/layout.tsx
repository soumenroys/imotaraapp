"use client";
// src/app/org/dashboard/layout.tsx
// Org admin dashboard shell — sidebar nav, auth guard, role-based tab visibility.
// Entirely separate from the main consumer app layout.

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type OrgInfo = {
  orgId: string; orgName: string; orgRole: string; billingType: string;
  brandName?: string | null; accentColor?: string | null; logoUrl?: string | null;
};

const NAV_ITEMS = [
  { href: "/org/dashboard/overview",  label: "Overview",  icon: "📊", adminOnly: false },
  { href: "/org/dashboard/members",   label: "Members",   icon: "👥", adminOnly: false },
  { href: "/org/dashboard/licenses",  label: "Licenses",  icon: "🔑", adminOnly: true  },
  { href: "/org/dashboard/pool",      label: "Pool",      icon: "🎫", adminOnly: true  },
  { href: "/org/dashboard/teams",     label: "Teams",     icon: "🏫", adminOnly: true  },
  { href: "/org/dashboard/analytics", label: "Analytics", icon: "📈", adminOnly: true  },
  { href: "/org/dashboard/audit",     label: "Audit log", icon: "📋", adminOnly: true  },
  { href: "/org/dashboard/settings",  label: "Settings",  icon: "⚙️",  adminOnly: true  },
];

export default function OrgDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [org, setOrg]       = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const r    = await fetch("/api/license/status", { credentials: "same-origin" });
        const json = await r.json();
        const o    = json?.org;

        if (!o?.orgId) { router.replace("/org/new"); return; }

        // Load branding (non-blocking)
        let brandName: string | null = null;
        let accentColor: string | null = null;
        let logoUrl: string | null = null;
        try {
          const br = await fetch("/api/org/dashboard/branding", {
            credentials: "same-origin",
            headers: { "x-org-id": o.orgId },
          });
          if (br.ok) {
            const bd = await br.json();
            brandName   = bd.branding?.brand_name   ?? null;
            accentColor = bd.branding?.accent_color ?? null;
            logoUrl     = bd.branding?.logo_url     ?? null;
            if (accentColor) {
              document.documentElement.style.setProperty("--org-accent", accentColor);
            }
          }
        } catch { /* ignore */ }

        setOrg({ orgId: o.orgId, orgName: o.orgName, orgRole: o.orgRole,
                 billingType: "", brandName, accentColor, logoUrl });
        setLoading(false);
      } catch {
        router.replace("/org/new");
      }
    }
    void load();
  }, [router]);

  const isAdmin = org?.orgRole === "owner" || org?.orgRole === "admin";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="flex min-h-[80vh] gap-0">
      {/* Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col gap-1 pr-4 pt-2 sm:flex">
        {/* Org identity */}
        <div className="mb-4 rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.orgName} className="mb-2 h-8 w-auto max-w-full rounded object-contain" />
          )}
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Organisation</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{org.brandName || org.orgName}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
            org.orgRole === "owner" ? "bg-orange-500/15 text-orange-300" :
            org.orgRole === "admin" ? "bg-indigo-500/15 text-indigo-300" :
            "bg-zinc-500/10 text-zinc-400"
          }`}>
            {org.orgRole}
          </span>
        </div>

        {/* Nav links */}
        {NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/10 font-medium text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}>
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="mt-auto pt-6">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-600 transition hover:text-zinc-400">
            ← Back to Imotara
          </Link>
        </div>
      </aside>

      {/* Mobile nav strip */}
      <div className="mb-4 flex gap-1 overflow-x-auto sm:hidden">
        {NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition ${
                active ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-400 hover:bg-white/5"
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
