// src/lib/imotara/org.ts
// Phase 1B: TypeScript wrappers for org licensing DB functions.
// All functions use the service-role admin client — never called from the browser.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrgTierSource = "personal" | "org" | "default";
export type OrgRole       = "owner" | "admin" | "member";
export type OrgBillingType = "commercial" | "ngo" | "edu" | "govt";
export type OrgStatus      = "pending" | "active" | "suspended" | "cancelled";

export interface ResolvedUserTier {
  effectiveTier:  string;
  tierSource:     OrgTierSource;
  orgId:          string | null;
  orgName:        string | null;
  orgRole:        OrgRole | null;
  orgBillingType: OrgBillingType | null;
  expiresAt:      string | null;
  tokenBalance:   number;
  status:         string;
}

export interface OrgMember {
  userId:      string;
  email:       string;
  role:        OrgRole;
  status:      string;
  joinedAt:    string;
  lastSignIn:  string | null;
}

export interface OrgUsageStat {
  statDate:        string;
  activeUsers:     number;
  totalEvents:     number;
  avgSessionMins:  number;
}

export interface OrgSummary {
  orgId:          string;
  name:           string;
  slug:           string;
  billingType:    OrgBillingType;
  tier:           string;
  status:         OrgStatus;
  seatsPurchased: number;
  seatsUsed:      number;
  ownerEmail:     string | null;
  expiresAt:      string | null;
  createdAt:      string;
  memberCount:    number;
}

type OrgResult<T> = { ok: true; data: T } | { ok: false; error: string };


// ── 1. Resolve User Tier ──────────────────────────────────────────────────────
// Returns the effective license tier for a user — higher of personal vs org.
// Call this instead of reading `licenses` directly when you need the real tier.

export async function resolveUserTier(userId: string): Promise<OrgResult<ResolvedUserTier>> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("resolve_user_tier", { p_user_id: userId });

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      // User has no license at all — return free defaults
      return {
        ok: true,
        data: {
          effectiveTier: "free",
          tierSource:    "default",
          orgId:         null,
          orgName:       null,
          orgRole:       null,
          orgBillingType: null,
          expiresAt:     null,
          tokenBalance:  0,
          status:        "valid",
        },
      };
    }

    const row = data[0];

    // resolve_user_tier() doesn't return billing_type — fetch it separately
    // rather than modifying the RPC (avoids a manual SQL migration for what's
    // otherwise a read-only display field). Only runs when the user has an org.
    let orgBillingType: OrgBillingType | null = null;
    if (row.org_id) {
      const { data: orgRow } = await admin.from("organizations").select("billing_type").eq("id", row.org_id).single();
      orgBillingType = (orgRow?.billing_type as OrgBillingType | undefined) ?? null;
    }

    return {
      ok: true,
      data: {
        effectiveTier: row.effective_tier,
        tierSource:    row.tier_source,
        orgId:         row.org_id   ?? null,
        orgName:       row.org_name ?? null,
        orgRole:       row.org_role ?? null,
        orgBillingType,
        expiresAt:     row.expires_at ?? null,
        tokenBalance:  row.token_balance ?? 0,
        status:        row.status ?? "valid",
      },
    };
  } catch (err) {
    console.error("[resolveUserTier]", err);
    return { ok: false, error: String(err) };
  }
}


// ── 2. Assign Org License ─────────────────────────────────────────────────────
// Call this when a user accepts an org invite.
// Enforces seat limit — returns ok:false if org is full or inactive.

export async function assignOrgLicense(
  userId:    string,
  orgId:     string,
  actorId?:   string,
  actorRole?: string,
): Promise<OrgResult<void>> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc("assign_org_license", {
      p_user_id:    userId,
      p_org_id:     orgId,
      p_actor_id:   actorId   ?? null,
      p_actor_role: actorRole ?? "system",
    });

    if (error) throw new Error(error.message);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[assignOrgLicense]", err);
    return { ok: false, error: String(err) };
  }
}


// ── 3. Revoke Org License ─────────────────────────────────────────────────────
// Call this when a member is removed from an org.
// Resets their license to free and decrements org seats_used.

export async function revokeOrgLicense(
  userId:    string,
  orgId:     string,
  actorId?:   string,
  actorRole?: string,
  reason?:    string,
): Promise<OrgResult<void>> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc("revoke_org_license", {
      p_user_id:    userId,
      p_org_id:     orgId,
      p_actor_id:   actorId   ?? null,
      p_actor_role: actorRole ?? "system",
      p_reason:     reason    ?? null,
    });

    if (error) throw new Error(error.message);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[revokeOrgLicense]", err);
    return { ok: false, error: String(err) };
  }
}


// ── 4. Check Org Seat Availability ───────────────────────────────────────────
// Returns true if the org has at least one seat available.
// Call before creating an org invite to give early feedback.

export async function checkOrgSeatAvailable(orgId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("check_org_seat_available", { p_org_id: orgId });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}


// ── 5. Get Org Members ────────────────────────────────────────────────────────
// Returns active members of an org with email and role.
// Used by the org admin dashboard members tab.

export async function getOrgMembers(
  orgId: string,
  page  = 0,
  limit = 50,
): Promise<OrgResult<OrgMember[]>> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_org_members", {
      p_org_id: orgId,
      p_page:   page,
      p_limit:  limit,
    });

    if (error) throw new Error(error.message);
    return {
      ok: true,
      data: (data ?? []).map((r: any) => ({
        userId:     r.user_id,
        email:      r.email,
        role:       r.role,
        status:     r.status,
        joinedAt:   r.joined_at,
        lastSignIn: r.last_sign_in ?? null,
      })),
    };
  } catch (err) {
    console.error("[getOrgMembers]", err);
    return { ok: false, error: String(err) };
  }
}


// ── 6. Get Org Usage Stats ────────────────────────────────────────────────────
// Aggregate anonymized engagement stats for an org.
// Used by org admin dashboard analytics tab (EDU/NGO).

export async function getOrgUsageStats(
  orgId:    string,
  daysBack = 30,
): Promise<OrgResult<OrgUsageStat[]>> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_org_usage_stats", {
      p_org_id:    orgId,
      p_days_back: daysBack,
    });

    if (error) throw new Error(error.message);
    return {
      ok: true,
      data: (data ?? []).map((r: any) => ({
        statDate:       r.stat_date,
        activeUsers:    Number(r.active_users),
        totalEvents:    Number(r.total_events),
        avgSessionMins: Number(r.avg_session_mins),
      })),
    };
  } catch (err) {
    console.error("[getOrgUsageStats]", err);
    return { ok: false, error: String(err) };
  }
}


// ── 7. Admin Search Orgs ──────────────────────────────────────────────────────
// Used by Imotara super-admin /admin Organizations tab.

export async function adminSearchOrgs(
  query?:        string,
  statusFilter?: OrgStatus,
  page  = 0,
  limit = 20,
): Promise<OrgResult<OrgSummary[]>> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("admin_search_orgs", {
      search_query:  query        ?? null,
      status_filter: statusFilter ?? null,
      page_offset:   page * limit,
      page_limit:    limit,
    });

    if (error) throw new Error(error.message);
    return {
      ok: true,
      data: (data ?? []).map((r: any) => ({
        orgId:          r.org_id,
        name:           r.name,
        slug:           r.slug,
        billingType:    r.billing_type,
        tier:           r.tier,
        status:         r.status,
        seatsPurchased: r.seats_purchased,
        seatsUsed:      r.seats_used,
        ownerEmail:     r.owner_email ?? null,
        expiresAt:      r.expires_at  ?? null,
        createdAt:      r.created_at,
        memberCount:    Number(r.member_count),
      })),
    };
  } catch (err) {
    console.error("[adminSearchOrgs]", err);
    return { ok: false, error: String(err) };
  }
}
