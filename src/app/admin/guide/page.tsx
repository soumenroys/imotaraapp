"use client";
// src/app/admin/guide/page.tsx — Imotara Licensing & Admin Guide
// Detailed step-by-step tutorial with realistic UI mockups for every action.

import { useState, useEffect } from "react";
import Link from "next/link";

type Section = "policy" | "superadmin" | "orgadmin" | "faq";

// ── Shared UI building blocks ─────────────────────────────────────────────────

/** Browser-chrome wrapper — makes child look like a real screenshot */
function Screen({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#141418] shadow-2xl shadow-black/40">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#1c1c21] px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-white/6 px-3 py-1 text-[10px] text-zinc-400 font-mono">
            <svg className="h-2.5 w-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            imotara.com/{title}
          </div>
        </div>
        {/* Content */}
        <div className="p-0">{children}</div>
      </div>
      {caption && <figcaption className="mt-2 text-center text-[11px] text-zinc-500 italic">{caption}</figcaption>}
    </figure>
  );
}

/** Callout with numbered step */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative flex gap-4 py-5">
      <div className="flex flex-col items-center gap-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">{n}</div>
        <div className="mt-1 flex-1 w-px bg-gradient-to-b from-indigo-500/40 to-transparent min-h-[16px]" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <p className="font-semibold text-base text-zinc-100 mb-1.5">{title}</p>
        <div className="text-sm text-zinc-400 space-y-2 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">{label}</div>
      <div className={`rounded-lg border px-3 py-2 text-xs font-mono ${type === "password" ? "border-white/10 bg-black/20 text-zinc-500 tracking-widest" : type === "active" ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-300" : type === "select" ? "border-white/10 bg-black/20 text-zinc-300 flex items-center justify-between" : "border-white/10 bg-black/20 text-zinc-300"}`}>
        {type === "password" ? "••••••••••••" : value}
        {type === "select" && <span className="text-zinc-600 text-[10px]">▾</span>}
      </div>
    </div>
  );
}

function Btn({ label, color = "indigo", full = false, sm = false }: { label: string; color?: string; full?: boolean; sm?: boolean }) {
  const cols: Record<string, string> = {
    indigo: "bg-indigo-600 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-black",
    rose: "bg-rose-600 text-white",
    zinc: "bg-zinc-700 border border-white/10 text-zinc-300",
  };
  return (
    <div className={`inline-flex items-center justify-center rounded-lg font-semibold ${sm ? "px-3 py-1 text-[10px]" : "px-4 py-2 text-xs"} ${full ? "w-full" : ""} ${cols[color] ?? cols.indigo}`}>
      {label}
    </div>
  );
}

function Tag({ children, color = "zinc" }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    zinc: "bg-zinc-700/60 text-zinc-300 border-zinc-600/30",
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-400/20",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    amber: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    rose: "bg-rose-500/15 text-rose-300 border-rose-400/20",
    sky: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    violet: "bg-violet-500/15 text-violet-300 border-violet-400/20",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c[color]}`}>{children}</span>;
}

function AdminSidebar({ active }: { active: string }) {
  const items = [["📊","Dashboard"],["🏢","Organizations"],["👑","Super Admins"]];
  return (
    <div className="w-40 shrink-0 border-r border-white/8 bg-black/20 py-3">
      {items.map(([icon, label]) => (
        <div key={label} className={`flex items-center gap-2 px-3 py-2 text-[11px] ${active === label ? "bg-indigo-500/15 text-indigo-300 border-r-2 border-indigo-400 font-semibold" : "text-zinc-500"}`}>
          <span>{icon}</span><span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function OrgSidebar({ active }: { active: string }) {
  const items = [["📊","Overview"],["👥","Members"],["🔑","Licenses"],["🎫","Pool"],["🏫","Teams"],["📈","Analytics"],["📋","Audit log"],["⚙️","Settings"]];
  return (
    <div className="w-36 shrink-0 border-r border-white/8 bg-black/20 py-3">
      <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Org Dashboard</div>
      {items.map(([icon, label]) => (
        <div key={label} className={`flex items-center gap-2 px-3 py-2 text-[10px] ${active === label ? "bg-indigo-500/15 text-indigo-300 border-r-2 border-indigo-400 font-semibold" : "text-zinc-500"}`}>
          <span>{icon}</span><span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="my-4 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-200"><span className="shrink-0 text-base">⚠️</span><span>{children}</span></div>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return <div className="my-4 flex gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/8 px-4 py-3 text-xs text-emerald-200"><span className="shrink-0 text-base">✅</span><span>{children}</span></div>;
}
function Info({ children }: { children: React.ReactNode }) {
  return <div className="my-4 flex gap-2.5 rounded-xl border border-sky-400/25 bg-sky-500/8 px-4 py-3 text-xs text-sky-200"><span className="shrink-0 text-base">ℹ️</span><span>{children}</span></div>;
}
function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-12 mb-1 text-xl font-bold text-zinc-100 scroll-mt-24">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-1 text-base font-semibold text-zinc-200 border-l-2 border-indigo-500 pl-3">{children}</h3>;
}
function Divider() {
  return <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
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
            <tr key={i} className="border-b border-white/5 hover:bg-white/2">
              {row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-zinc-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── SECTION 1: Licensing Policy ───────────────────────────────────────────────

function PolicySection() {
  return (
    <div>
      <p className="text-zinc-400 leading-relaxed mb-6">Everything you need to understand about how Imotara licenses work, how tiers are assigned, and how payments flow through the system.</p>

      <H2>License Tiers</H2>
      <p className="text-sm text-zinc-400 mb-3">Imotara has six tiers. Currently all users receive full access (LICENSE_MODE=off — soft launch). When enforcement is turned on, the table below applies.</p>
      <Table
        headers={["Tier","Price (India)","Daily AI Replies","History","Key features"]}
        rows={[
          [<Tag color="zinc">Free</Tag>,"₹0","20 replies/day","7 days","Basic chat, local storage, 1 companion tone"],
          [<Tag color="sky">Plus</Tag>,"₹99/mo · ₹699/yr","Unlimited","90 days","Cloud sync, CSV export, Azure Neural TTS, all companion tones"],
          [<Tag color="indigo">Pro</Tag>,"₹149/mo · ₹1299/yr","Unlimited","Unlimited","All Plus + emotional insights, growth arc, companion letters"],
          [<Tag color="violet">Family</Tag>,"Custom","Unlimited","Unlimited","Up to 6 profiles, child-safe mode, parent dashboard"],
          [<Tag color="emerald">EDU</Tag>,"Custom (50% off)","Unlimited","Unlimited","Org dashboard, anonymised analytics, LMS/iframe embed"],
          [<Tag color="amber">Enterprise</Tag>,"Custom (NGO 60% off)","Unlimited","Unlimited","Full org suite, API keys, custom branding, SSO/SAML"],
        ]}
      />

      <H2>Organisational Billing Types</H2>
      <Table
        headers={["Type","Discount","Assigned Tier","Best for"]}
        rows={[
          ["commercial (Company)","None (full price)","Enterprise","HR wellness, corporate mental health"],
          ["ngo (NGO / NPO)","60% off","Enterprise","Community welfare, rural mental health NGOs"],
          ["edu (Educational)","50% off","EDU","Schools, colleges, counselling institutes"],
          ["govt (Government)","None (full price)","Enterprise","Public sector programmes"],
        ]}
      />

      <H2>License Priority Chain</H2>
      <p className="text-sm text-zinc-400 mb-4">When a user opens the app, the system checks these sources in order and uses the <strong className="text-zinc-200">highest-priority one that applies</strong>:</p>
      <div className="space-y-2">
        {[
          { rank: "1", label: "Pool assignment", color: "amber", desc: "A specific license was assigned from a pool issued to their org (e.g. a Pro license from a 50-seat pool). Highest priority — overrides everything." },
          { rank: "2", label: "Org tier override", color: "orange", desc: "A super-admin or org admin manually set a different tier for this specific member (e.g. a member of an EDU org gets Enterprise)." },
          { rank: "3", label: "Personal license", color: "sky", desc: "The user bought their own Razorpay/Apple/Google Play subscription independently of any org." },
          { rank: "4", label: "Org default tier", color: "indigo", desc: "The org's tier applies to all members who don't have a higher-priority source (e.g. all members of an Enterprise org get Enterprise)." },
          { rank: "5", label: "Free (default)", color: "zinc", desc: "None of the above apply. User has no paid license." },
        ].map(({ rank, label, color, desc }) => (
          <div key={rank} className="flex gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-${color}-500/20 text-${color}-300 border border-${color}-400/30`}>{rank}</div>
            <div>
              <p className="text-sm font-semibold text-zinc-200 mb-0.5">{label}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <H2>Payment Gateways</H2>
      <Table
        headers={["Gateway","Region","Currencies","Used for","Invoice"]}
        rows={[
          ["Razorpay","India","INR","Individual users — UPI, cards, netbanking, wallets","Auto (INR paise)"],
          ["Apple IAP","Worldwide","Local (App Store)","iOS users via App Store In-App Purchase","Auto (₹ reference)"],
          ["Google Play","Worldwide","Local (Play Store)","Android users via Play Store billing","Auto (reference)"],
          ["Razorpay (intl)","Worldwide","INR + intl cards","International users via Razorpay International Payments","Auto (INR)"],
        ]}
      />
      <Info>All invoices are auto-generated and downloadable from Settings → Payment history. Each invoice has a unique INV-XXXXXX number, the payment gateway, amount, and line item description.</Info>
    </div>
  );
}

// ── SECTION 2: Super-Admin Guide ──────────────────────────────────────────────

function SuperAdminSection() {
  return (
    <div>
      <p className="text-zinc-400 leading-relaxed mb-6">Super-admins manage the entire Imotara platform. This guide walks through every task with screenshots of exactly what you will see at each step.</p>

      {/* ── LOGIN ── */}
      <H2 id="sa-login">Part 1 — Logging In</H2>

      <Step n={1} title='Open https://imotara.com/admin in your browser'>
        <p>You will see the admin login screen. It has two tabs: <strong className="text-zinc-200">Email / Password</strong> (preferred — uses your personal admin account) and <strong className="text-zinc-200">Secret key</strong> (legacy emergency fallback).</p>
        <Screen title="admin" caption="The admin login page. Use the Email / Password tab.">
          <div className="flex items-center justify-center bg-[#0d0d10] py-10">
            <div className="w-80 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl space-y-5">
              <div className="text-center space-y-1">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-black/40 ring-1 ring-white/10 flex items-center justify-center text-2xl">🌿</div>
                <p className="text-sm font-semibold text-zinc-100">Imotara Admin</p>
                <p className="text-[10px] text-zinc-500">Super-admin panel</p>
              </div>
              <div className="flex rounded-xl border border-white/8 bg-white/5 p-1 text-xs">
                <div className="flex-1 rounded-lg bg-white/10 py-1.5 text-center font-medium text-zinc-100">Email / Password</div>
                <div className="flex-1 py-1.5 text-center text-zinc-500">Secret key</div>
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-500">admin@imotara.com</div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-600 tracking-widest">••••••••••••</div>
                <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 py-2.5 text-center text-xs font-semibold text-white">Sign in</div>
              </div>
              <p className="text-center text-[9px] text-zinc-700">Forgot password?</p>
              <div className="border-t border-white/8 pt-3">
                <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/8 p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-indigo-300">📋 Admin & Licensing Guide</p>
                  <div className="space-y-1 text-[9px] text-zinc-500">
                    <div>🏷️ Licensing Policy</div>
                    <div>👑 Super-Admin Guide</div>
                    <div>🏢 Org Admin Guide</div>
                    <div>❓ FAQ</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Screen>
      </Step>

      <Step n={2} title='Enter your email address and password, then click "Sign in"'>
        <p>Your password must be: <strong className="text-zinc-300">12+ characters · at least one uppercase letter · at least one number · at least one special character</strong> (! @ # $ % ^ &amp; *).</p>
        <p className="mt-1">A real-time strength meter appears as you type — all four bars must be green before the password is accepted.</p>
        <Screen title="admin — Sign in" caption="Password strength meter shows requirements in real time.">
          <div className="flex items-center justify-center bg-[#0d0d10] py-6">
            <div className="w-72 space-y-3 px-4">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300">soumenroys@gmail.com</div>
              <div className="rounded-xl border border-indigo-400/40 bg-white/5 px-3 py-2.5 text-xs text-zinc-500 tracking-widest">••••••••••••</div>
              {/* Strength bars */}
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {["bg-emerald-500","bg-emerald-500","bg-emerald-500","bg-emerald-500"].map((c, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${c}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px]">
                  <span className="text-emerald-400">✓ 12+ characters</span>
                  <span className="text-emerald-400">✓ Uppercase letter</span>
                  <span className="text-emerald-400">✓ Number</span>
                  <span className="text-emerald-400">✓ Special character</span>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 py-2.5 text-center text-xs font-semibold text-white">Sign in</div>
            </div>
          </div>
        </Screen>
      </Step>

      <Step n={3} title="After sign-in you land on the main admin panel">
        <p>You will see three tabs at the top: <strong className="text-zinc-300">📊 Dashboard</strong>, <strong className="text-zinc-300">🏢 Organizations</strong>, and <strong className="text-zinc-300">👑 Super Admins</strong>. Your name and a Logout button appear in the top-right corner.</p>
        <Screen title="admin — Dashboard" caption="The admin panel after successful login. Three tabs are visible.">
          <div className="bg-[#0d0d10]">
            <div className="flex items-center justify-between border-b border-white/8 bg-black/30 px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">🌿 Imotara Admin</div>
              <div className="flex items-center gap-2">
                <Tag color="indigo">Soumen Roy · owner</Tag>
                <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">Logout</div>
              </div>
            </div>
            <div className="flex border-b border-white/8">
              {["📊 Dashboard","🏢 Organizations","👑 Super Admins"].map((t, i) => (
                <div key={t} className={`px-5 py-3 text-xs font-medium ${i === 0 ? "border-b-2 border-indigo-400 text-indigo-300" : "text-zinc-500"}`}>{t}</div>
              ))}
            </div>
            <div className="p-5 grid grid-cols-4 gap-3">
              {[["2","Super Admins","text-violet-300"],["0","Active Orgs","text-emerald-300"],["0","Total Members","text-sky-300"],["0","Pool Licenses","text-amber-300"]].map(([v,l,c]) => (
                <div key={l} className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
                  <div className={`text-2xl font-bold ${c}`}>{v}</div>
                  <div className="mt-1 text-[9px] text-zinc-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </Screen>
      </Step>

      <Note>If you enter the wrong password 5 times, your account will be locked for 15 minutes. An owner-role admin can unlock it early from the Super Admins tab → click the <strong>🔓 Unlock</strong> button on your row.</Note>

      <H3>Forgot your password?</H3>
      <Step n={1} title='Click "Forgot password?" below the Sign in button'>
        <p>A text field appears asking for your email address.</p>
      </Step>
      <Step n={2} title="Enter your email and click Send reset link">
        <p>You will see: <em className="text-zinc-300">"If that email exists, a reset link has been sent"</em> — the message is the same whether the email is registered or not (to prevent enumeration attacks). Check your inbox.</p>
        <Screen title="admin — Forgot password" caption="Enter your admin email. The reset link is valid for 15 minutes.">
          <div className="flex justify-center bg-[#0d0d10] py-8">
            <div className="w-72 space-y-3 px-4">
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 p-3 text-center space-y-2">
                <p className="text-sm font-semibold text-amber-300">Reset your password</p>
                <p className="text-[10px] text-zinc-400">Enter your admin email. We&apos;ll send a secure 15-minute reset link.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300">soumenroys@gmail.com</div>
              <div className="rounded-xl bg-amber-500/80 py-2.5 text-center text-xs font-semibold text-white">Send reset link</div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-[10px] text-emerald-300 text-center">
                ✓ If that email exists, a reset link has been sent.
              </div>
            </div>
          </div>
        </Screen>
      </Step>
      <Step n={3} title="Click the link in your email → set a new password">
        <p>The link takes you to <code className="bg-white/8 px-1.5 rounded text-zinc-300">imotara.com/admin?reset_token=…</code>. Type your new password (must meet complexity rules), confirm it, and click <strong className="text-zinc-300">Set new password</strong>.</p>
      </Step>

      <Divider />

      {/* ── DASHBOARD ── */}
      <H2 id="sa-dashboard">Part 2 — Dashboard (Platform Overview)</H2>
      <p className="text-sm text-zinc-400 mb-4">Click the <strong className="text-zinc-200">📊 Dashboard</strong> tab after logging in to see aggregate statistics across the whole platform.</p>

      <Screen title="admin — 📊 Dashboard" caption="Dashboard shows live platform stats: super-admins, orgs, members, pools, and a per-org table.">
        <div className="bg-[#0d0d10]">
          <div className="flex border-b border-white/8">
            {["📊 Dashboard","🏢 Organizations","👑 Super Admins"].map((t, i) => (
              <div key={t} className={`px-5 py-3 text-xs font-medium ${i === 0 ? "border-b-2 border-indigo-400 text-indigo-300" : "text-zinc-500"}`}>{t}</div>
            ))}
          </div>
          <div className="p-5 space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["2","Super Admins","1 owner · 1 admin","text-violet-300","border-violet-400/20"],
                ["3","Organisations","2 active · 1 pending","text-emerald-300","border-emerald-400/20"],
                ["87","Total Members","across all orgs","text-sky-300","border-sky-400/20"],
                ["150","Pool Licenses","120 assigned · 30 free","text-amber-300","border-amber-400/20"],
              ].map(([v,l,sub,c,bc]) => (
                <div key={l} className={`rounded-xl border ${bc} bg-white/3 p-4`}>
                  <div className={`text-3xl font-bold ${c}`}>{v}</div>
                  <div className="mt-1 text-xs font-medium text-zinc-300">{l}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">{sub}</div>
                </div>
              ))}
            </div>
            {/* Per-org table */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Per-organisation breakdown</p>
              <div className="rounded-xl border border-white/8 overflow-hidden text-[10px]">
                <div className="grid grid-cols-5 gap-2 bg-white/5 px-3 py-2 font-semibold text-zinc-500 uppercase tracking-wider">
                  <span className="col-span-2">Organisation</span><span>Members</span><span>Pool</span><span>Status</span>
                </div>
                {[
                  ["Acme Wellness Pvt Ltd","ngo","34","50 / 70",<Tag color="emerald">active</Tag>],
                  ["Sunrise Academy","edu","51","70 / 80",<Tag color="emerald">active</Tag>],
                  ["TechCorp India","commercial","2","0 / 0",<Tag color="amber">pending</Tag>],
                ].map(([name,type,mem,pool,status]) => (
                  <div key={name as string} className="grid grid-cols-5 gap-2 border-t border-white/5 px-3 py-2.5 items-center">
                    <div className="col-span-2"><span className="text-zinc-200">{name as string}</span> <Tag color="zinc">{type as string}</Tag></div>
                    <span className="text-zinc-300">{mem as string}</span>
                    <span className="text-zinc-400">{pool as string}</span>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Screen>

      <Table
        headers={["Card","What it shows"]}
        rows={[
          ["Super Admins","Count of owner + admin accounts; helps spot if accounts were unexpectedly added"],
          ["Organisations","Total orgs split by active / pending / suspended — pending = paid but awaiting activation"],
          ["Total Members","Sum of all members across all active orgs"],
          ["Pool Licenses","Total licenses issued in all pools; assigned vs available to quickly spot under/over-provisioning"],
          ["Per-org table","At-a-glance per-org: member count, pool utilisation, current status"],
        ]}
      />

      <Divider />

      {/* ── ORGANISATIONS ── */}
      <H2 id="sa-orgs">Part 3 — Managing Organisations</H2>
      <p className="text-sm text-zinc-400 mb-4">Click the <strong className="text-zinc-200">🏢 Organizations</strong> tab to view, create, edit, and manage all corporate, NGO, and EDU accounts.</p>

      <H3>Viewing all organisations</H3>
      <Screen title="admin — 🏢 Organizations" caption="Organisations list. Each row shows name, type, status, seats, and member count. Click a row to expand it.">
        <div className="bg-[#0d0d10]">
          <div className="flex border-b border-white/8">
            {["📊 Dashboard","🏢 Organizations","👑 Super Admins"].map((t, i) => (
              <div key={t} className={`px-5 py-3 text-xs font-medium ${i === 1 ? "border-b-2 border-indigo-400 text-indigo-300" : "text-zinc-500"}`}>{t}</div>
            ))}
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300">All Organisations (3)</p>
              <div className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-[10px] font-semibold text-white">+ New Org</div>
            </div>
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-6 gap-2 bg-white/5 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="col-span-2">Name</span><span>Type</span><span>Status</span><span>Seats</span><span>Members</span>
              </div>
              {[
                ["Acme Wellness Pvt Ltd","ngo","active","70","34",true],
                ["Sunrise Academy","edu","active","80","51",false],
                ["TechCorp India — admin@techcorp.in (via Stripe)","commercial","pending","100","1",false],
              ].map(([name,type,status,seats,mem,expanded]) => (
                <div key={name as string} className={`border-t border-white/5 ${expanded ? "bg-indigo-500/5" : ""}`}>
                  <div className="grid grid-cols-6 gap-2 px-3 py-2.5 text-[10px] items-center">
                    <span className="col-span-2 text-zinc-200 truncate">{name as string}</span>
                    <Tag color="zinc">{type as string}</Tag>
                    <Tag color={status === "active" ? "emerald" : "amber"}>{status as string}</Tag>
                    <span className="text-zinc-400">{seats as string}</span>
                    <span className="text-zinc-400">{mem as string}</span>
                  </div>
                  {expanded && (
                    <div className="border-t border-indigo-400/15 bg-indigo-500/5 px-3 py-2 flex gap-2 text-[9px]">
                      <div className="rounded bg-white/6 border border-white/10 px-2 py-1 text-zinc-300">✏️ Edit org</div>
                      <div className="rounded bg-white/6 border border-white/10 px-2 py-1 text-zinc-300">👥 Manage members + licenses</div>
                      <div className="rounded bg-white/6 border border-white/10 px-2 py-1 text-zinc-300">🎫 Manage license pools</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Screen>

      <H3>Creating a new organisation manually</H3>
      <Step n={1} title='Click the "+ New Org" button (top-right of the Organizations tab)'>
        <p>A form slides open below the button. Fill in all required fields.</p>
      </Step>
      <Step n={2} title="Fill in the organisation details">
        <Screen title="admin — 🏢 Organizations → New Org form" caption="Fill every field. Name and Slug are required. Set Status to 'active' to give access immediately.">
          <div className="bg-[#0d0d10] p-5">
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-300">Create Organisation</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Organisation Name *" value="Acme Wellness Pvt Ltd" />
                <Field label="Slug * (URL-safe, unique)" value="acme-wellness" />
                <Field label="Owner email" value="ceo@acmewellness.in" />
                <Field label="Type" value="commercial" type="select" />
                <Field label="Tier" value="enterprise" type="select" />
                <Field label="Status" value="active" type="active" />
                <Field label="Seats purchased" value="100" />
                <Field label="Expires at (optional)" value="2027-06-01" />
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">Internal notes</div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-zinc-500 h-12">Signed 2-year contract. Contact: Riya Sharma +91-98XXX-XXXXX</div>
              </div>
              <Btn label="Create organisation" full />
            </div>
          </div>
        </Screen>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3 space-y-1.5 text-xs text-zinc-400">
          <p><strong className="text-zinc-200">Name</strong> — Displayed in the org admin&apos;s dashboard and member Settings screen.</p>
          <p><strong className="text-zinc-200">Slug</strong> — Must be unique, lowercase, hyphens allowed. Used internally; not shown to users.</p>
          <p><strong className="text-zinc-200">Owner email</strong> — The user who will be made org owner. They must already have an Imotara account.</p>
          <p><strong className="text-zinc-200">Type</strong> — commercial / ngo / edu / govt. Determines discount eligibility and UI.</p>
          <p><strong className="text-zinc-200">Tier</strong> — enterprise or edu. Sets the license tier all members receive.</p>
          <p><strong className="text-zinc-200">Status</strong> — Set to <Tag color="emerald">active</Tag> to give members immediate access. Leave as <Tag color="amber">pending</Tag> to hold.</p>
          <p><strong className="text-zinc-200">Seats purchased</strong> — The seat limit. Invite beyond this cap is blocked with a 409 error.</p>
        </div>
      </Step>
      <Step n={3} title='Click "Create organisation"'>
        <p>The org appears in the list. All org members&apos; licenses in the <code className="bg-white/8 px-1.5 rounded text-zinc-300">licenses</code> table are upserted to the new tier automatically.</p>
        <Tip>Corporate customers email info@imotara.com via the /pricing/corporate page. After confirming their Razorpay payment, create their org manually here with status=<strong>active</strong> and the agreed seat count.</Tip>
      </Step>

      <H3>Editing an existing organisation</H3>
      <Step n={1} title="Click the org row to expand it → click ✏️ Edit org">
        <p>The same form re-opens pre-filled with current values. Change what you need.</p>
      </Step>
      <Step n={2} title="Common edits you may need to make">
        <Table
          headers={["What you want to do","Field to change","Notes"]}
          rows={[
            ["Activate a pending org","Status → active","Automatically syncs licenses for all members"],
            ["Suspend an org","Status → suspended","Members lose org tier and fall back to personal/free"],
            ["Add more seats","Seats purchased → higher number","Allows more members to be invited"],
            ["Extend license expiry","Expires at → new date","Leave blank for no expiry"],
            ["Change org tier","Tier → enterprise/edu","Takes effect immediately for all members"],
          ]}
        />
      </Step>

      <H3>Managing org members from the admin panel</H3>
      <Step n={1} title="Expand the org row → click 👥 Manage members + licenses">
        <Screen title="admin — 🏢 Organizations → [Org] → Members" caption="Every member is listed with their email, current role, and a license tier override dropdown.">
          <div className="bg-[#0d0d10] p-4">
            <div className="rounded-xl border border-white/8 overflow-hidden text-[10px]">
              <div className="grid grid-cols-4 gap-3 bg-white/5 px-3 py-2 font-semibold text-zinc-500 uppercase tracking-wider text-[9px]">
                <span className="col-span-2">Member email</span><span>Role</span><span>License tier</span>
              </div>
              {[
                ["ceo@acmewellness.in","owner","Enterprise (org default)"],
                ["hr@acmewellness.in","admin","Enterprise (org default)"],
                ["riya@acmewellness.in","member","Pro (manual override)"],
                ["dev@acmewellness.in","member","Enterprise (org default)"],
              ].map(([email,role,tier]) => (
                <div key={email} className="grid grid-cols-4 gap-3 border-t border-white/5 px-3 py-2.5 items-center">
                  <span className="col-span-2 text-zinc-300 font-mono text-[9px]">{email}</span>
                  <Tag color={role === "owner" ? "amber" : role === "admin" ? "indigo" : "zinc"}>{role}</Tag>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-[9px] text-zinc-400">{tier} ▾</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[9px] text-zinc-600">Showing 4 of 34 members</div>
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Change a member's role using the Role dropdown">
        <p>Options: <Tag color="amber">owner</Tag> · <Tag color="indigo">admin</Tag> · <Tag color="zinc">member</Tag>. Changes take effect immediately.</p>
      </Step>
      <Step n={3} title="Override a member's license tier using the License tier dropdown">
        <p>Select any tier from the dropdown. Options: <em>Org default</em> (no override) · Plus · Pro · EDU · Enterprise · Free. The override is recorded and shows in the Licenses tab as <em>"manual override"</em>.</p>
      </Step>

      <Divider />

      {/* ── POOLS ── */}
      <H2 id="sa-pools">Part 4 — Issuing License Pools</H2>
      <p className="text-sm text-zinc-400 mb-4">License pools are batches of licenses you issue to an org. The org&apos;s admins can then assign individual licenses from the pool to specific members.</p>

      <Step n={1} title="Expand an org row → click 🎫 Manage license pools">
        <p>The pool panel opens below the member panel. It shows existing pools and an <strong className="text-zinc-300">Issue new pool</strong> form.</p>
      </Step>
      <Step n={2} title="Fill in the pool details and click Issue pool">
        <Screen title="admin — 🏢 Organizations → [Org] → License pools" caption="Issue a pool of 50 Pro licenses with a label and optional expiry date. The bar shows assigned vs total.">
          <div className="bg-[#0d0d10] p-4 space-y-4">
            {/* Issue form */}
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/6 p-4 space-y-3">
              <p className="text-[10px] font-semibold text-amber-300">🎫 Issue new license pool</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[9px] text-zinc-500 mb-0.5">Tier</div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-300">pro ▾</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 mb-0.5">Quantity</div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-300">50</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 mb-0.5">Expires (opt.)</div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-500">2027-06-01</div>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 mb-0.5">Pool label</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-300">Annual Pro Batch — 2026</div>
              </div>
              <div className="rounded-lg bg-amber-500/80 py-1.5 text-center text-[10px] font-semibold text-white">Issue pool</div>
            </div>
            {/* Existing pools */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Active pools</p>
              {[
                ["Annual Pro Batch — 2026","pro",20,50],
                ["EDU Plus Pack","plus",0,30],
              ].map(([label,tier,assigned,total]) => (
                <div key={label as string} className="rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Tag color={tier === "pro" ? "indigo" : "sky"}>{tier as string}</Tag>
                      <span className="text-[10px] text-zinc-300">{label as string}</span>
                    </div>
                    <span className="text-[9px] text-zinc-500">{assigned as number}/{total as number} assigned · {(total as number) - (assigned as number)} free</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${Math.round((assigned as number) / (total as number) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Screen>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3 text-xs text-zinc-400 space-y-1.5">
          <p><strong className="text-zinc-200">Tier</strong> — The license tier members get when assigned from this pool (plus / pro / enterprise / edu).</p>
          <p><strong className="text-zinc-200">Quantity</strong> — How many individual licenses to issue. Each assignment uses 1 license; withdrawing returns it.</p>
          <p><strong className="text-zinc-200">Label</strong> — Internal name (e.g. "Annual Pro Batch 2026"). Shown to org admins when they assign from the pool.</p>
          <p><strong className="text-zinc-200">Expires</strong> — When the pool expires. Leave blank for no expiry. Expired pools cannot be assigned from.</p>
        </div>
      </Step>
      <Tip>Issue pool size to match <strong>seats_purchased</strong> on the org. If an org has 100 seats and you issue 100 Enterprise licenses, every member can be covered from the pool.</Tip>

      <Divider />

      {/* ── SUPER ADMINS ── */}
      <H2 id="sa-admins">Part 5 — Managing Super-Admins</H2>
      <p className="text-sm text-zinc-400 mb-4">Click the <strong className="text-zinc-200">👑 Super Admins</strong> tab. Only <Tag color="amber">owner</Tag>-role admins can manage other super-admins.</p>

      <Screen title="admin — 👑 Super Admins" caption="The Super Admins tab lists all accounts with lockout status, last login, and action buttons.">
        <div className="bg-[#0d0d10]">
          <div className="flex border-b border-white/8">
            {["📊 Dashboard","🏢 Organizations","👑 Super Admins"].map((t, i) => (
              <div key={t} className={`px-5 py-3 text-xs font-medium ${i === 2 ? "border-b-2 border-indigo-400 text-indigo-300" : "text-zinc-500"}`}>{t}</div>
            ))}
          </div>
          <div className="p-4 space-y-4">
            {/* Add form */}
            <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 space-y-3">
              <p className="text-[10px] font-semibold text-violet-300">+ Add super-admin</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-400">Full name</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-400">email@example.com</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-600 tracking-widest col-span-1">••••••••••••</div>
                <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-400">Role: admin ▾</div>
              </div>
              <div className="flex gap-1 text-[9px]">
                {["h-1 bg-emerald-500","h-1 bg-emerald-500","h-1 bg-emerald-500","h-1 bg-emerald-500"].map((c,i) => <div key={i} className={`flex-1 rounded-full ${c}`} />)}
              </div>
              <div className="rounded-lg bg-violet-600/80 py-1.5 text-center text-[10px] font-semibold text-white">Add admin</div>
            </div>
            {/* Admin list */}
            <div className="rounded-xl border border-white/8 overflow-hidden text-[10px]">
              <div className="grid grid-cols-5 bg-white/5 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 gap-2">
                <span className="col-span-2">Admin</span><span>Role</span><span>Last login</span><span>Actions</span>
              </div>
              {[
                {name:"Soumen Roy",email:"soumenroys@gmail.com",role:"owner",login:"Today 12:34",locked:false,active:true},
                {name:"Test Admin",email:"test@imotara.com",role:"admin",login:"Never",locked:false,active:false},
              ].map((a) => (
                <div key={a.email} className="grid grid-cols-5 gap-2 border-t border-white/5 px-3 py-2.5 items-center">
                  <div className="col-span-2">
                    <p className="text-zinc-200">{a.name}</p>
                    <p className="text-zinc-600 font-mono">{a.email}</p>
                  </div>
                  <Tag color={a.role === "owner" ? "amber" : "indigo"}>{a.role}</Tag>
                  <span className="text-zinc-500">{a.login}</span>
                  <div className="flex flex-wrap gap-1">
                    {a.active ? (
                      <>
                        <div className="rounded bg-white/6 border border-white/10 px-1.5 py-0.5 text-[8px] text-zinc-400">Reset pwd</div>
                        <div className="rounded bg-white/6 border border-white/10 px-1.5 py-0.5 text-[8px] text-zinc-400">Sessions</div>
                        {a.role !== "owner" && <div className="rounded bg-rose-500/15 border border-rose-400/20 px-1.5 py-0.5 text-[8px] text-rose-400">Deactivate</div>}
                      </>
                    ) : (
                      <Tag color="rose">Inactive</Tag>
                    )}
                    {a.locked && <div className="rounded bg-amber-500/15 border border-amber-400/20 px-1.5 py-0.5 text-[8px] text-amber-300">🔓 Unlock</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Screen>

      <H3>Adding a new super-admin</H3>
      <Step n={1} title="Fill in name, email, password, and role in the Add form at the top">
        <p>Role options: <Tag color="amber">owner</Tag> — full access including managing other super-admins. <Tag color="indigo">admin</Tag> — full platform access but cannot manage super-admins or issue license pools.</p>
      </Step>
      <Step n={2} title='Click "Add admin" — the new admin can immediately log in at /admin'>
        <p>They use their email and the password you set. They should change it on first login via the Forgot password flow.</p>
      </Step>

      <H3>Security actions on existing admins</H3>
      <Table
        headers={["Button","When to use","What it does"]}
        rows={[
          ["Reset pwd","Admin forgot password / you want to force rotation","Opens a form to set a new password for that admin immediately"],
          ["Sessions","Audit active sessions / force logout everywhere","Shows all active sessions with IP, device, last-used; each has a Revoke button"],
          ["🔓 Unlock","Admin is locked after 5 wrong attempts","Clears the lockout immediately — admin can log in again"],
          ["Deactivate","Admin leaves team / security incident","Sets account inactive — they cannot log in; not deleted (audit trail preserved)"],
        ]}
      />
      <Note><strong>You cannot deactivate yourself.</strong> If there is only one owner account, you cannot deactivate it either — there must always be at least one active owner.</Note>
    </div>
  );
}

// ── SECTION 3: Org Admin Guide ────────────────────────────────────────────────

function OrgAdminSection() {
  return (
    <div>
      <p className="text-zinc-400 leading-relaxed mb-6">Org admins manage their own organisation at <code className="bg-white/8 px-1.5 rounded text-zinc-200">/org/dashboard</code> using their normal Imotara Google/GitHub account — no separate admin password is needed.</p>

      <H2 id="oa-access">Part 1 — Accessing the Org Dashboard</H2>
      <Step n={1} title="Sign in to Imotara with your Google or GitHub account">
        <p>Use the same account that was set as the org owner when the organisation was created. Go to <strong className="text-zinc-300">imotara.com</strong> and click <strong className="text-zinc-300">Sign in with Google</strong> (or GitHub).</p>
      </Step>
      <Step n={2} title='Navigate to https://imotara.com/org/dashboard'>
        <p>You are automatically redirected there after sign-in if you are an org admin. The sidebar shows all available tabs.</p>
        <Screen title="org/dashboard/overview" caption="The org dashboard overview page. Sidebar shows all sections. Stats refresh in real time.">
          <div className="flex bg-[#0d0d10] min-h-[200px]">
            <OrgSidebar active="Overview" />
            <div className="flex-1 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Acme Wellness Pvt Ltd</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Tag color="amber">ngo</Tag>
                    <Tag color="emerald">active</Tag>
                    <span className="text-[10px] text-zinc-500">Your role: owner</span>
                  </div>
                </div>
              </div>
              {/* Stat row */}
              <div className="grid grid-cols-4 gap-3">
                {[["34","Members","text-sky-300"],["70","Seats","text-zinc-300"],["3","Pending invites","text-amber-300"],["28","WAU","text-emerald-300"]].map(([v,l,c]) => (
                  <div key={l} className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                    <div className={`text-2xl font-bold ${c}`}>{v}</div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              {/* Seat bar */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-zinc-300 font-medium">Seat usage</span>
                  <span className="text-zinc-500">34 / 70 used · 36 available</span>
                </div>
                <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: "48%" }} />
                </div>
              </div>
            </div>
          </div>
        </Screen>
      </Step>

      <Divider />

      {/* ── MEMBERS ── */}
      <H2 id="oa-members">Part 2 — Members Tab (Invite &amp; Manage)</H2>

      <H3>Inviting a single member</H3>
      <Step n={1} title='Go to the 👥 Members tab → find the "Invite member" section'>
        <Screen title="org/dashboard/members — Invite" caption="Type the colleague's email, pick a role, and click Send invite. They receive an email with a join link valid for 7 days.">
          <div className="flex bg-[#0d0d10] min-h-[160px]">
            <OrgSidebar active="Members" />
            <div className="flex-1 p-5">
              <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-indigo-300">Invite a member</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-500">colleague@company.com</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">member ▾</div>
                  <div className="rounded-lg bg-indigo-600/80 px-4 py-2 text-xs font-semibold text-white">Send invite</div>
                </div>
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-[10px] text-emerald-300">
                  ✓ Invite sent to colleague@company.com — link valid for 7 days
                </div>
              </div>
            </div>
          </div>
        </Screen>
      </Step>
      <Step n={2} title="The invitee clicks the link in the email → they are added to the org">
        <p>They must be signed into Imotara when they click the link. After joining, their license tier is upgraded to the org&apos;s default tier automatically.</p>
      </Step>

      <H3>Bulk invite via CSV</H3>
      <Step n={1} title='Scroll to "Bulk import via CSV" below the invite form'>
        <Screen title="org/dashboard/members — Bulk import" caption="Upload a CSV with up to 500 emails. Preview validates each row before sending invites.">
          <div className="flex bg-[#0d0d10] min-h-[220px]">
            <OrgSidebar active="Members" />
            <div className="flex-1 p-5 space-y-3">
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-300">Bulk import via CSV</p>
                <div className="rounded-xl border-2 border-dashed border-white/15 p-5 text-center text-xs text-zinc-500">
                  📂 Drop .csv file here or <span className="underline text-indigo-400">click to browse</span>
                  <p className="mt-1 text-[9px] text-zinc-600">Format: email,role (header row optional) · Max 500 rows</p>
                </div>
                {/* Preview table */}
                <div className="rounded-lg border border-white/8 overflow-hidden">
                  <div className="grid grid-cols-3 bg-white/5 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                    <span>Email</span><span>Role</span><span>Status</span>
                  </div>
                  {[
                    ["john@acme.com","member","✓ Will invite"],
                    ["jane@acme.com","admin","✓ Will invite"],
                    ["riya@acme.com","member","⚠ Already a member"],
                    ["not-an-email","member","✗ Invalid email — skipped"],
                  ].map(([e,r,s]) => (
                    <div key={e} className="grid grid-cols-3 border-t border-white/5 px-3 py-1.5 text-[9px]">
                      <span className="font-mono text-zinc-300">{e}</span>
                      <span className="text-zinc-400">{r}</span>
                      <span className={s.startsWith("✓") ? "text-emerald-400" : s.startsWith("⚠") ? "text-amber-400" : "text-rose-400"}>{s}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-indigo-600/80 py-2 text-center text-xs font-semibold text-white">Send invites to 2 valid emails</div>
              </div>
            </div>
          </div>
        </Screen>
      </Step>
      <Step n={2} title="Review the preview → click Send invites">
        <p>Only rows marked <span className="text-emerald-400 font-mono text-xs">✓ Will invite</span> receive emails. Existing members and invalid emails are skipped automatically.</p>
      </Step>

      <H3>Managing existing members</H3>
      <Screen title="org/dashboard/members — Member list" caption="Each member row shows email, role, join date, and action buttons. Use the Role dropdown to promote or demote.">
        <div className="flex bg-[#0d0d10] min-h-[220px]">
          <OrgSidebar active="Members" />
          <div className="flex-1 p-5">
            <div className="rounded-xl border border-white/8 overflow-hidden text-[10px]">
              <div className="grid grid-cols-5 bg-white/5 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 gap-2">
                <span className="col-span-2">Email</span><span>Role</span><span>Joined</span><span>Actions</span>
              </div>
              {[
                ["ceo@acmewellness.in","owner","15 Jan 2026"],
                ["hr@acmewellness.in","admin","16 Jan 2026"],
                ["riya@acmewellness.in","member","20 Jan 2026"],
              ].map(([email,role,joined]) => (
                <div key={email} className="grid grid-cols-5 gap-2 border-t border-white/5 px-3 py-2.5 items-center">
                  <span className="col-span-2 text-zinc-300 font-mono text-[9px] truncate">{email}</span>
                  <div className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] text-zinc-400">{role} ▾</div>
                  <span className="text-zinc-500 text-[9px]">{joined}</span>
                  <div className="rounded border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 text-[8px] text-rose-400">Remove</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Screen>
      <Table
        headers={["Role","Can do"]}
        rows={[
          [<Tag color="amber">owner</Tag>,"Everything (1 per org). Can transfer ownership."],
          [<Tag color="indigo">admin</Tag>,"Invite/remove members, manage licenses, pools, analytics, settings. Cannot transfer ownership."],
          [<Tag color="zinc">member</Tag>,"Access Imotara with org license. Can see the org name in their Settings. No dashboard access."],
        ]}
      />

      <Divider />

      {/* ── LICENSES ── */}
      <H2 id="oa-licenses">Part 3 — Licenses Tab</H2>
      <p className="text-sm text-zinc-400 mb-4">See every member&apos;s current license tier and change individual tiers independently of the org default.</p>

      <Screen title="org/dashboard/licenses" caption="Each member shows their effective tier, its source, 30-day activity dots, and a Change dropdown. Tier source tells you why they have that tier.">
        <div className="flex bg-[#0d0d10] min-h-[240px]">
          <OrgSidebar active="Licenses" />
          <div className="flex-1 p-5">
            <div className="rounded-xl border border-white/8 overflow-hidden text-[10px]">
              <div className="grid grid-cols-5 bg-white/5 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 gap-2">
                <span className="col-span-2">Member</span><span>Effective tier</span><span>Source</span><span>Activity (30d)</span>
              </div>
              {[
                ["ceo@acmewellness.in","Enterprise","org default","●●●●●●●●●●"],
                ["hr@acmewellness.in","Pro","manual override","●●●●●○○○○○"],
                ["riya@acmewellness.in","Enterprise","pool assignment","●●●○○○○○○○"],
                ["dev@acmewellness.in","Free","no org license","○○○○○○○○○○"],
              ].map(([email,tier,source,dots]) => (
                <div key={email} className="grid grid-cols-5 gap-2 border-t border-white/5 px-3 py-2.5 items-center">
                  <span className="col-span-2 text-zinc-300 font-mono text-[9px] truncate">{email}</span>
                  <Tag color={tier === "Enterprise" ? "amber" : tier === "Pro" ? "indigo" : tier === "Free" ? "zinc" : "sky"}>{tier}</Tag>
                  <span className="text-zinc-600 text-[9px]">{source}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[8px] text-zinc-500 tracking-tighter">{dots}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] text-zinc-400">Select member ▾</div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] text-zinc-400">New tier ▾</div>
              <div className="rounded-lg bg-indigo-600/70 px-3 py-1.5 text-[10px] font-semibold text-white">Change tier</div>
              <div className="rounded-lg border border-rose-400/20 bg-rose-500/8 px-3 py-1.5 text-[10px] text-rose-400">Withdraw license</div>
            </div>
          </div>
        </div>
      </Screen>

      <Step n={1} title="To change a member's tier — use the Select member + New tier dropdowns → click Change tier">
        <p>Effect is immediate. The member sees the new tier on their next app reload. The <em>Source</em> column updates to <em>"manual override"</em>.</p>
      </Step>
      <Step n={2} title="To remove a member's license — select them → click Withdraw license">
        <p>The override or pool assignment is removed. The member falls back to the next tier in the priority chain (org default → personal → free).</p>
      </Step>
      <Note>Activity dots show session count — 10 dots = 10 or more sessions in 30 days. <strong>No emotional content, conversation text, or mood data is ever visible to org admins.</strong> All data shown is purely engagement metadata.</Note>

      <Divider />

      {/* ── POOL ── */}
      <H2 id="oa-pool">Part 4 — Pool Tab (Distribute License Pools)</H2>
      <p className="text-sm text-zinc-400 mb-4">If Imotara has issued license pools to your org (e.g. 50 Pro licenses), you distribute them from here. Each assignment uses one license from the pool inventory.</p>

      <Screen title="org/dashboard/pool" caption="Pool overview showing total issued, assigned, and free. Below: assign to a member, view all assignments with reassign/withdraw actions.">
        <div className="flex bg-[#0d0d10] min-h-[280px]">
          <OrgSidebar active="Pool" />
          <div className="flex-1 p-5 space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              {[["70","Total issued","text-zinc-200"],["20","Assigned","text-amber-300"],["50","Available","text-emerald-400"]].map(([v,l,c]) => (
                <div key={l} className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                  <div className={`text-2xl font-bold ${c}`}>{v}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            {/* Pool cards */}
            {[["Annual Pro Batch — 2026","pro",20,50],["EDU Plus Pack","plus",0,30]].map(([label,tier,assigned,total]) => (
              <div key={label as string} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tag color={tier === "pro" ? "indigo" : "sky"}>{tier as string}</Tag>
                    <span className="text-[10px] text-zinc-300 font-medium">{label as string}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500">{assigned as number} of {total as number} assigned · {(total as number) - (assigned as number)} free</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${Math.round((assigned as number) / (total as number) * 100)}%` }} />
                </div>
              </div>
            ))}
            {/* Assign form */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-500">Select pool ▾</div>
              <div className="flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-500">Select member ▾</div>
              <div className="rounded-lg bg-indigo-600/70 px-3 py-1.5 text-[10px] font-semibold text-white">Assign</div>
            </div>
            {/* Assignments table */}
            <div className="rounded-xl border border-white/8 overflow-hidden text-[9px]">
              <div className="grid grid-cols-4 bg-white/5 px-3 py-2 font-semibold uppercase tracking-wider text-zinc-500 gap-2">
                <span>Member</span><span>Pool</span><span>Assigned</span><span>Actions</span>
              </div>
              {[
                ["riya@acmewellness.in","Annual Pro Batch — 2026","2 Feb 2026"],
                ["dev@acmewellness.in","Annual Pro Batch — 2026","5 Feb 2026"],
              ].map(([email,pool,date]) => (
                <div key={email} className="grid grid-cols-4 gap-2 border-t border-white/5 px-3 py-2.5 items-center">
                  <span className="text-zinc-300 font-mono truncate">{email}</span>
                  <span className="text-zinc-500">{pool}</span>
                  <span className="text-zinc-500">{date}</span>
                  <div className="flex gap-1">
                    <div className="rounded bg-white/6 border border-white/10 px-1.5 py-0.5 text-[8px] text-zinc-400">Reassign</div>
                    <div className="rounded bg-rose-500/10 border border-rose-400/20 px-1.5 py-0.5 text-[8px] text-rose-400">Withdraw</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Screen>

      <Table
        headers={["Action","How","What happens"]}
        rows={[
          ["Assign","Select pool + select member → Assign","Member gets that pool's tier immediately. Pool free count decreases by 1."],
          ["Reassign","Click Reassign on an assignment row → pick new member","Atomically moves the license. Original holder loses it; new holder gets it. Pool count stays the same."],
          ["Withdraw","Click Withdraw on an assignment row → confirm","License returns to pool (free count +1). Member falls back to org default tier."],
        ]}
      />

      <Divider />

      {/* ── ANALYTICS ── */}
      <H2 id="oa-analytics">Part 5 — Analytics (EDU &amp; NGO)</H2>
      <p className="text-sm text-zinc-400 mb-4">Aggregate anonymised engagement data. Useful for grant reports, CSR documentation, and programme evaluation. Not available for commercial orgs.</p>

      <Screen title="org/dashboard/analytics" caption="Select a time range to see WAU trend, session stats, and emotion theme breakdown. All data is aggregated — no individual data is visible.">
        <div className="flex bg-[#0d0d10] min-h-[220px]">
          <OrgSidebar active="Analytics" />
          <div className="flex-1 p-5 space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 rounded-lg border border-white/8 bg-white/5 p-0.5 text-[10px]">
                {["30d","90d","180d"].map((d,i) => (
                  <div key={d} className={`px-3 py-1 rounded-md ${i===0?"bg-white/10 text-zinc-100":"text-zinc-500"}`}>{d}</div>
                ))}
              </div>
              <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-1.5 text-[10px] text-indigo-300">⬇ Download impact report</div>
            </div>
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3">
              {[["28","Weekly active users","text-emerald-300"],["4.2","Avg sessions / user","text-sky-300"],["847","Total sessions","text-indigo-300"]].map(([v,l,c]) => (
                <div key={l} className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            {/* Bar chart mock */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Weekly active users — last 30 days</p>
              <div className="flex items-end gap-1 h-16">
                {[30,45,38,62,55,70,58,80,72,68,75,82,78,90,85].map((h,i) => (
                  <div key={i} className="flex-1 rounded-t bg-indigo-400/40 hover:bg-indigo-400/70 transition" style={{height:`${h}%`}} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Screen>

      <Step n={1} title='Select time range: 30d / 90d / 180d using the toggle'>
        <p>All charts and metrics update to the selected period. Weekly active users (WAU) shows how many org members opened the app that week.</p>
      </Step>
      <Step n={2} title='Click "Download impact report" to get a grant-ready PDF'>
        <p>An HTML report opens in your browser with WAU trend chart, session stats, and a programme impact statement. Use <strong className="text-zinc-300">File → Print → Save as PDF</strong> in your browser to save it.</p>
      </Step>

      <Divider />

      {/* ── SETTINGS ── */}
      <H2 id="oa-settings">Part 6 — Settings Tab</H2>
      <p className="text-sm text-zinc-400 mb-4">The Settings tab is grouped into sections. Some sections are only visible for specific org types.</p>

      <Screen title="org/dashboard/settings" caption="Settings tab. Each section collapses/expands. Scroll down to see all sections available for your org type.">
        <div className="flex bg-[#0d0d10] min-h-[260px]">
          <OrgSidebar active="Settings" />
          <div className="flex-1 p-5 space-y-2 overflow-auto">
            {[
              { title: "🏢 Organisation name", desc: "Edit the display name shown to members", always: true },
              { title: "🔑 API Keys", desc: "Generate REST API keys for programmatic access", tag: "Enterprise" },
              { title: "🎨 Custom branding", desc: "Logo, accent colour, and brand name", tag: "EDU + Enterprise" },
              { title: "🔒 SSO / SAML", desc: "Configure Okta, Google Workspace, or Azure AD", tag: "EDU + Enterprise" },
              { title: "🖼 LMS / iframe embed", desc: "Get embed snippet for Moodle / Canvas", tag: "EDU + Enterprise" },
              { title: "📜 NGO verification", desc: "Submit 80G/FCRA documents for subsidised pricing", tag: "NGO" },
              { title: "🔗 Referral codes", desc: "Generate referral codes with commission tracking", tag: "NGO" },
              { title: "📅 Academic calendar", desc: "Year dates, student email domain auto-join", tag: "EDU" },
              { title: "📋 Contracts & SLAs", desc: "Store signed agreements with expiry tracking", tag: "Enterprise" },
              { title: "🏆 Recognition certificate", desc: "Download Emotional Wellness Champion certificate (≥10 members)", tag: "NGO + EDU" },
            ].map(({ title, desc, always, tag }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-zinc-200">{title}</p>
                  <p className="text-[9px] text-zinc-500">{desc}</p>
                </div>
                {tag && <Tag color="zinc">{tag}</Tag>}
                {always && <Tag color="emerald">All orgs</Tag>}
              </div>
            ))}
          </div>
        </div>
      </Screen>
    </div>
  );
}

// ── SECTION 4: FAQ ────────────────────────────────────────────────────────────

function FaqSection() {
  const faqs = [
    {
      q: "A corporate customer sent an enquiry but their org is not set up yet — what do I do?",
      a: "When a customer clicks 'Get started' on /pricing/corporate, a pre-filled email is sent to info@imotara.com. Reply with a Razorpay payment link for the quoted amount. Once payment is confirmed, go to Admin panel → 🏢 Organizations tab → click '+ New Org' → fill in their details and set Status to 'active'. The customer then receives access to /org/dashboard.",
    },
    {
      q: "How do I handle a request for more seats after the initial purchase?",
      a: "Admin panel → Organizations → expand the org → Edit org → increase Seats purchased to the new limit → Save. If you are also issuing more pool licenses, expand the org → Manage license pools → Issue new pool with the additional quantity.",
    },
    {
      q: "A member says they still see 'Free' tier even after joining the org — what's wrong?",
      a: "Most common cause: their session hasn't refreshed. Ask them to open Settings → pull down to refresh (mobile) or reload the page (web). If still wrong: Admin panel → Organizations → expand org → Manage members + licenses → verify their email appears in the list. If not, the invite may not have been accepted — re-invite. If they appear but with wrong tier, use the License tier dropdown to set the correct tier manually.",
    },
    {
      q: "An admin account is locked (🔒 Locked badge visible). How do I unlock it?",
      a: "Admin panel → 👑 Super Admins tab → find the locked admin (their row shows a 🔓 Unlock button) → click Unlock. The account is immediately accessible. If YOUR account is locked, contact another Owner-role admin to unlock it for you.",
    },
    {
      q: "Can an org member have a higher tier than the org? (e.g. org is Enterprise but member bought personal Pro)",
      a: "Yes. The priority chain means personal Pro would only apply if it's higher than Enterprise — which it's not. Enterprise wins. The member keeps Enterprise. When they leave the org, they fall back to their personal Pro license. The system always gives the user the highest tier they're entitled to.",
    },
    {
      q: "What's the difference between the Licenses tab and the Pool tab in the org dashboard?",
      a: "Licenses tab: manage each member's tier directly — see who has what tier and why, change a specific member's tier (manual override), or withdraw a license from a specific member. Pool tab: manage pool inventory issued by Imotara — assign/withdraw/reassign specific pool licenses to individual members. If Imotara hasn't issued a pool to your org, the Pool tab will show empty inventory.",
    },
    {
      q: "How do I cancel a member's license when they leave the organisation?",
      a: "Org dashboard → 👥 Members tab → find the member → click Remove. This removes them from the org, revokes their org license, and frees their seat. They revert to their personal license (or Free). Alternatively: Licenses tab → select member → click Withdraw license.",
    },
    {
      q: "An NGO customer says they didn't get the 60% discount — what do we do?",
      a: "The /pricing/corporate page shows the discounted price when NGO type is selected. The customer emails info@imotara.com with the pre-filled quote. If the wrong type was selected, simply reply with a Razorpay payment link at the correct discounted price — no payment has been taken yet at the enquiry stage.",
    },
  ];

  return (
    <div className="space-y-4">
      {faqs.map((f, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300 mt-0.5">Q</div>
            <p className="font-semibold text-zinc-100 text-sm leading-snug">{f.q}</p>
          </div>
          <div className="mt-3 ml-9 flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300 mt-0.5">A</div>
            <p className="text-sm text-zinc-400 leading-relaxed">{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; icon: string; desc: string }[] = [
  { id: "policy",     label: "Licensing Policy",  icon: "🏷️", desc: "Tiers, pricing, priority chain, gateways" },
  { id: "superadmin", label: "Super-Admin Guide",  icon: "👑", desc: "Login, orgs, pools, admins — step by step" },
  { id: "orgadmin",   label: "Org Admin Guide",    icon: "🏢", desc: "Members, licenses, pools, analytics" },
  { id: "faq",        label: "FAQ",                icon: "❓", desc: "Common issues and how to fix them" },
];

export default function AdminGuidePage() {
  const [active, setActive] = useState<Section>("policy");

  // Read ?s= after mount — avoids SSR/client hydration mismatch
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s") ?? "";
    if (["policy", "superadmin", "orgadmin", "faq"].includes(s)) {
      setActive(s as Section);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d10] text-zinc-100">
      {/* Top header */}
      <div className="sticky top-0 z-20 border-b border-white/8 bg-[#0d0d10]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Admin panel
            </Link>
            <span className="text-zinc-700 text-sm">|</span>
            <h1 className="text-sm font-semibold text-zinc-200 truncate">Imotara · Licensing &amp; Admin Guide</h1>
          </div>
          <span className="shrink-0 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-0.5 text-[10px] text-indigo-300 font-medium">v1.3 · June 2026</span>
        </div>
        {/* Section tabs */}
        <div className="mx-auto max-w-7xl px-4 flex gap-0 border-t border-white/5 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs whitespace-nowrap transition border-b-2 ${active === s.id ? "border-indigo-400 text-indigo-300 font-semibold" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex gap-8">
        {/* Sidebar TOC — desktop only */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3">In this section</p>
            {active === "superadmin" && [
              ["sa-login","Part 1 — Logging in"],
              ["sa-dashboard","Part 2 — Dashboard"],
              ["sa-orgs","Part 3 — Organisations"],
              ["sa-pools","Part 4 — License pools"],
              ["sa-admins","Part 5 — Super-admins"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition">{label as string}</a>
            ))}
            {active === "orgadmin" && [
              ["oa-access","Part 1 — Access dashboard"],
              ["oa-members","Part 2 — Members"],
              ["oa-licenses","Part 3 — Licenses"],
              ["oa-pool","Part 4 — Pool"],
              ["oa-analytics","Part 5 — Analytics"],
              ["oa-settings","Part 6 — Settings"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition">{label as string}</a>
            ))}
            <div className="mt-6 rounded-xl border border-white/8 bg-white/3 px-3 py-3 space-y-2">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Quick links</p>
              {[
                ["/admin","Admin panel"],
                ["/org/dashboard","Org dashboard"],
                ["/pricing/corporate","Corporate pricing"],
                ["/upgrade","Individual plans"],
              ].map(([href, label]) => (
                <a key={href as string} href={href as string} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-300 transition">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  {label as string}
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          {/* Section hero */}
          <div className="mb-8 rounded-2xl border border-white/8 bg-gradient-to-br from-white/4 to-transparent p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{SECTIONS.find(s => s.id === active)?.icon}</span>
              <h1 className="text-2xl font-bold text-zinc-100">{SECTIONS.find(s => s.id === active)?.label}</h1>
            </div>
            <p className="text-sm text-zinc-500">{SECTIONS.find(s => s.id === active)?.desc}</p>
          </div>

          {active === "policy"     && <PolicySection />}
          {active === "superadmin" && <SuperAdminSection />}
          {active === "orgadmin"   && <OrgAdminSection />}
          {active === "faq"        && <FaqSection />}

          <div className="mt-16 border-t border-white/8 pt-6 text-center text-xs text-zinc-600">
            Imotara Admin Guide · June 2026 ·{" "}
            <a href="mailto:info@imotara.com" className="underline hover:text-zinc-400">info@imotara.com</a>
          </div>
        </main>
      </div>
    </div>
  );
}
