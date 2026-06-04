"use client";
// src/app/org/dashboard/members/page.tsx

import { useEffect, useState, useCallback } from "react";

interface Member {
  userId: string; email: string; role: string;
  status: string; joinedAt: string; lastSignIn: string | null;
}
interface Invite {
  id: string; email: string; role: string; expires_at: string; created_at: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ROLE_COLORS: Record<string, string> = {
  owner:  "text-orange-300 bg-orange-500/15",
  admin:  "text-indigo-300 bg-indigo-500/15",
  member: "text-zinc-300 bg-zinc-500/10",
};

export default function MembersPage() {
  const [members, setMembers]     = useState<Member[]>([]);
  const [invites, setInvites]     = useState<Invite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("member");
  const [inviting, setInviting]   = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [removing, setRemoving]   = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/org/dashboard/members", { credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMembers(j.members ?? []);
      setInvites(j.invites ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault(); setInviting(true); setInviteMsg(""); setError("");
    try {
      const r = await fetch("/api/org/dashboard/members", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Invite failed"); return; }
      setInviteMsg(`✓ Invite sent to ${inviteEmail}`);
      setInviteEmail(""); void fetchMembers();
    } finally { setInviting(false); }
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member? Their license will be revoked.")) return;
    setRemoving(userId);
    await fetch(`/api/org/dashboard/members?userId=${userId}`, { method: "DELETE", credentials: "same-origin" });
    setRemoving(null); void fetchMembers();
  }

  async function handleRoleChange(userId: string, role: string) {
    await fetch("/api/org/dashboard/members", {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    void fetchMembers();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Members</h1>

      {/* Invite form */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
        <p className="mb-3 text-sm font-medium text-zinc-300">Invite a member</p>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <input type="email" required placeholder="colleague@company.com"
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/50" />
          </div>
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={inviting}
            className="rounded-xl bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {inviteMsg && <p className="mt-2 text-xs text-emerald-400">{inviteMsg}</p>}
        {error      && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {/* Members list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : (
        <div className="space-y-2">
          {members.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
              <p className="text-2xl">👥</p>
              <p className="mt-2 text-sm text-zinc-500">No members yet. Invite someone above.</p>
            </div>
          )}
          {members.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{m.email}</p>
                <p className="text-[11px] text-zinc-500">joined {timeAgo(m.joinedAt)} · last seen {timeAgo(m.lastSignIn)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
                {m.role}
              </span>
              {m.role !== "owner" && (
                <div className="flex items-center gap-1">
                  <select value={m.role} onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300 outline-none">
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button onClick={() => handleRemove(m.userId)} disabled={removing === m.userId}
                    className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40">
                    {removing === m.userId ? "…" : "Remove"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Pending invites</p>
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-2.5">
                <div>
                  <p className="text-sm text-zinc-200">{inv.email}</p>
                  <p className="text-[11px] text-zinc-500">
                    {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
