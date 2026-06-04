"use client";
// src/app/org/dashboard/settings/page.tsx

import { useEffect, useState, useCallback } from "react";

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
  const [org, setOrg]         = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [name, setName]       = useState("");
  const [msg, setMsg]         = useState("");
  const [error, setError]     = useState("");

  // API Keys state
  const [apiKeys, setApiKeys]       = useState<{id:string;name:string;key_prefix:string;scopes:string[];last_used_at:string|null;created_at:string}[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);
  const [keyGenerating, setKeyGenerating] = useState(false);
  const [keyMsg, setKeyMsg]         = useState("");
  const [revoking, setRevoking]     = useState<string | null>(null);

  // Branding state
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandSaving, setBrandSaving]   = useState(false);
  const [brandMsg, setBrandMsg]         = useState("");
  const [logoUrl, setLogoUrl]           = useState("");
  const [accentColor, setAccentColor]   = useState("#4f46e5");
  const [brandName, setBrandName]       = useState("");
  const [orgTier, setOrgTier]           = useState("");

  const loadBranding = useCallback(async () => {
    try {
      const r = await fetch("/api/org/dashboard/branding", { credentials: "same-origin" });
      if (r.ok) {
        const j = await r.json();
        setLogoUrl(j.branding?.logo_url     ?? "");
        setAccentColor(j.branding?.accent_color ?? "#4f46e5");
        setBrandName(j.branding?.brand_name  ?? "");
        setOrgTier(j.tier ?? "");
      }
    } catch { /* ignore */ }
    finally { setBrandLoading(false); }
  }, []);

  const loadApiKeys = useCallback(async () => {
    try {
      const r = await fetch("/api/org/dashboard/apikeys", { credentials: "same-origin" });
      if (r.ok) setApiKeys((await r.json()).keys ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/org/dashboard/settings", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => { setOrg(j.org); setName(j.org?.name ?? ""); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    void loadBranding();
    void loadApiKeys();
  }, [loadBranding, loadApiKeys]);

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault(); setKeyGenerating(true); setKeyMsg(""); setNewKeyPlain(null);
    try {
      const r = await fetch("/api/org/dashboard/apikeys", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: ["read:stats", "read:members"] }),
      });
      const j = await r.json();
      if (!r.ok) { setKeyMsg(j.error ?? "Failed"); return; }
      setNewKeyPlain(j.key.plaintext);
      setNewKeyName("");
      void loadApiKeys();
    } finally { setKeyGenerating(false); }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    setRevoking(keyId);
    await fetch(`/api/org/dashboard/apikeys?keyId=${keyId}`, { method: "DELETE", credentials: "same-origin" });
    setRevoking(null);
    void loadApiKeys();
  }

  async function handleBrandSave(e: React.FormEvent) {
    e.preventDefault(); setBrandSaving(true); setBrandMsg(""); setError("");
    try {
      const r = await fetch("/api/org/dashboard/branding", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url:    logoUrl.trim()     || null,
          accent_color: accentColor.trim() || null,
          brand_name:  brandName.trim()  || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Save failed."); return; }
      setBrandMsg("Branding saved ✓");
      if (accentColor) document.documentElement.style.setProperty("--org-accent", accentColor);
    } finally { setBrandSaving(false); }
  }

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

      {/* API Keys — Enterprise only */}
      {org && (
        <div className={`rounded-2xl border px-5 py-5 space-y-4 border-white/8 ${org.tier !== "enterprise" ? "bg-white/4 opacity-60" : "bg-white/4"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">REST API Keys</p>
            {org.tier !== "enterprise" && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300 ring-1 ring-orange-500/20">Enterprise only</span>
            )}
          </div>
          {org.tier !== "enterprise" ? (
            <p className="text-xs text-zinc-500">API access requires Enterprise plan. Contact <a href="mailto:info@imotara.com" className="underline">info@imotara.com</a>.</p>
          ) : (
            <>
              <p className="text-xs text-zinc-500">Use API keys to access <code className="rounded bg-white/8 px-1">/api/v1/org/stats</code> and <code className="rounded bg-white/8 px-1">/api/v1/org/members</code> programmatically.</p>

              {/* Generate key */}
              <form onSubmit={handleGenerateKey} className="flex gap-2">
                <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} required placeholder="Key name e.g. HR dashboard"
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
                <button type="submit" disabled={keyGenerating}
                  className="rounded-xl bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
                  {keyGenerating ? "Generating…" : "Generate key"}
                </button>
              </form>

              {/* Show plaintext once */}
              {newKeyPlain && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-emerald-300">Copy this key now — it will never be shown again:</p>
                  <code className="block break-all rounded bg-black/30 px-3 py-2 text-xs font-mono text-emerald-200">{newKeyPlain}</code>
                </div>
              )}
              {keyMsg && <p className="text-xs text-rose-400">{keyMsg}</p>}

              {/* Key list */}
              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{k.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">{k.key_prefix}••• · {k.scopes.join(", ")}</p>
                      </div>
                      <button onClick={() => handleRevokeKey(k.id)} disabled={revoking === k.id}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40">
                        {revoking === k.id ? "…" : "Revoke"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Custom Branding — Enterprise only */}
      {(orgTier === "enterprise" || !brandLoading) && (
        <div className={`rounded-2xl border px-5 py-5 space-y-4 ${orgTier !== "enterprise" ? "border-white/8 bg-white/4 opacity-60" : "border-white/8 bg-white/4"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Custom Branding</p>
            {orgTier !== "enterprise" && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300 ring-1 ring-orange-500/20">Enterprise only</span>
            )}
          </div>
          {orgTier !== "enterprise" ? (
            <p className="text-xs text-zinc-500">Upgrade to Enterprise to add your logo, accent colour, and brand name. Contact <a href="mailto:info@imotara.com" className="underline">info@imotara.com</a>.</p>
          ) : (
            <form onSubmit={handleBrandSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Logo URL</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yourorg.com/logo.png"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Preview" className="mt-2 h-8 w-auto rounded object-contain" />
                )}
                <p className="mt-1 text-[11px] text-zinc-600">Paste a public URL to your logo (PNG/SVG, transparent background recommended)</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Brand name <span className="text-zinc-600">(replaces "Imotara" in the dashboard header)</span></label>
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Wellness"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Accent colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
                  <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#4f46e5" maxLength={7}
                    className="w-32 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
                  <span className="text-xs text-zinc-500">Applied to buttons and active states in the org dashboard</span>
                </div>
              </div>
              {error    && <p className="text-xs text-rose-400">{error}</p>}
              {brandMsg && <p className="text-xs text-emerald-400">{brandMsg}</p>}
              <button type="submit" disabled={brandSaving}
                className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
                {brandSaving ? "Saving…" : "Save branding"}
              </button>
            </form>
          )}
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
