"use client";
// src/app/org/dashboard/settings/page.tsx

import { useEffect, useState } from "react";

interface OrgSettings {
  id: string; name: string; slug: string; billing_type: string;
  tier: string; status: string; seats_purchased: number; seats_used: number;
  expires_at: string | null; created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  commercial: "Company", ngo: "NGO / NPO", edu: "Educational", govt: "Government",
};

function ReadOnlyField({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <p className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-300">{value}</p>
      {note && <p className="mt-1 text-[11px] text-zinc-600">{note}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [org, setOrg]       = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName]     = useState("");
  const [msg, setMsg]       = useState("");
  const [error, setError]   = useState("");

  useEffect(() => {
    fetch("/api/org/dashboard/settings", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => { setOrg(j.org); setName(j.org?.name ?? ""); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(""); setError("");
    try {
      const r = await fetch("/api/org/dashboard/settings", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Save failed."); return; }
      setOrg((prev) => prev ? { ...prev, name: j.org.name } : prev);
      setMsg("Saved ✓");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-white/5" />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>

      {/* Editable fields */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
        <p className="text-sm font-medium text-zinc-300">Organisation details</p>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Organisation name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {msg   && <p className="text-xs text-emerald-400">{msg}</p>}
          <button type="submit" disabled={saving || !name.trim()}
            className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      {/* Read-only plan info */}
      {org && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
          <p className="text-sm font-medium text-zinc-300">Plan details</p>
          <p className="text-[11px] text-zinc-600">
            These are managed by Imotara. Contact{" "}
            <a href="mailto:info@imotara.com" className="underline hover:text-zinc-400">info@imotara.com</a>{" "}
            to change your plan, seats, or renewal date.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ReadOnlyField label="Plan tier"        value={org.tier.charAt(0).toUpperCase() + org.tier.slice(1)} />
            <ReadOnlyField label="Organisation type" value={TYPE_LABELS[org.billing_type] ?? org.billing_type} />
            <ReadOnlyField label="Status"           value={org.status} />
            <ReadOnlyField label="Seats purchased"  value={String(org.seats_purchased)} />
            <ReadOnlyField label="Seats used"       value={String(org.seats_used)} />
            <ReadOnlyField label="Renewal date"     value={org.expires_at
              ? new Date(org.expires_at).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
              : "No expiry"} />
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-5">
        <p className="text-sm font-semibold text-rose-300">Danger zone</p>
        <p className="mt-1 text-xs text-zinc-500">To delete this organisation and remove all members, contact us directly.</p>
        <a href="mailto:info@imotara.com?subject=Delete org request"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20">
          Request deletion →
        </a>
      </div>
    </div>
  );
}
