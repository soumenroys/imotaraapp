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

      {/* Custom Branding — EDU and Enterprise (per licensing matrix) */}
      {(["enterprise","edu"].includes(orgTier) || !brandLoading) && (
        <div className={`rounded-2xl border px-5 py-5 space-y-4 ${!["enterprise","edu"].includes(orgTier) ? "border-white/8 bg-white/4 opacity-60" : "border-white/8 bg-white/4"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Custom Branding</p>
            {!["enterprise","edu"].includes(orgTier) && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300 ring-1 ring-orange-500/20">EDU / Enterprise only</span>
            )}
          </div>
          {!["enterprise","edu"].includes(orgTier) ? (
            <p className="text-xs text-zinc-500">Custom branding is available on EDU and Enterprise plans. Contact <a href="mailto:info@imotara.com" className="underline">info@imotara.com</a>.</p>
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

      {/* SSO / SAML — EDU and Enterprise */}
      {org && ["edu","enterprise"].includes(org.tier) && (
        <SsoSection orgTier={org.tier} />
      )}

      {/* Data Residency + LMS Embed — EDU and Enterprise */}
      {org && ["edu","enterprise"].includes(org.tier) && (
        <EmbedSection orgTier={org.tier} />
      )}

      {/* NGO Referral Codes — NGO billing_type only */}
      {org && org.billing_type === "ngo" && (
        <ReferralSection />
      )}

      {/* NGO / EDU Recognition Certificate */}
      {org && ["ngo","edu"].includes(org.billing_type) && (
        <CertificateSection orgName={org.name} orgTier={org.tier} seatsUsed={org.seats_used} />
      )}

      {/* Impact PDF report — EDU/NGO */}
      {org && ["ngo","edu"].includes(org.billing_type) && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-3">
          <p className="text-sm font-medium text-zinc-300">📄 Impact Report (Grant-ready PDF)</p>
          <p className="text-xs text-zinc-500">Download an aggregate, anonymised impact report for grant applications, CSR reporting, or donor updates.</p>
          <div className="flex flex-wrap gap-2">
            {[3,6,12].map((m) => (
              <a key={m} href={`/api/org/certificate/impact-report?months=${m}`} target="_blank" rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10">
                Last {m} month{m !== 1 ? "s" : ""} →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* NGO verification */}
      {org && org.billing_type === "ngo" && (
        <VerificationSection />
      )}

      {/* EDU: domain auto-join + academic year */}
      {org && org.billing_type === "edu" && (
        <DomainVerifySection />
      )}

      {/* Contract/SLA storage — EDU + Enterprise */}
      {org && ["edu","enterprise"].includes(org.tier) && (
        <ContractsSection />
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

// ── SSO / SAML ────────────────────────────────────────────────────────────────
function SsoSection({ orgTier }: { orgTier: string }) {
  const [saml, setSaml]     = useState<Record<string,string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [fields, setFields] = useState({ entity_id: "", sso_url: "", certificate: "", email_domain: "" });

  useEffect(() => {
    fetch("/api/org/dashboard/sso", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => {
        setSaml(j.saml);
        if (j.saml) setFields({ entity_id: j.saml.entity_id ?? "", sso_url: j.saml.sso_url ?? "", certificate: j.saml.certificate ?? "", email_domain: j.saml.email_domain ?? "" });
      }).catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg("");
    const r = await fetch("/api/org/dashboard/sso", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const j = await r.json();
    setSaving(false);
    if (r.ok) { setSaml(j.saml); setMsg("Saved — contact info@imotara.com to activate SSO for your org."); }
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">SSO / SAML</p>
        {saml?.status === "active"
          ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Active</span>
          : saml?.entity_id
            ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">Pending activation</span>
            : null}
      </div>
      <p className="text-xs text-zinc-500">Connect your IdP (Okta, Google Workspace, Azure AD) so members sign in via SSO. Save your IdP metadata below, then contact us to activate.</p>
      <form onSubmit={handleSave} className="space-y-3">
        {[
          { key: "entity_id",    label: "Entity ID / Issuer URL",     placeholder: "https://accounts.google.com/o/saml2?idpid=..." },
          { key: "sso_url",      label: "SSO URL (IdP Sign-on URL)",  placeholder: "https://sso.okta.com/app/.../sso/saml" },
          { key: "email_domain", label: "Email domain (auto-join)",   placeholder: "yourorg.com" },
        ].map(({ key, label, placeholder }) => (
          <label key={key}>
            <span className="block text-xs text-zinc-400 mb-1">{label}</span>
            <input value={(fields as Record<string,string>)[key]} onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className={inputCls} />
          </label>
        ))}
        <label>
          <span className="block text-xs text-zinc-400 mb-1">X.509 Certificate</span>
          <textarea rows={3} value={fields.certificate} onChange={(e) => setFields((p) => ({ ...p, certificate: e.target.value }))} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" className={`${inputCls} resize-none font-mono text-[11px]`} />
        </label>
        {msg && <p className="text-xs text-emerald-400">{msg}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save SSO config"}
        </button>
      </form>
    </div>
  );
}

// ── Data Residency + LMS Embed ────────────────────────────────────────────────
function EmbedSection({ orgTier }: { orgTier: string }) {
  const [embedUrl, setEmbedUrl]   = useState("");
  const [snippet, setSnippet]     = useState("");
  const [domains, setDomains]     = useState("");
  const [residency, setResidency] = useState("");
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    fetch("/api/org/dashboard/embed", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => {
        setEmbedUrl(j.embedUrl ?? "");
        setSnippet(j.iframeSnippet ?? "");
        setDomains((j.allowedDomains ?? []).join(", "));
      }).catch(() => {});
    fetch("/api/org/dashboard/settings", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => {
        const s = j.org?.org_settings as Record<string,unknown> ?? {};
        setResidency((s.data_residency as string) ?? "");
      }).catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg("");
    await fetch("/api/org/dashboard/embed", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedDomains: domains.split(",").map((d) => d.trim()).filter(Boolean), dataResidency: residency || null }) });
    setSaving(false); setMsg("Saved ✓");
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-5">
      {/* LMS Embed */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">LMS / iframe Embed</p>
        <p className="text-xs text-zinc-500">Embed the Imotara companion in Moodle, Canvas, or any LMS that supports iframes. Add your LMS domain to the allowlist below.</p>
        {embedUrl && (
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-[10px] text-zinc-500 mb-1">Embed snippet</p>
            <code className="block text-[11px] text-zinc-300 font-mono break-all leading-relaxed">{snippet}</code>
            <button onClick={handleCopy} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition">{copied ? "✓ Copied!" : "Copy snippet"}</button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <label>
          <span className="block text-xs text-zinc-400 mb-1">Allowed domains (comma-separated)</span>
          <input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="moodle.yourschool.edu, canvas.yourorg.com" className={inputCls} />
        </label>

        {/* Data Residency */}
        <div className="border-t border-white/8 pt-3">
          <p className="text-sm font-medium text-zinc-300 mb-1">Data Residency</p>
          <p className="text-xs text-zinc-500 mb-2">Set your preferred geographic region for data storage. Enforcement requires contacting Imotara support to migrate your project.</p>
          <select value={residency} onChange={(e) => setResidency(e.target.value)} className={inputCls}>
            <option value="">Default (auto)</option>
            <option value="us">United States</option>
            <option value="eu">Europe (EU)</option>
            <option value="apac">Asia Pacific</option>
            <option value="in">India</option>
          </select>
          {residency && <p className="mt-1 text-[11px] text-amber-400">Preference saved. Email info@imotara.com to request data migration to this region.</p>}
        </div>

        {msg && <p className="text-xs text-emerald-400">{msg}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

// ── NGO Referral Codes ────────────────────────────────────────────────────────
function ReferralSection() {
  const [codes, setCodes]     = useState<{id:string;code:string;description:string|null;uses_count:number;active:boolean;totalCommissionInr:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [desc, setDesc]       = useState("");
  const [revoking, setRevoking] = useState<string|null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/org/dashboard/referrals", { credentials: "same-origin" });
    if (r.ok) setCodes((await r.json()).codes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await fetch("/api/org/dashboard/referrals", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc, commission_rate: 10 }) });
    setDesc(""); setSaving(false); void load();
  }

  async function handleRevoke(codeId: string) {
    setRevoking(codeId);
    await fetch(`/api/org/dashboard/referrals?codeId=${codeId}`, { method: "DELETE", credentials: "same-origin" });
    setRevoking(null); void load();
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
      <p className="text-sm font-medium text-zinc-300">Referral Codes (Revenue Sharing)</p>
      <p className="text-xs text-zinc-500">Distribute referral codes to your beneficiaries. When someone upgrades to a paid plan using your code, Imotara shares 10% of first-year revenue with your organisation.</p>
      <form onSubmit={handleGenerate} className="flex gap-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Code label (optional)" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50" />
        <button type="submit" disabled={saving} className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50">{saving ? "…" : "Generate"}</button>
      </form>
      {loading ? <div className="h-10 animate-pulse rounded-xl bg-white/5" /> : codes.length === 0 ? (
        <p className="text-xs text-zinc-500">No codes yet. Generate one above.</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2 ${!c.active ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <code className="text-sm font-mono font-medium text-emerald-300">{c.code}</code>
                <p className="text-[11px] text-zinc-500">{c.uses_count} uses · ₹{c.totalCommissionInr} earned{c.description ? ` · ${c.description}` : ""}</p>
              </div>
              {c.active && <button onClick={() => handleRevoke(c.id)} disabled={revoking === c.id} className="text-xs text-rose-400 hover:text-rose-300 transition shrink-0">{revoking === c.id ? "…" : "Deactivate"}</button>}
              {!c.active && <span className="text-[11px] text-zinc-600 shrink-0">Inactive</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NGO / EDU Recognition Certificate ────────────────────────────────────────
function CertificateSection({ orgName, orgTier, seatsUsed }: { orgName: string; orgTier: string; seatsUsed: number }) {
  const eligible = seatsUsed >= 10;
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">🏆 Emotional Wellness Champion Certificate</p>
        {eligible
          ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Eligible</span>
          : <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] text-zinc-500">Not yet eligible</span>}
      </div>
      <p className="text-xs text-zinc-500">
        {eligible
          ? `${orgName} qualifies for the Imotara Emotional Wellness Champion certificate. Download it for use in grant applications, CSR reports, or website recognition.`
          : `Earn this certificate when you have 10+ active members and have been active for 30+ days. Currently: ${seatsUsed} member${seatsUsed !== 1 ? "s" : ""}.`}
      </p>
      {eligible && (
        <a href="/api/org/certificate" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
          Download certificate →
        </a>
      )}
    </div>
  );
}

// ── NGO Verification ──────────────────────────────────────────────────────────
function VerificationSection() {
  const [status, setStatus]   = useState<string>("loading");
  const [docUrl, setDocUrl]   = useState("");
  const [docType, setDocType] = useState("80G Certificate");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  useEffect(() => {
    fetch("/api/org/dashboard/verification", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => { setStatus(j.verificationStatus ?? "unverified"); setDocUrl(j.verificationDocUrl ?? ""); })
      .catch(() => setStatus("unverified"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg("");
    const r = await fetch("/api/org/dashboard/verification", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentUrl: docUrl, documentType: docType, notes }),
    });
    setSaving(false);
    if (r.ok) { setStatus("pending_review"); setMsg("Submitted ✓ — Imotara team will review within 48 hours."); }
    else { setMsg((await r.json().catch(() => ({}))).error ?? "Submission failed."); }
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    unverified:     { label: "Not submitted", color: "text-zinc-500 bg-zinc-500/10" },
    pending_review: { label: "Under review",  color: "text-amber-300 bg-amber-500/15" },
    verified:       { label: "Verified ✓",    color: "text-emerald-300 bg-emerald-500/15" },
  };
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.unverified;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">NGO Verification</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.color}`}>{s.label}</span>
      </div>
      <p className="text-xs text-zinc-500">Upload your NGO/NPO registration documents (80G certificate, FCRA registration, or trust deed) to get verified status and access subsidized pricing.</p>
      {status !== "verified" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
              {["80G Certificate","FCRA Registration","Trust Deed","Society Registration","CSR Certificate","Other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Document URL (paste a public Google Drive / Dropbox link)</label>
            <input required value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://drive.google.com/file/..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Registration number, validity dates..."
              className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none" />
          </div>
          {msg && <p className="text-xs text-emerald-400">{msg}</p>}
          <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── EDU Domain Verification + Academic Calendar ───────────────────────────────
function DomainVerifySection() {
  const [domains, setDomains]       = useState<string[]>([]);
  const [autoJoin, setAutoJoin]     = useState(false);
  const [newDomain, setNewDomain]   = useState("");
  const [yearStart, setYearStart]   = useState("08-01");
  const [yearEnd, setYearEnd]       = useState("07-31");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    fetch("/api/org/dashboard/domain-verify", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => {
        setDomains(j.allowedDomains ?? []);
        setAutoJoin(j.autoJoinEnabled ?? false);
        if (j.academicYearStart) setYearStart(j.academicYearStart);
        if (j.academicYearEnd)   setYearEnd(j.academicYearEnd);
      }).catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg("");
    await fetch("/api/org/dashboard/domain-verify", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedDomains: domains, autoJoinEnabled: autoJoin, academicYearStart: yearStart, academicYearEnd: yearEnd }),
    });
    setSaving(false); setMsg("Saved ✓");
  }

  const inputCls = "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
      <p className="text-sm font-medium text-zinc-300">EDU Domain Settings + Academic Calendar</p>
      <p className="text-xs text-zinc-500">Configure allowed email domains for student auto-join, and set your academic year billing cycle.</p>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Allowed email domains (students auto-join on invite)</label>
          <div className="flex gap-2 mb-2">
            <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="university.edu"
              className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => { if (newDomain.trim()) { setDomains((p) => [...p, newDomain.trim().toLowerCase()]); setNewDomain(""); } }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">+ Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => (
              <span key={d} className="flex items-center gap-1 rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[11px] text-teal-300">
                {d}
                <button type="button" onClick={() => setDomains((p) => p.filter((x) => x !== d))} className="hover:text-rose-400 transition">✕</button>
              </span>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoJoin} onChange={(e) => setAutoJoin(e.target.checked)} className="rounded" />
          <span className="text-xs text-zinc-300">Auto-approve users whose email domain matches (no explicit invite needed)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Academic year start (MM-DD)</label>
            <input value={yearStart} onChange={(e) => setYearStart(e.target.value)} placeholder="08-01" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Academic year end (MM-DD)</label>
            <input value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} placeholder="07-31" className={`${inputCls} w-full`} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-600">Academic year dates are used for renewal reminders and billing cycle reference.</p>
        {msg && <p className="text-xs text-emerald-400">{msg}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save domain settings"}
        </button>
      </form>
    </div>
  );
}

// file_url is stored free-text and rendered as a raw <a href>; a javascript:
// or data: URI from a privileged org-admin actor (or stale bad data) would
// otherwise execute in every viewer's session. Only allow http(s) links.
function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Contract / SLA Storage ────────────────────────────────────────────────────
function ContractsSection() {
  interface Contract { id: string; label: string; type: string; file_url: string; signed_at: string | null; valid_until: string | null; created_at: string }
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [label, setLabel]         = useState("");
  const [type, setType]           = useState("MSA");
  const [url, setUrl]             = useState("");
  const [signedAt, setSignedAt]   = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/org/dashboard/contracts", { credentials: "same-origin" });
    if (r.ok) setContracts((await r.json()).contracts ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const r = await fetch("/api/org/dashboard/contracts", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, type, file_url: url, signed_at: signedAt || null, valid_until: validUntil || null }),
    });
    setSaving(false);
    if (r.ok) { setMsg("Contract added ✓"); setLabel(""); setUrl(""); void load(); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/org/dashboard/contracts?contractId=${id}`, { method: "DELETE", credentials: "same-origin" });
    void load();
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
      <p className="text-sm font-medium text-zinc-300">📋 Contracts & SLAs</p>
      <p className="text-xs text-zinc-500">Store links to signed agreements, SLAs, and compliance documents for this organisation.</p>
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contract label" className={inputCls} />
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {["MSA","SLA","NDA","DPA","MoU","PO","Other"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Document URL" className={`${inputCls} col-span-2`} />
          <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} placeholder="Signed date" className={inputCls} />
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} placeholder="Valid until" className={inputCls} />
        </div>
        {msg && <p className="text-xs text-emerald-400">{msg}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Adding…" : "Add contract"}
        </button>
      </form>
      {contracts.length > 0 && (
        <div className="space-y-1.5">
          {contracts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200">{c.label}</p>
                <p className="text-[10px] text-zinc-500">{c.type}{c.valid_until ? ` · valid until ${new Date(c.valid_until).toLocaleDateString("en-GB")}` : ""}</p>
              </div>
              {isSafeHttpUrl(c.file_url) && (
                <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-400 hover:text-indigo-300">View</a>
              )}
              <button onClick={() => handleDelete(c.id)} className="text-[11px] text-rose-400 hover:text-rose-300">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

