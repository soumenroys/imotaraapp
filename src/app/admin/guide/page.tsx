"use client";
// src/app/admin/guide/page.tsx
// Comprehensive licensing policy + admin tutorial — publicly accessible (no auth)
// Covers: licensing tiers, super-admin guide, org admin guide, step-by-step flows

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "policy" | "superadmin" | "orgadmin" | "faq";

// ── Screen mock component ─────────────────────────────────────────────────────

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/80 shadow-xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-800/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-rose-500/70" />
          <div className="h-3 w-3 rounded-full bg-amber-500/70" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
        </div>
        <span className="ml-2 text-[11px] text-zinc-400 font-mono">{title}</span>
      </div>
      <div className="p-4 text-sm">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-400/30 text-sm font-bold text-indigo-300">{n}</div>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-100 mb-1">{title}</p>
        <div className="text-sm text-zinc-400 space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${color}`}>{children}</span>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8 my-4">
      <table className="w-full text-xs">
        <thead className="bg-white/5 border-b border-white/8">
          <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2.5 text-left font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/3">
              {row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-zinc-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-4 text-xl font-bold text-zinc-100 flex items-center gap-2">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-3 text-base font-semibold text-zinc-200">{children}</h3>;
}
function Note({ children }: { children: React.ReactNode }) {
  return <div className="my-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-200">{children}</div>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return <div className="my-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-xs text-emerald-200">{children}</div>;
}

// ── Sections ──────────────────────────────────────────────────────────────────

function PolicySection() {
  return (
    <div>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">
        Imotara uses a tiered licensing model serving individual users, teams, NGOs, schools, and enterprises.
        All features operate on a <strong className="text-zinc-200">soft-launch basis</strong> (LICENSE_MODE=off) —
        every user currently gets full access. When licensing enforcement is turned on, the tiers below apply.
      </p>

      <H2>🏷️ License Tiers</H2>
      <Table
        headers={["Tier", "Price", "Daily Replies", "History", "Features"]}
        rows={[
          [<Badge color="text-zinc-400 bg-zinc-500/20">Free</Badge>, "₹0 / $0", "20 / day", "7 days", "Basic chat, local storage, 1 companion tone"],
          [<Badge color="text-sky-300 bg-sky-500/20">Plus</Badge>, "₹99/mo", "Unlimited", "90 days", "Cloud sync, export, Azure TTS, all tones"],
          [<Badge color="text-indigo-300 bg-indigo-500/20">Pro</Badge>, "₹149/mo", "Unlimited", "Unlimited", "Insights, growth arc, companion letters"],
          [<Badge color="text-violet-300 bg-violet-500/20">Family</Badge>, "Custom", "Unlimited", "Unlimited", "Up to 6 profiles, child-safe mode"],
          [<Badge color="text-teal-300 bg-teal-500/20">EDU</Badge>, "Custom", "Unlimited", "Unlimited", "Org dashboard, anonymised analytics, LMS embed"],
          [<Badge color="text-orange-300 bg-orange-500/20">Enterprise</Badge>, "Custom", "Unlimited", "Unlimited", "Full org suite, API keys, custom branding, SSO"],
        ]}
      />

      <H2>🏢 Organisational Licensing</H2>
      <p className="text-sm text-zinc-400 mb-4">Corporate, NGO, EDU, and Government organisations get a dedicated org account managed by their own admins.</p>

      <H3>Billing Types and Discounts</H3>
      <Table
        headers={["Org Type", "Billing Type", "Stripe Discount", "Tier Assigned", "Use Case"]}
        rows={[
          ["Company", "commercial", "Full price", "Enterprise", "HR wellness, mental health platforms"],
          ["NGO / NPO", "ngo", "60% off", "Enterprise", "Community welfare, rural wellness"],
          ["Educational", "edu", "50% off", "EDU", "Schools, colleges, counselling centres"],
          ["Government", "govt", "Full price", "Enterprise", "Public sector programmes"],
        ]}
      />

      <H2>⚡ License Priority Chain</H2>
      <p className="text-sm text-zinc-400 mb-3">When resolving a user&apos;s effective tier, the system uses this priority order:</p>
      <div className="space-y-2 my-4">
        {[
          ["1 (Highest)", "Pool assignment", "Specific license from org&apos;s issued pool (e.g. Pro from a 50-seat Pro pool)", "text-orange-300 bg-orange-500/15"],
          ["2", "Org override", "Admin manually set a different tier for this specific member", "text-amber-300 bg-amber-500/15"],
          ["3", "Personal license", "User&apos;s own purchased Razorpay/Apple/Stripe subscription", "text-sky-300 bg-sky-500/15"],
          ["4", "Org tier", "The org-wide default tier (e.g. all Enterprise members)", "text-indigo-300 bg-indigo-500/15"],
          ["5 (Lowest)", "Free", "Default when none of the above apply", "text-zinc-400 bg-zinc-500/15"],
        ].map(([priority, source, desc, colors]) => (
          <div key={source as string} className={`flex gap-3 rounded-xl px-4 py-3 border border-white/8 ${(colors as string).split(" ")[1]}`}>
            <span className={`font-mono text-[10px] font-bold ${(colors as string).split(" ")[0]} shrink-0 mt-0.5`}>{priority as string}</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{source as string}</p>
              <p className="text-xs text-zinc-500" dangerouslySetInnerHTML={{ __html: desc as string }} />
            </div>
          </div>
        ))}
      </div>

      <H2>💳 Payment Gateways</H2>
      <Table
        headers={["Gateway", "Currencies", "Use Case", "Invoice"]}
        rows={[
          ["Razorpay", "INR", "Indian individual users (UPI, cards, netbanking)", "Auto-generated"],
          ["Apple IAP", "Local currency", "iOS App Store purchases worldwide", "Auto-generated"],
          ["Google Play", "Local currency", "Android Play Store purchases worldwide", "Auto-generated"],
          ["Stripe", "USD / any", "International users, corporate seat purchases", "Auto-generated"],
        ]}
      />

      <H2>🔑 Token Packs</H2>
      <p className="text-sm text-zinc-400 mb-3">Free users get 20 cloud replies/day. Token packs extend capacity and never expire.</p>
      <Table
        headers={["Pack", "Tokens", "INR Price", "USD ~"]}
        rows={[
          ["Starter", "100", "₹49", "~$0.60"],
          ["Standard", "250", "₹99", "~$1.20"],
          ["Value", "600", "₹199", "~$2.40"],
          ["Pro Pack", "1,800", "₹499", "~$6.00"],
        ]}
      />
    </div>
  );
}

function SuperAdminSection() {
  return (
    <div>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">
        Super-admins manage the entire Imotara platform — all organisations, all licenses, all users.
        There are two roles: <strong className="text-zinc-200">Owner</strong> (can manage other super-admins)
        and <strong className="text-zinc-200">Admin</strong> (full platform access, cannot manage super-admins).
      </p>

      <H2>🔐 Logging In</H2>
      <Step n={1} title="Go to /admin in your browser">
        <p>Navigate to <code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-200">https://imotara.com/admin</code></p>
      </Step>
      <Step n={2} title='Select "Email / Password" tab'>
        <p>The login screen shows two tabs: <strong className="text-zinc-300">Email / Password</strong> (preferred) and <strong className="text-zinc-300">Secret key</strong> (legacy emergency fallback).</p>
        <Screen title="imotara.com/admin — Login">
          <div className="space-y-2 max-w-xs mx-auto">
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-[11px]">
              <div className="flex-1 rounded-md bg-white/10 py-1 text-center text-zinc-100">📧 Email / Password</div>
              <div className="flex-1 py-1 text-center text-zinc-500">🔑 Secret key</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-500">admin@imotara.com</div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-500">••••••••••••</div>
            <div className="rounded-lg bg-indigo-600 py-2 text-center text-xs font-semibold text-white">Sign in</div>
            <div className="text-center text-[10px] text-zinc-600">Forgot password?</div>
          </div>
        </Screen>
      </Step>
      <Step n={3} title="Enter your email and password">
        <p>Password requirements: 12+ characters · 1 uppercase · 1 number · 1 special character (!@#$%)</p>
        <p>Accounts lock for 15 minutes after 5 failed attempts.</p>
      </Step>

      <Note>🔑 <strong>Forgot password?</strong> Click "Forgot password?" → enter your email → check inbox for a 15-minute reset link. The link takes you directly to the password reset form.</Note>

      <H2>📊 Admin Dashboard (Stats Tab)</H2>
      <p className="text-sm text-zinc-400 mb-3">After login, click <strong className="text-zinc-200">📊 Dashboard</strong> tab to see aggregate platform statistics.</p>
      <Screen title="/admin → 📊 Dashboard">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[["0","Total orgs"],["0","Total members"],["0","Pool issued"],["0","Assigned"]].map(([v,l]) => (
            <div key={l} className="rounded-lg bg-white/5 p-2 text-center">
              <div className="text-lg font-bold text-indigo-300">{v}</div>
              <div className="text-[9px] text-zinc-500">{l}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white/5 p-2 text-[10px] text-zinc-500 text-center">Per-org breakdown table appears here</div>
      </Screen>
      <p className="text-sm text-zinc-400">Shows: total orgs by status, total members, pool licenses issued vs assigned, per-org seat usage, recent audit events.</p>

      <H2>🏢 Managing Organizations</H2>
      <p className="text-sm text-zinc-400 mb-3">Click <strong className="text-zinc-200">🏢 Organizations</strong> tab to manage all corporate, NGO, and EDU accounts.</p>

      <H3>Creating an Organisation</H3>
      <Step n={1} title='Click "+ New Org" button'>
        <p>Opens a form with fields: Name, Slug, Type (commercial/ngo/edu/govt), Tier (edu/enterprise), Status (pending/active), Seats, Expiry, Internal notes, Owner email.</p>
      </Step>
      <Step n={2} title="Fill in organisation details">
        <Screen title="/admin → 🏢 Organizations → Create Org">
          <div className="space-y-1.5 max-w-sm">
            {[["Name *","Acme Wellness Pvt Ltd"],["Slug *","acme-wellness"],["Owner email","admin@acmewellness.in"]].map(([l,p]) => (
              <div key={l}><div className="text-[9px] text-zinc-500 mb-0.5">{l}</div>
              <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400">{p}</div></div>
            ))}
            <div className="grid grid-cols-3 gap-1">
              {[["Type","commercial"],["Tier","enterprise"],["Status","pending"]].map(([l,v]) => (
                <div key={l}><div className="text-[9px] text-zinc-500 mb-0.5">{l}</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400">{v}</div></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[["Seats","100"],["Expires","2027-06-01"]].map(([l,v]) => (
                <div key={l}><div className="text-[9px] text-zinc-500 mb-0.5">{l}</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400">{v}</div></div>
              ))}
            </div>
            <div className="rounded bg-indigo-500/80 px-3 py-1.5 text-center text-[10px] font-semibold text-white">Create</div>
          </div>
        </Screen>
      </Step>
      <Step n={3} title='Set Status to "active" to activate'>
        <p>New orgs start as <code className="bg-white/10 px-1 rounded text-amber-300">pending</code>. Change to <code className="bg-white/10 px-1 rounded text-emerald-300">active</code> to grant access. All existing members get licenses automatically.</p>
      </Step>

      <H3>Managing Org Members from Admin Panel</H3>
      <Step n={1} title="Expand an org → click 'Manage members + licenses'">
        <p>Shows all members with email, role dropdown, and license tier override dropdown.</p>
      </Step>
      <Step n={2} title="Change a member's role or license tier">
        <Screen title="/admin → Organizations → [Org] → Manage members">
          <div className="space-y-1">
            {[["john@corp.com","admin","enterprise (org default)"],["jane@corp.com","member","pro (override)"]].map(([email,role,tier]) => (
              <div key={email} className="flex items-center gap-2 rounded bg-white/3 px-2 py-1.5 text-[10px]">
                <span className="flex-1 text-zinc-300 truncate">{email}</span>
                <span className="rounded bg-indigo-500/15 px-1.5 text-indigo-300">{role}</span>
                <span className="rounded bg-white/8 px-1.5 text-zinc-400 text-[9px]">{tier}</span>
              </div>
            ))}
          </div>
        </Screen>
      </Step>

      <H2>🎫 Issuing License Pools</H2>
      <p className="text-sm text-zinc-400 mb-3">License pools let org admins distribute specific tiers (e.g. 50 Pro licenses) to individual members. Issued by super-admins per org.</p>
      <Step n={1} title="Expand an org → click 'Manage license pools'">
        <p>Opens the pool management panel below the org edit form.</p>
      </Step>
      <Step n={2} title="Issue a pool — select tier, quantity, label, and expiry">
        <Screen title="/admin → Organizations → [Org] → Manage license pools">
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 space-y-1.5">
            <div className="text-[10px] font-semibold text-amber-300">Issue license pool</div>
            <div className="flex gap-1">
              <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400 flex-1">pro</div>
              <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400 w-16">50</div>
              <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-400 flex-1">Annual Batch 2026</div>
            </div>
            <div className="rounded bg-amber-500/80 px-3 py-1 text-center text-[10px] font-semibold text-white">Issue pool</div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 rounded bg-white/3 px-2 py-1.5 text-[10px]">
              <span className="text-indigo-300 font-semibold">pro</span>
              <div className="flex-1 h-1.5 bg-white/8 rounded overflow-hidden"><div className="h-full bg-indigo-400/60 rounded" style={{width:"40%"}}/></div>
              <span className="text-zinc-500">20/50 assigned · 30 free</span>
            </div>
          </div>
        </Screen>
      </Step>
      <Tip>✅ Best practice: Issue pools AFTER the org is activated. Match pool size to seats_purchased.</Tip>

      <H2>👑 Managing Super-Admins</H2>
      <p className="text-sm text-zinc-400 mb-3">Only <strong className="text-zinc-200">Owner</strong> role can manage super-admins. Click <strong className="text-zinc-200">👑 Super Admins</strong> tab.</p>

      <H3>Adding a Super-Admin</H3>
      <Step n={1} title="Fill name, email, password, and role in the Add form">
        <p>Password: 12+ chars · 1 uppercase · 1 number · 1 special char. A strength indicator shows requirements as you type.</p>
        <p>Roles: <Badge color="text-amber-300 bg-amber-500/15">Owner</Badge> = full access + manage admins · <Badge color="text-indigo-300 bg-indigo-500/15">Admin</Badge> = full access only</p>
      </Step>
      <Step n={2} title='Click "Add admin"'>
        <p>New admin can immediately log in at <code className="bg-white/10 px-1 rounded text-zinc-300">/admin</code> with their email and password.</p>
      </Step>

      <H3>Security Actions</H3>
      <Table
        headers={["Action", "When to use", "How"]}
        rows={[
          ["Reset password", "Admin forgot password / security reset", "Click Reset pwd → enter new password (12+ chars)"],
          ["Unlock account", "Admin locked after 5 wrong attempts", "Click Unlock button on their row"],
          ["Deactivate", "Admin leaves team / security breach", "Click Deactivate (cannot deactivate yourself)"],
          ["View sessions", "Audit active logins / force logout everywhere", "Click View sessions → see IP + device + revoke buttons"],
          ["Revoke all sessions", "Security incident — force logout everywhere", "Sessions panel → Revoke all other sessions"],
        ]}
      />
    </div>
  );
}

function OrgAdminSection() {
  return (
    <div>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">
        Org admins (Owner and Admin roles) manage their own organisation at <code className="bg-white/10 px-1.5 rounded text-zinc-200">/org/dashboard</code>.
        They use their normal Imotara Google/GitHub account — no separate admin password needed.
      </p>

      <H2>🚀 Accessing the Org Dashboard</H2>
      <Step n={1} title="Sign in with your Google or GitHub account at imotara.com">
        <p>Use the same account that was set as the org owner when the organisation was created.</p>
      </Step>
      <Step n={2} title="Navigate to /org/dashboard">
        <p>You are automatically redirected there after sign-in if you&apos;re an org admin. Or go directly: <code className="bg-white/10 px-1 rounded text-zinc-300">imotara.com/org/dashboard</code></p>
      </Step>
      <Screen title="imotara.com/org/dashboard">
        <div className="flex gap-3">
          <div className="w-36 shrink-0 space-y-1 text-[10px]">
            {[["📊","Overview"],["👥","Members"],["🔑","Licenses"],["🎫","Pool"],["🏫","Teams"],["📈","Analytics"],["📋","Audit log"],["⚙️","Settings"]].map(([i,l]) => (
              <div key={l} className={`flex items-center gap-1.5 rounded px-2 py-1 ${l==="Overview"?"bg-white/10 text-zinc-100":"text-zinc-400"}`}>
                <span>{i}</span><span>{l}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 bg-white/3 rounded p-3 text-[10px] text-zinc-500 text-center flex items-center justify-center">
            Dashboard content area
          </div>
        </div>
      </Screen>

      <H2>📊 Overview Tab</H2>
      <p className="text-sm text-zinc-400 mb-3">Shows seat usage, member breakdown by role, weekly active users, and quick action buttons.</p>
      <Screen title="/org/dashboard/overview">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[["12","Members","text-indigo-300"],["100","Seats","text-sky-300"],["3","Pending invites","text-amber-300"],["8","WAU","text-emerald-300"]].map(([v,l,c]) => (
            <div key={l} className="rounded bg-white/5 p-2 text-center">
              <div className={`text-base font-bold ${c}`}>{v}</div>
              <div className="text-[9px] text-zinc-500">{l}</div>
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-1"><div className="h-full w-12 bg-emerald-400 rounded-full"/></div>
        <div className="text-[9px] text-zinc-600">12 / 100 seats used · 88 available</div>
      </Screen>

      <H2>👥 Members Tab — Inviting & Managing</H2>

      <H3>Inviting Members</H3>
      <Step n={1} title="Go to Members tab → enter email in invite form">
        <Screen title="/org/dashboard/members — Invite">
          <div className="flex gap-2 items-end">
            <div className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-500">colleague@company.com</div>
            <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-400">member ▾</div>
            <div className="rounded bg-indigo-500/80 px-3 py-1.5 text-[10px] font-semibold text-white">Send invite</div>
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Member receives email with an invite link (valid 7 days)">
        <p>They click the link, sign in with their account, and join the org automatically. Their license tier is upgraded to the org&apos;s tier.</p>
      </Step>

      <H3>Bulk Invite via CSV</H3>
      <Step n={1} title='Open "Bulk import via CSV" section → upload file'>
        <p>CSV format: <code className="bg-white/10 px-1 rounded text-zinc-300">email,role</code> (header row optional). Role defaults to &quot;member&quot; if not specified.</p>
        <Screen title="/org/dashboard/members — Bulk import">
          <div className="border-2 border-dashed border-white/15 rounded-lg p-4 text-center text-[10px] text-zinc-500">
            📂 Drop CSV here or click to browse<br/>
            <span className="text-[9px]">Accepted: .csv · Max 500 rows</span>
          </div>
          <div className="mt-2 space-y-0.5">
            {[["john@corp.com","member","✓ valid"],["jane@corp.com","admin","✓ valid"],["bad-email","member","✗ Invalid email"]].map(([e,r,s]) => (
              <div key={e} className="flex gap-2 text-[9px] rounded bg-white/3 px-2 py-1">
                <span className="flex-1 font-mono text-zinc-300">{e}</span>
                <span className="text-zinc-500">{r}</span>
                <span className={s.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}>{s}</span>
              </div>
            ))}
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Preview emails → click Send invites">
        <p>Valid emails get invite emails. Already-members and invalid emails are skipped with reasons shown.</p>
      </Step>

      <H3>Changing Member Roles</H3>
      <p className="text-sm text-zinc-400 mb-2">In the member list, use the role dropdown to promote/demote:</p>
      <Table
        headers={["Role", "Can do"]}
        rows={[
          ["owner", "Everything + transfer ownership (set at org creation, 1 per org)"],
          ["admin", "Invite/remove members, manage licenses, view analytics, configure settings"],
          ["member", "Access Imotara with org license, see org name in their settings"],
        ]}
      />

      <H2>🔑 Licenses Tab — License Management</H2>
      <p className="text-sm text-zinc-400 mb-3">See each member&apos;s current license tier, change individual tiers, and withdraw licenses.</p>

      <H3>Changing a Member&apos;s License Tier</H3>
      <Step n={1} title="Go to Licenses tab → find the member">
        <Screen title="/org/dashboard/licenses">
          <div className="text-[10px] space-y-1">
            <div className="grid grid-cols-4 gap-2 text-[9px] text-zinc-500 font-semibold uppercase border-b border-white/8 pb-1">
              <span>Member</span><span>Role</span><span>License tier</span><span>Activity (30d)</span>
            </div>
            {[["john@corp.com","admin","Enterprise (org default)","●●● 8"],["jane@corp.com","member","Pro (override)","●●○ 3"]].map(([e,r,t,a]) => (
              <div key={e} className="grid grid-cols-4 gap-2 items-center py-1 border-b border-white/5">
                <span className="text-zinc-300 truncate">{e}</span>
                <span className="text-indigo-300">{r}</span>
                <div className="flex items-center gap-1">
                  <div className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] text-zinc-300">{t}</div>
                </div>
                <span className="text-zinc-500">{a}</span>
              </div>
            ))}
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Use the tier dropdown to assign a different license">
        <p>Options: Org default · Plus · Pro · EDU · Enterprise · Free (restricted). The change takes effect immediately — the user&apos;s next app refresh shows the new tier.</p>
      </Step>
      <Step n={3} title='Click "Withdraw" to remove a member and revoke their license'>
        <p>Confirm the dialog. License is revoked, seat is freed, and user reverts to their personal tier (or Free).</p>
      </Step>

      <Note>👁️ <strong>Privacy rule:</strong> Activity shows session counts and last-seen dates only. No emotional content, mood data, or conversation content is ever shown to org admins. All analytics are aggregated and anonymised.</Note>

      <H2>🎫 Pool Tab — License Pool Distribution</H2>
      <p className="text-sm text-zinc-400 mb-3">If Imotara has issued license pools to your org (e.g. 50 Pro licenses), you can distribute them from here.</p>
      <Step n={1} title="View available pools and their inventory">
        <Screen title="/org/dashboard/pool">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[["70","Total issued","text-zinc-200"],["20","Assigned","text-amber-300"],["50","Available","text-emerald-400"]].map(([v,l,c]) => (
              <div key={l} className="rounded bg-white/5 p-2 text-center">
                <div className={`text-lg font-bold ${c}`}>{v}</div>
                <div className="text-[9px] text-zinc-500">{l}</div>
              </div>
            ))}
          </div>
          <div className="rounded bg-white/4 p-2 mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-indigo-300 font-semibold">pro</span>
              <span className="text-zinc-500">20 / 50 assigned · 30 free</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded overflow-hidden"><div className="h-full w-2/5 bg-indigo-400/60 rounded"/></div>
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Assign from pool — select pool and member, click Assign">
        <p>The dropdown only shows pools with available licenses. Member&apos;s tier is immediately upgraded.</p>
      </Step>
      <Step n={3} title="Reassign — use the Reassign dropdown in the assignments table">
        <p>Atomically withdraws from current holder and assigns to the new member. Pool count stays the same.</p>
      </Step>
      <Step n={4} title="Withdraw — click Withdraw in the assignments table">
        <p>Confirm. License returned to pool (pool count increases by 1). Member reverts to org default tier.</p>
      </Step>

      <H2>🏫 Teams Tab — Classroom / Department Grouping</H2>
      <p className="text-sm text-zinc-400 mb-3">Group members into teams or classrooms with a shared companion tone policy. Useful for EDU (classrooms) and Enterprise (departments).</p>
      <Step n={1} title='Click "+ New group" → enter name, description, and default companion tone'>
        <p>Tone options: 🤝 Close Friend · 🌿 Calm Companion · 🎯 Coach · 📚 Mentor</p>
      </Step>
      <Step n={2} title='Expand a group → "Members" → Add members from org'>
        <p>Only active org members can be added. Members can belong to one group per org.</p>
      </Step>

      <H2>📈 Analytics Tab (EDU/NGO only)</H2>
      <p className="text-sm text-zinc-400 mb-3">Aggregate anonymised engagement data — useful for grant reporting, CSR documentation, and programme evaluation.</p>
      <Step n={1} title="Select time range: Last 30 / 90 / 180 days">
        <p>Shows: Weekly active users trend, average session duration, total interactions, emotion theme breakdown (anonymised aggregate).</p>
      </Step>
      <Step n={2} title='Click "Last X months →" to download HTML impact report'>
        <p>Grant-ready report with WAU trend chart, programme impact statement. Open in browser → Print → Save as PDF.</p>
      </Step>

      <H2>⚙️ Settings Tab</H2>
      <Table
        headers={["Setting", "Who can see", "What it does"]}
        rows={[
          ["Organisation name", "All admins", "Edit the display name"],
          ["REST API Keys", "Enterprise", "Generate API keys for /api/v1/org/* programmatic access"],
          ["Custom Branding", "EDU + Enterprise", "Set logo URL, accent colour, brand name"],
          ["SSO / SAML", "EDU + Enterprise", "Configure IdP (Okta, Google Workspace, Azure AD) — requires activation"],
          ["LMS / iframe Embed", "EDU + Enterprise", "Get iframe snippet for Moodle/Canvas embedding"],
          ["Data Residency", "EDU + Enterprise", "Set preferred region (enforcement via support)"],
          ["NGO Verification", "NGO only", "Submit 80G/FCRA documents for subsidised pricing"],
          ["Referral Codes", "NGO only", "Generate codes for 10% revenue sharing"],
          ["Academic Calendar", "EDU only", "Set year start/end, configure student email domain auto-join"],
          ["Contracts & SLAs", "EDU + Enterprise", "Store signed agreements with expiry tracking"],
          ["Recognition Certificate", "NGO + EDU", "Download Emotional Wellness Champion certificate (≥10 members)"],
          ["Danger zone", "Owner only", "Request org deletion via email"],
        ]}
      />
    </div>
  );
}

function FaqSection() {
  const faqs = [
    {
      q: "How long does it take for a corporate Stripe payment to activate?",
      a: "The payment is instant. Our team activates the org account within 24–48 hours. You'll receive an email confirmation. During that time, you see a 'Payment received' confirmation page at /org/new.",
    },
    {
      q: "Can an org member also have a personal subscription on top of their org license?",
      a: "Yes. The system uses a priority chain — org tier is applied if it's higher than personal. If you buy a personal Pro but your org tier is Enterprise, you get Enterprise. If you leave the org, you fall back to your personal license.",
    },
    {
      q: "What happens when an org's license expires?",
      a: "Members are not automatically downgraded — access is preserved until the next time they check their license status. The super-admin should renew before expiry to avoid disruption.",
    },
    {
      q: "How do I unlock a super-admin account locked by too many failed attempts?",
      a: "Log in as Owner → go to 👑 Super Admins tab → find the locked admin (shows 🔒 Locked badge) → click Unlock. The account immediately becomes accessible.",
    },
    {
      q: "Can I give different license tiers to different members in the same org?",
      a: "Yes, two ways: (1) Licenses tab — use the tier dropdown per member to override. (2) Pool tab — assign specific pool licenses (e.g. Pro) to selected members while others stay on org default.",
    },
    {
      q: "How do I cancel a user's Stripe subscription?",
      a: "Users cancel via Settings → Cancel subscription. This calls Stripe's cancel_at_period_end API — they keep access until the period ends, then revert to Free. Org admins cannot cancel on behalf of individual users.",
    },
    {
      q: "How do NGOs get their 60% discount?",
      a: "When buying seats at /pricing/corporate, select NGO / NPO — the 60% discount is applied automatically to the displayed price and to the Stripe charge. For Razorpay users, apply via /org/new and the super-admin sets a custom price.",
    },
    {
      q: "What is the difference between Licenses tab and Pool tab?",
      a: "Licenses tab: manage each member's tier directly (override from org default). Pool tab: manage specific license batches issued by Imotara (e.g. 50 Pro licenses from a pool) — assign, withdraw, reassign from the pool inventory.",
    },
  ];

  return (
    <div className="space-y-4">
      {faqs.map((f, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
          <p className="font-semibold text-zinc-100 mb-2">Q: {f.q}</p>
          <p className="text-sm text-zinc-400 leading-relaxed">A: {f.a}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "policy",     label: "Licensing Policy",  icon: "📋" },
  { id: "superadmin", label: "Super-Admin Guide",  icon: "👑" },
  { id: "orgadmin",   label: "Org Admin Guide",    icon: "🏢" },
  { id: "faq",        label: "FAQ",                icon: "❓" },
];

export default function AdminGuidePage() {
  const [active, setActive] = useState<Section>(() => {
    if (typeof window === "undefined") return "policy";
    const s = new URLSearchParams(window.location.search).get("s") ?? "";
    return (["policy", "superadmin", "orgadmin", "faq"].includes(s) ? s : "policy") as Section;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 sticky top-0 z-10 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
              ← Back to Admin
            </Link>
            <span className="text-zinc-700">|</span>
            <h1 className="text-sm font-semibold text-zinc-200">Imotara · Licensing & Admin Guide</h1>
          </div>
          <span className="rounded-full bg-indigo-500/15 border border-indigo-400/20 px-3 py-0.5 text-[11px] text-indigo-300 font-medium">
            v1.3 · June 2026
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 flex gap-8">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0 hidden md:block">
          <div className="sticky top-20 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-3">Contents</p>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-left transition ${
                  active === s.id ? "bg-white/10 font-medium text-zinc-100 shadow-sm" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}

            <div className="mt-6 rounded-xl border border-white/8 bg-white/4 px-3 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Quick links</p>
              {[
                ["/admin", "Admin panel"],
                ["/org/dashboard", "Org dashboard"],
                ["/pricing/corporate", "Corporate pricing"],
                ["/org/new", "Apply for org plan"],
                ["/upgrade", "Individual plans"],
              ].map(([href, label]) => (
                <Link key={href as string} href={href as string} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
                  <span className="text-zinc-700">→</span>{label as string}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile tab bar */}
          <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1 mb-8 md:hidden">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] transition ${active === s.id ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500"}`}>
                {s.icon}
              </button>
            ))}
          </div>

          {/* Section title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-100">
              {SECTIONS.find(s => s.id === active)?.icon}{" "}
              {SECTIONS.find(s => s.id === active)?.label}
            </h1>
            <div className="mt-1 h-px bg-gradient-to-r from-indigo-500/40 via-sky-500/20 to-transparent" />
          </div>

          {active === "policy"     && <PolicySection />}
          {active === "superadmin" && <SuperAdminSection />}
          {active === "orgadmin"   && <OrgAdminSection />}
          {active === "faq"        && <FaqSection />}

          {/* Footer */}
          <div className="mt-16 border-t border-white/8 pt-6 text-center text-xs text-zinc-600">
            Imotara Admin Guide · Last updated June 2026 · <a href="mailto:info@imotara.com" className="underline hover:text-zinc-400">info@imotara.com</a>
          </div>
        </main>
      </div>
    </div>
  );
}
