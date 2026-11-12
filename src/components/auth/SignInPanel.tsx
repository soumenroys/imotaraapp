// src/components/auth/SignInPanel.tsx — #134 (owner, 12 Nov 2026): ONE sign-in panel for the whole
// site. Every "Sign in" button calls openSignIn() ⇒ lib/auth/signInOptions.ts.
//
//   · Continue with Google / Microsoft / Apple / LinkedIn — each only once switched on
//   · Email me a code — any email address, a one-time code, no password
//   · Use a password  — sign in; "create an account" and "forgot password" are a code first,
//                       then choose a password (the code proves the address is yours)
// ⛔ Codes are made and emailed by OUR server from OUR mailbox (api/auth/email-code) — no outside
//    mail service, and Supabase's own sign-ups stay off (owner, 12 Nov 2026).
//
// ⛔ Never signs anyone in silently: Google and Microsoft always show the account chooser.
// ⛔ A guest's history carries over exactly as with Google — the same Supabase session event
//    the rest of the site already listens to. Nothing here touches history.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Modal from "@/components/ui/Modal";
import {
  CODE_MAX, CODE_MIN, EMAIL_RX, MIN_PASSWORD, OPEN_SIGN_IN_EVENT,
  callbackUrl, enabledEmail, enabledOAuth, friendlyAuthError, safeTarget,
  type OAuthOption,
} from "@/lib/auth/signInOptions";
import { gaEventBeforeLeaving, signInKind } from "@/lib/analytics/gaEvent";

/** Why a code is being sent: just to get in, to make a new password account, or to reset one. */
type Intent = "signin" | "create" | "reset";

type Step =
  | { kind: "choose" }
  | { kind: "code-email"; intent: Intent }
  | { kind: "code-enter"; email: string; intent: Intent }
  | { kind: "set-password"; intent: Intent; createdAt?: string }
  | { kind: "password" };

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
  const dialogRef = useRef<HTMLDivElement>(null);

  const oauth = enabledOAuth();
  const emailMethods = enabledEmail();

  const reset = useCallback(() => {
    setStep({ kind: "choose" }); setBusy(null); setError(""); setPassword(""); setCode("");
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ target?: string; intent?: Intent; email?: string }>).detail ?? {};
      const t = safeTarget(d.target);
      setTarget(t); reset();
      // Opened at a particular email step (e.g. the "Forgot password" page): go straight there.
      if (d.intent && enabledEmail().length > 0) {
        if (d.email) setEmail(d.email);
        setStep({ kind: "code-email", intent: d.intent });
        setOpen(true);
        return;
      }
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
    if (step.kind !== "code-email") return;
    const em = email.trim().toLowerCase();
    if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
    setBusy("code"); setError("");
    try {
      const r = await fetch("/api/auth/email-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, purpose: step.intent === "reset" ? "reset" : "signin" }),
      });
      setBusy(null);
      // Our limit is per hour (5 codes per address) — "a minute" would send them back too soon.
      if (r.status === 429) { setError("You've asked for several codes already. Please use the latest code we sent, or wait up to an hour before asking again."); return; }
      if (!r.ok) { setError("We couldn't send the code just now. Please try again in a minute."); return; }
      setCode(""); setStep({ kind: "code-enter", email: em, intent: step.intent });
    } catch { setBusy(null); setError(friendlyAuthError(null)); }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "code-enter") return;
    const token = code.replace(/\D/g, "");
    if (token.length < CODE_MIN || token.length > CODE_MAX) { setError("Please type the whole code from the email."); return; }
    setBusy("verify"); setError("");
    const { data, error: err } = await client().auth.verifyOtp({ email: step.email, token, type: "email" });
    if (err || !data.session) { setBusy(null); setError(friendlyAuthError(err?.message)); return; }
    // Signed in. A new password, or a reset, is chosen next — the code has proved the address.
    if (step.intent !== "signin") { setBusy(null); setPassword(""); setStep({ kind: "set-password", intent: step.intent, createdAt: data.user?.created_at }); return; }
    await finish(data.user?.created_at, "email_code");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "set-password") return;
    if (password.length < MIN_PASSWORD) { setError(`Please use a password of at least ${MIN_PASSWORD} characters.`); return; }
    setBusy("save"); setError("");
    const { error: err } = await client().auth.updateUser({ password });
    if (err) { setBusy(null); setError(friendlyAuthError(err.message)); return; }
    await finish(step.createdAt, "email_password");
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
    if (!password) { setError("Please enter your password."); return; }
    setBusy("password"); setError("");
    const { data, error: err } = await client().auth.signInWithPassword({ email: em, password });
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
                  <button type="button" disabled={!!busy} onClick={() => { setError(""); setStep({ kind: "code-email", intent: "signin" }); }} className={btn}>Email me a code</button>
                )}
                {emailMethods.includes("password") && (
                  <button type="button" disabled={!!busy} onClick={() => { setError(""); setStep({ kind: "password" }); }} className={btn}>Use a password</button>
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
            <label className="block text-sm text-zinc-300" htmlFor="signin-email">
              {step.intent === "create" ? "Your email — any address works. We'll send a code to confirm it, then you choose a password."
                : step.intent === "reset" ? "Your email — we'll send a code, then you choose a new password."
                : "Your email — any address works"}
            </label>
            <input id="signin-email" autoFocus data-autofocus type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "code" ? "Sending…" : "Send me a code"}</button>
            {back}
          </form>
        )}

        {step.kind === "code-enter" && (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-sm text-zinc-300">We sent a code to <span className="font-medium text-zinc-100">{step.email}</span>. It can take a minute — check spam too.</p>
            <input autoFocus data-autofocus type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_MAX + 2} value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345678" aria-label="The code from the email" className={`${input} text-center tracking-[0.4em]`} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "verify" ? "Checking…" : step.intent === "signin" ? "Sign in" : "Continue"}</button>
            <div className="flex justify-between">
              <button type="button" onClick={() => { setError(""); setStep({ kind: "code-email", intent: step.intent }); }} className="text-xs text-zinc-400 hover:text-zinc-200">Send a new code</button>
              {back}
            </div>
          </form>
        )}

        {step.kind === "password" && (
          <form onSubmit={withPassword} className="space-y-3">
            <input autoFocus data-autofocus type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email — any address" aria-label="Email" className={input} />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" className={input} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "password" ? "One moment…" : "Sign in"}</button>
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <button type="button" onClick={() => { setError(""); setPassword(""); setStep({ kind: "code-email", intent: "create" }); }} className="text-sky-300 hover:underline">New here? Create an account</button>
              <button type="button" onClick={() => { setError(""); setPassword(""); setStep({ kind: "code-email", intent: "reset" }); }} className="text-zinc-400 hover:text-zinc-200">Forgot password?</button>
            </div>
            {back}
          </form>
        )}

        {step.kind === "set-password" && (
          <form onSubmit={savePassword} className="space-y-3">
            <p className="text-sm text-zinc-300">{step.intent === "reset" ? "You're in. Choose a new password:" : "Your email is confirmed. Choose a password:"}</p>
            <input autoFocus data-autofocus type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} aria-label="New password" className={input} />
            <button type="submit" disabled={!!busy} className={primary}>{busy === "save" ? "Saving…" : "Save and continue"}</button>
          </form>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
