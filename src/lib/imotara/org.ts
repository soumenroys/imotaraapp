// src/lib/imotara/org.ts
// Phase 1B: TypeScript wrappers for org licensing DB functions.
// All functions use the service-role admin client — never called from the browser.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendOrgInviteEmail } from "@/lib/connect/mailer";

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


// ── 2B. Release Any Prior Org Membership ──────────────────────────────────────
// Call before adding a user to a new org (invite-accept, domain-join,
// admin add-by-email). assign_org_license() upserts on user_id conflict —
// silently overwriting licenses.org_id and incrementing the NEW org's
// seats_used, but never decrementing the OLD org's, and never touching the
// old org_members row. A user already occupying a paid seat in Org A could
// join Org B's link and end up "active" in both, permanently leaking a seat
// Org A keeps paying for. This releases any different active membership
// first so a user can only ever occupy one paid org seat at a time.
export async function releasePriorOrgMembership(userId: string, newOrgId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("org_id", newOrgId)
    .maybeSingle();

  if (existing?.org_id) {
    await revokeOrgLicense(userId, existing.org_id, undefined, "system", "Superseded by joining a different organisation");
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


// ── 3B. Provision Org Member ──────────────────────────────────────────────────
// Full pipeline for making someone an actually-working org member: find-or-
// create their Imotara account, add the org_members row, assign the license/
// seat, and email a working set-password link. Shared by admin member-
// provisioning (members/route.ts createAndInvite) and org creation
// (organizations/route.ts, when an owner_email is supplied at creation time).
//
// Org creation used to just set organizations.owner_user_id and send a
// generic "your org is ready" email — that column is purely a display label
// (admin_search_orgs reads it for the super-admin org list); it was never
// connected to org_members or licenses.org_id, so that "owner" had no seat,
// no license, and no nav entry to their own org dashboard despite showing up
// as "owner" everywhere in the super-admin UI. This is the one real pipeline;
// both callers should go through it instead of any partial version of it.
//
// Emails a link built from generateLink()'s token_hash + verification_type
// rather than its raw action_link — action_link is a bare, unauthenticated
// HTTP GET against Supabase's own /verify endpoint that consumes the
// one-time token on the FIRST fetch, JS or no JS. Corporate email security
// scanners (Microsoft Defender for Office 365 Safe Links, Google Workspace
// link scanning, etc.) fetch every link in an inbound email to check it —
// which silently burns the token before the real recipient ever clicks,
// so their own click lands on an already-"expired" link. Confirmed live
// against this project: a single plain fetch of a real action_link was
// enough to invalidate it for the next visit. Emailing our own
// /auth/accept?token_hash=...&type=... URL instead defeats this, because a
// scanner fetches the page's HTML but doesn't execute its client-side JS —
// only a real browser actually calls verifyOtp() and consumes the token.
export interface ProvisionedOrgMember {
  userId:         string;
  email:          string;
  role:           string;
  accountExisted: boolean;
}

export async function provisionOrgMember(
  orgId:      string,
  email:      string,
  role:       string,
  actor:      { id: string; email: string },
  redirectTo: string,
): Promise<
  | { ok: true; data: ProvisionedOrgMember }
  | { ok: false; error: string; status: number }
> {
  const admin = getSupabaseAdmin();

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  if (!org) return { ok: false, error: "org not found", status: 404 };

  const { data: users } = await admin.auth.admin.listUsers();
  let match = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  // "invite" for brand-new accounts (no password, unconfirmed). "recovery"
  // for accounts that already exist under any provider — it lets them set a
  // password for the first time without touching however they signed in
  // before (e.g. Google).
  let linkType: "invite" | "recovery" = "invite";
  let wasNewUser = false;

  if (!match) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    if (createErr || !created?.user) {
      return { ok: false, error: createErr?.message ?? "failed to create account", status: 500 };
    }
    match = created.user;
    wasNewUser = true;
  } else {
    linkType = "recovery";
  }

  const { data: existingMember } = await admin
    .from("org_members")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("user_id", match.id)
    .maybeSingle();

  if (existingMember?.status === "active") {
    return { ok: false, error: "This user is already a member of this organisation.", status: 409 };
  }

  await releasePriorOrgMembership(match.id, orgId);

  const { error: memberErr } = await admin.from("org_members").upsert({
    org_id:     orgId,
    user_id:    match.id,
    role,
    status:     "active",
    invited_by: null,
    joined_at:  new Date().toISOString(),
  }, { onConflict: "org_id,user_id" });

  if (memberErr) {
    if (wasNewUser) await admin.auth.admin.deleteUser(match.id);
    return { ok: false, error: `Failed to add member: ${memberErr.message}`, status: 500 };
  }

  const licResult = await assignOrgLicense(match.id, orgId, undefined, "imotara_admin");
  if (!licResult.ok) {
    await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", match.id);
    if (wasNewUser) await admin.auth.admin.deleteUser(match.id);
    return { ok: false, error: licResult.error, status: 409 };
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    linkType,
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    // Don't leave a member active with a seat/license consumed but no way to ever
    // log in — roll back everything this call did. If this call created the
    // auth user, remove it too so a retry doesn't get stuck treating it as a
    // pre-existing account.
    await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", match.id);
    await revokeOrgLicense(match.id, orgId, undefined, "imotara_admin");
    if (wasNewUser) await admin.auth.admin.deleteUser(match.id);
    return { ok: false, error: linkErr?.message ?? "failed to generate invite link", status: 500 };
  }

  const acceptUrl = `${redirectTo}?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=${encodeURIComponent(linkData.properties.verification_type ?? linkType)}`;

  await sendOrgInviteEmail({
    to:        email,
    orgName:   org.name,
    role,
    acceptUrl,
  });

  await admin.from("org_audit_log").insert({
    org_id:         orgId,
    actor_id:       actor.id === "legacy" ? null : actor.id,
    actor_email:    actor.email,
    actor_role:     "imotara_admin",
    action:         "member_provisioned",
    target_email:   email,
    target_user_id: match.id,
    changes:        { role },
  });

  return { ok: true, data: { userId: match.id, email, role, accountExisted: linkType === "recovery" } };
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
