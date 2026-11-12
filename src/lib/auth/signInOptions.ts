// src/lib/auth/signInOptions.ts — #134 (owner, 12 Nov 2026): sign in with ANY email, or with
// Google, Microsoft, Apple or LinkedIn — for every user, on one panel. ⇒ components/auth/SignInPanel.tsx
//
// 🔑 WHY: the site offered Google only (five separate buttons), so anyone without a Google
// account — and an NGO member invited with a work address — had no way in.
//
// ⛔ A way in is SHOWN only once it works. Each provider needs its own setup in Supabase
// (Microsoft = an Entra app, Apple = a Services ID, LinkedIn = an app; email needs our own mail
// server in Supabase, or its built-in one sends only a few mails an hour). Until the owner has
// done that, the env list leaves it out — nobody ever meets a button that fails.
//   NEXT_PUBLIC_AUTH_PROVIDERS = "google,azure,apple,linkedin_oidc"   (default: "google")
//   NEXT_PUBLIC_AUTH_EMAIL     = "code,password"                      (default: none)

export type OAuthProviderId = "google" | "azure" | "apple" | "linkedin_oidc";
export type EmailMethod = "code" | "password";

export type OAuthOption = {
  id: OAuthProviderId;
  label: string;
  /** Extra OAuth scopes some providers need to hand over the email address. */
  scopes?: string;
  /** Always show the account chooser — never silently reuse the browser's last account. */
  queryParams?: Record<string, string>;
};

/** Display order = this order. */
export const OAUTH_OPTIONS: readonly OAuthOption[] = [
  // 🔑 prompt=select_account is NOT optional (a real wrong-account bug, fixed once already).
  { id: "google", label: "Continue with Google", queryParams: { prompt: "select_account" } },
  { id: "azure", label: "Continue with Microsoft", scopes: "email", queryParams: { prompt: "select_account" } },
  { id: "apple", label: "Continue with Apple" },
  { id: "linkedin_oidc", label: "Continue with LinkedIn" },
];

const KNOWN_PROVIDERS = new Set<string>(OAUTH_OPTIONS.map((o) => o.id));

function list(raw: string | undefined | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Providers switched on. Unknown names are ignored; nothing set ⇒ Google only (today's behaviour). */
export function enabledOAuth(raw: string | undefined | null = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): OAuthOption[] {
  const on = list(raw).filter((p) => KNOWN_PROVIDERS.has(p));
  const set = new Set(on.length ? on : ["google"]);
  return OAUTH_OPTIONS.filter((o) => set.has(o.id));
}

/** Email methods switched on. Nothing set ⇒ none (the mail server must be set up first). */
export function enabledEmail(raw: string | undefined | null = process.env.NEXT_PUBLIC_AUTH_EMAIL): EmailMethod[] {
  const on = list(raw);
  return (["code", "password"] as const).filter((m) => on.includes(m));
}

/** Only ever send people back to a path on this site. */
export function safeTarget(path: string | null | undefined): string {
  const p = (path ?? "").trim();
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/auth/") ? p : "/chat";
}

/** Where an OAuth provider (and the email-confirmation link) returns to. */
export function callbackUrl(origin: string, target: string): string {
  return `${origin}/auth/callback?redirectTo=${encodeURIComponent(safeTarget(target))}`;
}

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;
export const CODE_LENGTH = 6;

/** Supabase's English error text ⇒ a sentence a person can act on. */
export function friendlyAuthError(message: string | null | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again, or use “Email me a code”.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — open the link we sent you.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "There's already an account with this email. Sign in instead, or use “Email me a code”.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("invalid otp") || m.includes("token is invalid")) return "That code didn't work or has expired. Ask for a new one.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many tries just now. Please wait a minute and try again.";
  if (m.includes("password") && (m.includes("short") || m.includes("at least") || m.includes("weak"))) return `Please use a password of at least ${MIN_PASSWORD} characters.`;
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New accounts can't be created this way right now.";
  return "Something went wrong. Please try again.";
}

/** The window event every "Sign in" button fires; the one panel in the layout listens. */
export const OPEN_SIGN_IN_EVENT = "imotara:open-sign-in";
export function openSignIn(target?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SIGN_IN_EVENT, { detail: { target: safeTarget(target ?? window.location.pathname) } }));
}
