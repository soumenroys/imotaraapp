"use client";
// src/hooks/useOrgContext.ts
// Returns the current user's org membership context.
// Reads from /api/license/status which now includes the `org` field.
// Returns null org fields for personal/free users — always safe to call.

import { useEffect, useState } from "react";
import type { OrgRole } from "@/lib/imotara/org";

export type OrgContext = {
  /** Org UUID — null if user is not in an org */
  orgId:      string | null;
  /** Human-readable org name */
  orgName:    string | null;
  /** User's role in the org */
  orgRole:    OrgRole | null;
  /** Convenience: true when role is owner or admin */
  isOrgAdmin: boolean;
  /** Convenience: true when user belongs to any org */
  isOrgMember: boolean;
  /** True while the fetch is in flight */
  loading:    boolean;
};

const DEFAULT: OrgContext = {
  orgId:       null,
  orgName:     null,
  orgRole:     null,
  isOrgAdmin:  false,
  isOrgMember: false,
  loading:     true,
};

/**
 * React hook that returns the current user's org membership context.
 *
 * - Starts with nulls (no org) while loading.
 * - Fetches /api/license/status which includes the `org` field.
 * - Falls back gracefully on error — isOrgMember stays false.
 *
 * Usage:
 *   const { isOrgAdmin, orgName, loading } = useOrgContext();
 */
export default function useOrgContext(): OrgContext {
  const [ctx, setCtx] = useState<OrgContext>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    async function fetchContext() {
      try {
        const res = await fetch("/api/license/status", {
          method:      "GET",
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const org = json?.org as { orgId: string; orgName: string; orgRole: OrgRole } | null;

        setCtx({
          orgId:       org?.orgId   ?? null,
          orgName:     org?.orgName ?? null,
          orgRole:     org?.orgRole ?? null,
          isOrgAdmin:  org?.orgRole === "owner" || org?.orgRole === "admin",
          isOrgMember: org != null,
          loading:     false,
        });
      } catch {
        if (cancelled) return;
        setCtx((prev) => ({ ...prev, loading: false }));
      }
    }

    void fetchContext();
    return () => { cancelled = true; };
  }, []);

  return ctx;
}
