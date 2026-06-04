"use client";
// src/app/org/dashboard/teams/page.tsx
// Classroom / Team / Department management.
// EDU orgs use this as "Classrooms", Enterprise orgs as "Teams/Departments".

import { useEffect, useState, useCallback } from "react";

interface Cohort {
  id: string; name: string; description: string | null;
  tone_policy: string; seat_limit: number | null;
  memberCount: number; created_at: string;
}
interface CohortMember { userId: string; email: string; role: string; addedAt: string }

const TONE_LABELS: Record<string, string> = {
  close_friend:  "🤝 Close Friend",
  calm_companion: "🌿 Calm Companion",
  coach:         "🎯 Coach",
  mentor:        "📚 Mentor",
};

export default function TeamsPage() {
  const [cohorts, setCohorts]       = useState<Cohort[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [members, setMembers]       = useState<CohortMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving]         = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [newTone, setNewTone]       = useState("close_friend");

  const fetchCohorts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/org/dashboard/cohorts", { credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCohorts((await r.json()).cohorts ?? []);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchCohorts(); }, [fetchCohorts]);

  async function loadMembers(cohortId: string) {
    setExpanded(cohortId); setMembersLoading(true);
    try {
      const r = await fetch(`/api/org/dashboard/cohorts/members?cohortId=${cohortId}`, { credentials: "same-origin" });
      setMembers((await r.json()).members ?? []);
    } finally { setMembersLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch("/api/org/dashboard/cohorts", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc, tone_policy: newTone }),
      });
      if (!r.ok) { setError((await r.json()).error ?? "Failed"); return; }
      setShowCreate(false); setNewName(""); setNewDesc(""); setNewTone("close_friend");
      void fetchCohorts();
    } finally { setSaving(false); }
  }

  async function handleDelete(cohortId: string) {
    if (!confirm("Delete this group? Members will not be removed from the org.")) return;
    await fetch(`/api/org/dashboard/cohorts?cohortId=${cohortId}`, { method: "DELETE", credentials: "same-origin" });
    void fetchCohorts();
    if (expanded === cohortId) setExpanded(null);
  }

  async function handleRemoveMember(cohortId: string, userId: string) {
    await fetch(`/api/org/dashboard/cohorts/members?cohortId=${cohortId}&userId=${userId}`, { method: "DELETE", credentials: "same-origin" });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    void fetchCohorts();
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Teams & Groups</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Organise members into classrooms, departments, or cohorts with a shared companion tone</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/25">
          {showCreate ? "✕ Cancel" : "+ New group"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-indigo-400/20 bg-indigo-500/5 p-5 space-y-3">
          <p className="text-sm font-medium text-indigo-200">Create group</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="block text-xs text-zinc-400 mb-1">Group name *</span>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Class 10A / Sales Team" className={inputCls} /></label>
            <label><span className="block text-xs text-zinc-400 mb-1">Default companion tone</span>
              <select value={newTone} onChange={(e) => setNewTone(e.target.value)} className={inputCls}>
                {Object.entries(TONE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
          </div>
          <label><span className="block text-xs text-zinc-400 mb-1">Description (optional)</span>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g. Year 10 students, counselling group" className={inputCls} /></label>
          <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Creating…" : "Create group"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {/* Cohort list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : cohorts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
          <p className="text-2xl">👥</p>
          <p className="mt-2 text-sm text-zinc-500">No groups yet. Create one to organise your members.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cohorts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-zinc-100">{c.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {TONE_LABELS[c.tone_policy] ?? c.tone_policy} · {c.memberCount} members
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => expanded === c.id ? setExpanded(null) : loadMembers(c.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10">
                    {expanded === c.id ? "Close" : "Members"}
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/20">
                    Delete
                  </button>
                </div>
              </div>

              {expanded === c.id && (
                <div className="border-t border-white/8 px-4 py-3">
                  {membersLoading ? (
                    <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                  ) : members.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-2">No members in this group yet. Add members from the Members tab.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {members.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2">
                          <span className="text-xs text-zinc-300 truncate">{m.email}</span>
                          <button onClick={() => handleRemoveMember(c.id, m.userId)}
                            className="ml-2 text-[11px] text-rose-400 hover:text-rose-300 transition shrink-0">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
