"use client";

// src/components/imotara/MobileTabBar.tsx
// The bottom tab bar on phones (UX-23).
//
// Lifted out of TopBar, which is being retired. This is the one part of that
// component with no duplicate anywhere: SiteHeader has no bottom bar, and on a
// phone a persistent row of the four app destinations is worth more than a
// second header competing with the first.
//
// It appears on the app routes only. On marketing and legal pages it would be
// offering to navigate somewhere the visitor has not gone yet.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MessageSquare, Smile, History as HistoryIcon, Settings as SettingsIcon } from "lucide-react";
import { APP_ROUTES } from "@/lib/appRoutes";

export default function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const onAppRoute = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!onAppRoute) return null;

  const is = (r: string) => pathname === r || pathname.startsWith(`${r}/`);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-black/85 pb-safe pt-1 backdrop-blur-xl sm:hidden"
    >
      <Tab href="/chat"     active={is("/chat")}     icon={<MessageSquare className="h-5 w-5" />} label="Chat" />
      <Tab href="/feel"     active={is("/feel")}     icon={<Smile className="h-5 w-5" />}         label="Feel" />
      <Tab href="/history"  active={is("/history")}  icon={<HistoryIcon className="h-5 w-5" />}   label="History" />
      <Tab href="/settings" active={is("/settings")} icon={<SettingsIcon className="h-5 w-5" />}  label="Settings" />
    </nav>
  );
}

function Tab({ href, active, icon, label }: { href: string; active?: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
        active ? "text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
