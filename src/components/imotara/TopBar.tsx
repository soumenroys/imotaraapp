// src/components/imotara/TopBar.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  History as HistoryIcon,
  Settings as SettingsIcon,
  TrendingUp,
} from "lucide-react";

import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import useSyncHistory from "@/hooks/useSyncHistory";

type TopBarProps = {
  title?: string;
  showSyncChip?: boolean;
  showConflictsButton?: boolean;
};

const HEADER_CLASS =
  "sticky top-0 z-30 border-b border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.18),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.18),transparent_60%)] bg-black/70 backdrop-blur-xl px-4 py-2 animate-fade-in";

const LOGO_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-xs font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.55)]";

const NAV_CLASS =
  "hidden sm:flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 shadow-sm text-xs text-zinc-200";

export default function TopBar({
  title,
  showSyncChip = true,
  showConflictsButton = true,
}: TopBarProps) {
  const pathname = usePathname();

  const isChat = pathname?.startsWith("/chat");
  const isHistory = pathname?.startsWith("/history");
  const isSettings = pathname?.startsWith("/settings");
  const isGrow = pathname?.startsWith("/grow");

  const effectiveTitle = title ?? "Imotara";

  const sync = useSyncHistory({
    intervalMs: 0,
    runOnMount: false,
  });

  return (
    <>
    <header className={HEADER_CLASS}>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        {/* LEFT: Logo + title */}
        <div className="flex flex-1 items-center gap-2">
          <div className={LOGO_CLASS}>io</div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-50">
              {effectiveTitle}
            </span>
            <span className="text-[11px] text-zinc-300">
              Emotion-aware companion (local-first)
            </span>
          </div>
        </div>

        {/* CENTER NAV */}
        <nav aria-label="Imotara primary navigation" className={NAV_CLASS}>
          <NavPill
            href="/chat"
            active={isChat}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          >
            Chat
          </NavPill>

          <NavPill
            href="/history"
            active={isHistory}
            icon={<HistoryIcon className="h-3.5 w-3.5" />}
          >
            History
          </NavPill>

          <NavPill
            href="/settings"
            active={isSettings}
            icon={<SettingsIcon className="h-3.5 w-3.5" />}
          >
            Settings
          </NavPill>
        </nav>

        {/* RIGHT: sync + conflicts */}
        <div className="flex items-center gap-2">
          {showSyncChip && (
            <div className="hidden sm:block">
              <SyncStatusChip
                state={sync.state}
                lastSyncedAt={sync.lastSyncedAt}
                pendingCount={0}
                conflictsCount={sync.conflicts.length}
                onSync={sync.manualSync}
              />
            </div>
          )}

          {showConflictsButton && (
            <div className="hidden sm:block h-7">
              <div className="h-7">
                <ConflictReviewButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Mobile bottom navigation — hidden on sm+ */}
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-black/85 pb-safe pt-1 backdrop-blur-xl sm:hidden"
    >
      <MobileTab href="/chat"     active={isChat}     icon={<MessageSquare className="h-5 w-5" />} label="Chat" />
      <MobileTab href="/grow"     active={isGrow}     icon={<TrendingUp className="h-5 w-5" />}    label="Grow" />
      <MobileTab href="/history"  active={isHistory}  icon={<HistoryIcon className="h-5 w-5" />}   label="History" />
      <MobileTab href="/settings" active={isSettings} icon={<SettingsIcon className="h-5 w-5" />}  label="Settings" />
    </nav>
    </>
  );
}

function MobileTab({ href, active, icon, label }: { href: string; active?: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] transition-colors ${
        active ? "text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

type NavPillProps = {
  href: string;
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

function NavPill({ href, active, icon, children }: NavPillProps) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors transition-shadow transition-transform duration-150";
  const activeClasses =
    "bg-gradient-to-r from-indigo-500 to-sky-400 text-black font-medium shadow-sm shadow-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/60 hover:-translate-y-0.5";
  const inactiveClasses =
    "text-zinc-200/90 hover:text-zinc-50 hover:bg-white/10 hover:border-white/30 border border-transparent hover:-translate-y-0.5";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${active ? activeClasses : inactiveClasses}`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
