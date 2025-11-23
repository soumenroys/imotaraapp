// src/components/imotara/TopBar.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from "lucide-react";

import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import useSyncHistory from "@/hooks/useSyncHistory";

type TopBarProps = {
  /** Optional override for the main title on the left */
  title?: string;
  /** Show or hide the small sync status chip on the right */
  showSyncChip?: boolean;
  /** Show or hide the Conflicts button on the right */
  showConflictsButton?: boolean;
};

export default function TopBar({
  title,
  showSyncChip = true,
  showConflictsButton = true,
}: TopBarProps) {
  const pathname = usePathname();

  const isChat = pathname?.startsWith("/chat");
  const isHistory = pathname?.startsWith("/history");
  const isSettings = pathname?.startsWith("/settings");

  const effectiveTitle = title ?? "Imotara";

  // Shared sync state for the chip in the top bar
  const sync = useSyncHistory({
    intervalMs: 0,
    runOnMount: false,
  });

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        {/* Left: logo + title */}
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-xs font-bold text-slate-950 shadow-lg">
            io
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-50">
              {effectiveTitle}
            </span>
            <span className="text-[11px] text-slate-300">
              Emotion-aware companion (local-first)
            </span>
          </div>
        </div>

        {/* Center: main navigation */}
        <nav
          className="hidden items-center gap-1 rounded-full bg-white/5 p-1 text-xs text-slate-200 shadow-sm sm:flex"
          aria-label="Imotara primary navigation"
        >
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
          {/* Settings entry, aligned with Settings page */}
          <NavPill
            href="/settings"
            active={isSettings}
            icon={<SettingsIcon className="h-3.5 w-3.5" />}
          >
            Settings
          </NavPill>
        </nav>

        {/* Right: sync + conflicts */}
        <div className="flex items-center gap-2">
          {showSyncChip && (
            <div className="hidden sm:block">
              <SyncStatusChip
                state={sync.state}
                lastSyncedAt={sync.lastSyncedAt}
                pendingCount={0} // keep fixed; hook doesn't expose pending count
                conflictsCount={sync.conflicts.length}
                onSync={sync.manualSync}
              />
            </div>
          )}

          {showConflictsButton && <ConflictReviewButton />}
        </div>
      </div>
    </header>
  );
}

type NavPillProps = {
  href: string;
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

function NavPill({ href, active, icon, children }: NavPillProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 transition ${active
        ? "bg-sky-500 text-slate-950 shadow-sm"
        : "text-slate-200 hover:bg-white/10"
        }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
