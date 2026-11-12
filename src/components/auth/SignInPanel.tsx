// src/components/auth/SignInPanel.tsx — #134 (owner, 12 Nov 2026): ONE sign-in panel for the whole
// site. Every "Sign in" button calls openSignIn() ⇒ lib/auth/signInOptions.ts.
//
//   · Continue with Google / Microsoft / Apple / LinkedIn — each only once switched on
//   · Email me a code — any email address, a 6-digit code, no password
//   · Use a password  — sign in, or create an account (confirmed by email)
//
// ⛔ Never signs anyone in silently: Google and Microsoft always show the account chooser.
// ⛔ A guest's history carries over exactly as with Google — the same Supabase session event
//    the rest of the site already listens to. Nothing here touches history.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import Modal from "@/components/ui/Modal";
import {
  CODE_LENGTH, EMAIL_RX, MIN_PASSWORD, OPEN_SIGN_IN_EVENT,
  callbackUrl, enabledEmail, enabledOAuth, friendlyAuthError, safeTarget,
  type EmailMethod, type OAuthOption,
} from "@/lib/auth/signInOptions";
import { gaEventBeforeLeaving, signInKind } from "@/lib/analytics/gaEvent";

type Step =
  | { kind: "choose" }
  | { kind: "code-email" }
  | { kind: "code-enter"; email: string }
  | { kind: "password" }
  | { kind: "check-email"; email: string };

function client() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function SignInPanel() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("/chat");
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const oauth = enabledOAuth();
  const emailMethods = enabledEmail();

  const reset = useCallback(() => {
    setStep({ kind: "choose" }); setBusy(null); setError(""); setPassword(""); setCode(""); setCreating(false);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = safeTarget((e as CustomEvent<{ target?: string }>).detail?.target);
      setTarget(t); reset();
      // ⛔ No extra click while Google is the only way in (as it was before #134): go straight there.
      const ways = enabledOAuth();
      if (ways.length === 1 && enabledEmail().length === 0) {
        const o = ways[0];
        void client().auth.signInWithOAuth({
          provider: o.id,
          options: { redirectTo: callbackUrl(window.location.origin, t), scopes: o.scopes, queryParams: o.queryParams },
        });
        return;
      }
      setOpen(true);
    };
    window.addEventListener(OPEN_SIGN_IN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SIGN_IN_EVENT, onOpen);
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    // The field to type in first — never the × (it comes first in the DOM, and Enter there closes
    // the panel: seen 12 Nov, typing went nowhere and Return shut it).
    const t = setTimeout(() => {
      const root = dialogRef.current;
      (root?.querySelector<HTMLElement>("input") ?? root?.querySelector<HTMLElement>('button:not([aria-label="Close"])'))?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open, step.kind]);

  /** Signed in here, without leaving the page: count it like the OAuth callback does, then go on. */
  const finish = useCallback(async (createdAt: string | undefined, method: string) => {
    await gaEventBeforeLeaving(signInKind(createdAt), { method });
    window.location.href = target;
  }, [target]);

  async function withProvider(o: OAuthOption) {
    setBusy(o.id); setError("");
    try {
      const { error: err } = await client().auth.signInWithOAuth({
        provider: o.id,
        options: { redirectTo: callbackUrl(window.location.origin, target), scopes: o.scopes, queryParams: o.queryParams },
      });
      if (err) { setError(friendlyAuthError(err.message)); setBusy(null); }
    } catch { setError(friendlyAuthError(null)); setBusy(null); }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
    setBusy("code"); setError("");
    const { error: err } = await client().auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(window.location.origin, target) },
    });
    setBusy(null);
    if (err) { setError(friendlyAuthError(err.message)); return; }
    setCode(""); setStep({ kind: "code-enter", email: em });
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "code-enter") return;
    const token = code.replace(/\D/g, "");
    if (token.length !== CODE_LENGTH) { setError(`The code has ${CODE_LENGTH} digits.`); return; }
    setBusy("verify"); setError("");
    const { data, error: err } = await client().auth.verifyOtp({ email: step.email, token, type: "email" });
    if (err || !data.session) { setBusy(null); setError(friendlyAuthError(err?.message)); return; }
    await finish(data.user?.created_at, "email_code");
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
    if (password.length < MIN_PASSWORD) { setError(`Please use a password of at least ${MIN_PASSWORD} characters.`); return; }
    setBusy("password"); setError("");
    const sb = client();
    if (creating) {
      const { data, error: err } = await sb.auth.signUp({
        email: em, password,
        options: { emailRedirectTo: callbackUrl(window.location.origin, target) },
      });
      setBusy(null);
      if (err) { setError(friendlyAuthError(err.message)); return; }
      // Confirmation on (the default): no session until they open the link we sent.
      if (!data.session) { setStep({ kind: "check-email", email: em }); return; }
      await finish(data.user?.created_at, "email_password");
      return;
    }
    const { data, error: err } = await sb.auth.signInWithPassword({ email: em, password });
    if (err || !data.session) { setBusy(null); setError(friendlyAuthError(err?.message)); return; }
    await finish(data.user?.created_at, "email_password");
  }

  if (!open) return null;

  const btn = "flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-50";
  const primary = "w-full rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50";
  const input = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-base text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-sky-400/60";
  const back = <button type="button" onClick={() => { setError(""); setStep({ kind: "choose" }); }} className="text-xs text-zinc-400 hover:text-zinc-200">← Other ways to sign in</button>;

  return (
    // The site's one accessible dialog (focus trap, portal, Escape) and its theme-safe glass card —
    // a hand-made zinc-900 box went almost transparent under the light theme (seen 12 Nov).
    <Modal
      open
      onClose={() => { if (!busy) setOpen(false); }}
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      labelledBy="signin-title"
      backdropClassName="flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 sm:items-center"
      className="imotara-glass-card w-full max-w-sm rounded-2xl p-5 shadow-2xl"
    >
      <div ref={dialogRef}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="signin-title" className="text-lg font-bold text-zinc-50">Sign in to Imotara</h2>
          <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Close" className="rounded-full px-2 text-lg text-zinc-400 hover:text-zinc-100">×</button>
        </div>

        {step.kind === "choose" && (
          <div className="space-y-2.5">
            {oauth.map((o) => (
              <button key={o.id} type="button" disabled={!!busy} onClick={() => void withProvider(o)} className={btn}>
                {busy === o.id ? "Opening…" : o.label}
              </button>
            ))}
            {emailMethods.length > 0 && (
              <>
                <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wider text-zinc-500">
                  <span className="h-px flex-1 bg-white/10" />or with any email<span className="h-px flex-1 bg-white/10" />
                </div>
                {emailMethods.includes("code") && (
                  <button type="button" disabled={!!busy} onClick={() => { setError(""); setStep({ kind: "code-email" }); }} className={btn}>Email me a code</button>
                )}
                {emailMethods.includes("password") && (
                  <button type="button" disabled={!!busy} onClick={() => { setError(""); setCreating(false); setStep({ kind: "password" }); }} className={btn}>Use a password</button>
                )}
              </>
            )}
            <p className="pt-1 text-[11px] leading-relaxed text-zinc-500">
              Signing in keeps your history safe and lets you pick it up on any device. You can keep using Imotara without an account.
            </p>
          </div>
        )}

        {step.kind === "code-email" && (
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-sm text-zinc-300" htmlFor="signin-email">Your email — any address works</label>
            <input id="signin-email" autoFocus data-autofocus type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "code" ? "Sending…" : "Send me a code"}</button>
            {back}
          </form>
        )}

        {step.kind === "code-enter" && (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-sm text-zinc-300">We sent a {CODE_LENGTH}-digit code to <span className="font-medium text-zinc-100">{step.email}</span>. It can take a minute — check spam too.</p>
            <input autoFocus data-autofocus type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH + 2} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" aria-label="The code from the email" className={`${input} text-center tracking-[0.4em]`} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "verify" ? "Checking…" : "Sign in"}</button>
            <div className="flex justify-between">
              <button type="button" onClick={() => { setError(""); setStep({ kind: "code-email" }); }} className="text-xs text-zinc-400 hover:text-zinc-200">Send a new code</button>
              {back}
            </div>
          </form>
        )}

        {step.kind === "password" && (
          <form onSubmit={withPassword} className="space-y-3">
            <input autoFocus data-autofocus type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email — any address" aria-label="Email" className={input} />
            <input type="password" autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={creating ? `New password (at least ${MIN_PASSWORD} characters)` : "Password"} aria-label="Password" className={input} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "password" ? "One moment…" : creating ? "Create my account" : "Sign in"}</button>
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <button type="button" onClick={() => { setError(""); setCreating((v) => !v); }} className="text-sky-300 hover:underline">
                {creating ? "I already have an account" : "New here? Create an account"}
              </button>
              {!creating && <Link href="/auth/forgot-password" className="text-zinc-400 hover:text-zinc-200" onClick={() => setOpen(false)}>Forgot password?</Link>}
            </div>
            {back}
          </form>
        )}

        {step.kind === "check-email" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Almost done — we sent a link to <span className="font-medium text-zinc-100">{step.email}</span>. Open it to confirm your email, and you&apos;re in.</p>
            {back}
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
