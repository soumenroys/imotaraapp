"use client";
// src/app/org/dashboard/members/page.tsx

import { useEffect, useState, useCallback, useRef } from "react";

interface Member {
  userId: string; email: string; role: string;
  status: string; joinedAt: string; lastSignIn: string | null;
}
interface Invite {
  id: string; email: string; role: string; expires_at: string; created_at: string;
}

// ── CSV types ──────────────────────────────────────────────────────────────────
interface CsvRow    { email: string; role: string; _valid: boolean; _error?: string }
interface BulkResult { email: string; role: string; status: "invited"|"skipped"|"error"; reason?: string }
interface BulkSummary { total: number; invited: number; skipped: number; errors: number }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header row
  const firstLower = lines[0].toLowerCase();
  const hasHeader  = firstLower.includes("email");
  const dataLines  = hasHeader ? lines.slice(1) : lines;

  // Find column indices from header (or assume email=0, role=1)
  let emailIdx = 0, roleIdx = 1;
  if (hasHeader) {
    const cols = firstLower.split(",").map((c) => c.trim().replace(/"/g, ""));
    emailIdx = cols.findIndex((c) => c === "email");
    roleIdx  = cols.findIndex((c) => c === "role");
    if (emailIdx < 0) emailIdx = 0;
    if (roleIdx  < 0) roleIdx  = 1;
  }

  return dataLines.map((line) => {
    const cols  = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = (cols[emailIdx] ?? "").toLowerCase().trim();
    const role  = cols[roleIdx] === "admin" ? "admin" : "member";
    const valid = EMAIL_RE.test(email);
    return { email, role, _valid: valid, _error: valid ? undefined : "Invalid email" };
  });
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

  // — CSV bulk import state
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows]     = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [dragging, setDragging]   = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);
  const [showCsv, setShowCsv]     = useState(false);

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

  function handleCsvFile(file: File) {
    if (!file) return;
    setCsvFileName(file.name);
    setBulkResults(null); setBulkSummary(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvRows(parseCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleBulkSend() {
    const valid = csvRows.filter((r) => r._valid);
    if (valid.length === 0) return;
    setBulkSending(true); setBulkResults(null); setBulkSummary(null);
    try {
      const r = await fetch("/api/org/dashboard/members/bulk", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: valid.map(({ email, role }) => ({ email, role })) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Bulk invite failed."); return; }
      setBulkResults(j.results);
      setBulkSummary(j.summary);
      setCsvRows([]); setCsvFileName("");
      void fetchMembers();
    } finally { setBulkSending(false); }
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

      {/* Bulk CSV import */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
        <button onClick={() => { setShowCsv((v) => !v); setBulkResults(null); }}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-300">
          <span>📋 Bulk import via CSV</span>
          <span className="text-zinc-600">{showCsv ? "▲" : "▼"}</span>
        </button>

        {showCsv && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-zinc-500">
              CSV must have an <code className="rounded bg-white/8 px-1">email</code> column.
              Optional <code className="rounded bg-white/8 px-1">role</code> column (member/admin).
              Max 500 rows per batch.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleCsvFile(file);
              }}
              className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                dragging ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/15 bg-white/3 hover:border-white/25"
              }`}
            >
              <p className="text-2xl">📂</p>
              <p className="mt-2 text-sm text-zinc-300">
                {csvFileName ? csvFileName : "Drop a CSV file here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Accepted: .csv, .txt</p>
            </div>
            <input
              ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
            />

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/8">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
                  <p className="text-xs font-medium text-zinc-400">
                    {csvRows.filter((r) => r._valid).length} valid · {csvRows.filter((r) => !r._valid).length} invalid
                    {" "}of {csvRows.length} rows
                  </p>
                  <button onClick={() => { setCsvRows([]); setCsvFileName(""); }}
                    className="text-xs text-zinc-600 hover:text-zinc-400">Clear</button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-900/90">
                      <tr className="border-b border-white/8 text-zinc-500">
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Role</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className={`border-b border-white/5 ${!row._valid ? "opacity-50" : ""}`}>
                          <td className="px-4 py-1.5 font-mono text-zinc-300">{row.email || "—"}</td>
                          <td className="px-4 py-1.5 text-zinc-400">{row.role}</td>
                          <td className="px-4 py-1.5">
                            {row._valid
                              ? <span className="text-emerald-400">✓ valid</span>
                              : <span className="text-rose-400">✗ {row._error}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-white/8 px-4 py-3">
                  <button onClick={handleBulkSend} disabled={bulkSending || csvRows.filter((r) => r._valid).length === 0}
                    className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
                    {bulkSending
                      ? "Sending…"
                      : `Send ${csvRows.filter((r) => r._valid).length} invites`}
                  </button>
                </div>
              </div>
            )}

            {/* Results after send */}
            {bulkSummary && (
              <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 space-y-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-emerald-400">✓ {bulkSummary.invited} invited</span>
                  <span className="text-amber-400">⟳ {bulkSummary.skipped} skipped</span>
                  {bulkSummary.errors > 0 && <span className="text-rose-400">✗ {bulkSummary.errors} errors</span>}
                </div>
                {bulkResults && bulkResults.filter((r) => r.status !== "invited").length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg bg-black/20 p-2">
                    {bulkResults.filter((r) => r.status !== "invited").map((r, i) => (
                      <p key={i} className={`text-xs ${r.status === "error" ? "text-rose-400" : "text-amber-400"}`}>
                        {r.email} — {r.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
