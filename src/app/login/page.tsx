"use client";

// src/app/login/page.tsx
//
// Email + password sign-in — GATED by design to accounts created via the
// admin-provisioning flow (Phase 1). Deliberately NOT wired into the existing
// Google-only entry points (connect/page.tsx, connect/register/page.tsx,
// upgrade/page.tsx) — those stay untouched. This page has no Google button:
// it only ever serves accounts that were provisioned with a password in the
// first place (see org_admin_provisioning_plan memory, decision #4).
//
// Reachable directly (for returning provisioned users) and via ?redirect=
// for a specific destination after sign-in, mirroring the open-redirect
// guard already used by /org/invite/[token]'s settings redirect.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import EyeIcon from "@/components/imotara/EyeIcon";

function getSupabase() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
}

function safeRedirect(raw: string | null): string {
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/org/dashboard";
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = safeRedirect(searchParams.get("redirect"));

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password) {
            setError("Enter your email and password.");
            return;
        }

        setBusy(true);
        try {
            const supabase = getSupabase();
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email:    trimmedEmail,
                password,
            });
            if (signInError) {
                setError("Incorrect email or password.");
                return;
            }
            router.replace(redirectTo);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-14 text-zinc-900 dark:text-zinc-50">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h1 className="text-lg font-semibold">Sign in</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    For organisation accounts set up by an Imotara admin.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                                <EyeIcon open={showPassword} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <div className="mt-4 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <Link href="/auth/forgot-password" className="hover:text-zinc-700 dark:hover:text-zinc-200">
                        Forgot password?
                    </Link>
                    <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
                        Back to imotara.com
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
