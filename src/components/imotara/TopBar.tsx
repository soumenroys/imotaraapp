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
  title?: string;
  showSyncChip?: boolean;
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

  const sync = useSyncHistory({
    intervalMs: 0,
    runOnMount: false,
  });

  return (
    <header
      className="
        sticky top-0 z-30
        border-b border-white/10
        bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.18),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.18),transparent_60%)]
        bg-black/70
        backdrop-blur-xl
        px-4 py-2
        animate-fade-in
      "
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        {/* LEFT: Logo + title */}
        <div className="flex flex-1 items-center gap-2">
          <div
            className="
              flex h-8 w-8 items-center justify-center rounded-xl
              bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400
              text-xs font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.55)]
            "
          >
            io
          </div>

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
        <nav
          aria-label="Imotara primary navigation"
          className="
            hidden sm:flex items-center gap-1 rounded-full
            bg-white/5 px-2 py-1 shadow-sm text-xs
            text-zinc-200
          "
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
      className={[
        "inline-flex items-center gap-1 rounded-full px-3 py-1 transition",
        active
          ? "bg-indigo-500 text-black font-medium shadow-sm"
          : "text-zinc-200 hover:bg-white/10",
      ].join(" ")}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
