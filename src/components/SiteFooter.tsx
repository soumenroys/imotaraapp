import Link from "next/link";
import packageJson from "../../package.json";

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.8L4.9 22H2l7.4-8.5L1 2h7l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.3 3.9H5.5L17.7 20Z" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.65-1.86 3.39-1.86 3.63 0 4.3 2.39 4.3 5.49v6.26ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.11 20.45H3.57V9h3.54v11.45ZM22 2H2v20h20V2Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconApple() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.31.07 2.22.72 2.98.75.97-.18 1.91-.78 2.92-.84 1.23-.07 2.46.47 3.14 1.5-2.62 1.57-1.98 4.97.61 5.95-.49 1.44-1.14 2.86-1.65 3.52ZM12.03 7.25c-.17-2.37 1.83-4.46 4.08-4.56.25 2.58-2.28 4.72-4.08 4.56Z" />
    </svg>
  );
}

function IconAndroid() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M17.523 15.341 19 12.668a.5.5 0 0 0-.183-.683.499.499 0 0 0-.683.183l-1.499 2.697A9.03 9.03 0 0 0 12 14a9.03 9.03 0 0 0-4.635 1.265l-1.5-2.697a.499.499 0 0 0-.865.5l1.476 2.673C4.166 17.35 3 19.502 3 22h18c0-2.498-1.166-4.65-3.477-6.659ZM8.5 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM7.215 7.052 5.5 4.144a.5.5 0 1 1 .866-.5L8.1 6.57A8.938 8.938 0 0 1 12 5.5c1.403 0 2.73.32 3.9.87l1.734-3.026a.5.5 0 1 1 .866.5l-1.715 2.908C18.282 7.93 20 10.264 20 13H4c0-2.736 1.718-5.07 3.215-5.948Z" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-rose-400" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/chat",    label: "Chat",    emoji: "💬" },
  { href: "/blog",    label: "Blog",    emoji: "📖" },
  { href: "/history", label: "History", emoji: "🕰" },
  { href: "/about",   label: "About",   emoji: "🌿" },
  { href: "/grow",    label: "Grow",    emoji: "✨" },
  { href: "/connect", label: "Contact", emoji: "✉️" },
  { href: "/privacy", label: "Privacy", emoji: "🔒" },
  { href: "/terms",   label: "Terms",   emoji: "📋" },
];

// ─── Footer ───────────────────────────────────────────────────────────────────

export default function SiteFooter() {
  const year = new Date().getFullYear();

  const raw = (packageJson?.version ?? "").trim();
  const version = raw ? `v${raw.replace(/^v/i, "").trim()}` : "v—";
  const build = ((packageJson as any)?.buildNumber ?? "").trim();
  const versionLabel = build ? `${version} (${build})` : version;

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/8">
      {/* Decorative top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/8 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">

        {/* ── Main grid ─────────────────────────────────────────────────── */}
        <div className="grid gap-10 md:grid-cols-3">

          {/* Column 1 — Brand */}
          <div className="space-y-5">
            {/* Logo */}
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 group"
              aria-label="Imotara home"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-sm font-bold text-white shadow-[0_6px_20px_rgba(99,102,241,0.45)] transition group-hover:shadow-[0_8px_28px_rgba(99,102,241,0.55)]">
                I
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-200 transition group-hover:text-white">
                Imotara
              </span>
            </Link>

            <p className="text-xs leading-6 text-zinc-500 max-w-[22ch]">
              A quiet, private companion for your emotions — no ads, no noise.
              Just presence, memory, and care.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-2">
              <a
                href="https://x.com/imotara4me"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Imotara on X"
                className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500 transition hover:border-white/20 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <IconX />
              </a>
              <a
                href="https://linkedin.com/in/imotara-4me-5b77753b0"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Imotara on LinkedIn"
                className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500 transition hover:border-[#0A66C2]/40 hover:bg-[#0A66C2]/15 hover:text-[#70aee8]"
              >
                <IconLinkedIn />
              </a>
              <a
                href="mailto:info@imotara.com"
                aria-label="Email Imotara"
                className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500 transition hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
              >
                <IconMail />
              </a>
            </div>
          </div>

          {/* Column 2 — Navigation */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
              Explore
            </p>
            <nav className="grid grid-cols-2 gap-x-3 gap-y-1.5" aria-label="Footer navigation">
              {NAV_LINKS.map(({ href, label, emoji }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                >
                  <span className="text-[13px] opacity-60 group-hover:opacity-100 transition">{emoji}</span>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3 — Download */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
              Get the app
            </p>

            <p className="text-xs leading-5 text-zinc-600">
              Free to start — iOS &amp; Android.
            </p>

            <div className="flex flex-col gap-2.5">
              {/* App Store badge */}
              <a
                href="https://apps.apple.com/in/app/imotara/id6756697569"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download Imotara on the App Store"
                className="group flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-200 shadow-sm group-hover:from-zinc-600 group-hover:to-zinc-700 transition">
                  <IconApple />
                </span>
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Download on the</p>
                  <p className="text-xs font-semibold text-zinc-200">App Store</p>
                </div>
              </a>

              {/* Play Store badge */}
              <a
                href="https://play.google.com/store/apps/details?id=com.imotara.imotara"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get Imotara on Google Play"
                className="group flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700/60 to-sky-700/60 text-emerald-200 shadow-sm group-hover:from-emerald-600/70 group-hover:to-sky-600/70 transition">
                  <IconAndroid />
                </span>
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Get it on</p>
                  <p className="text-xs font-semibold text-zinc-200">Google Play</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        {/* ── Bottom bar ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-600">
          <p className="flex items-center gap-1.5">
            © {year} Imotara. Made with <IconHeart /> for a calmer world.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-zinc-700">Not a medical or crisis service.</span>
            <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[10px] text-zinc-600 backdrop-blur-sm">
              {versionLabel}
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
