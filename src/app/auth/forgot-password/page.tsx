"use client";

// src/app/auth/forgot-password/page.tsx
//
// Requests a password-reset email for end-user (gated, admin-provisioned)
// accounts — mirrors the admin system's forgot-password UX
// (src/app/api/admin/auth/forgot-password/route.ts) on the Supabase-user
// side. The reset link redirects to /auth/accept, which already knows how
// to establish a session from a Supabase auth link and prompt for a new
// password (same UI whether the link came from an invite or a reset).
//
// Always shows the same confirmation regardless of whether the email
// exists, to avoid leaking which addresses have an Imotara account.

import { Suspense, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
}

function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) return;

        setBusy(true);
        try {
            const supabase = getSupabase();
            const redirectTo = `${window.location.origin}/auth/accept`;
            await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
        } finally {
            // Always show the same result — don't reveal whether the email
            // has an account.
            setBusy(false);
            setDone(true);
        }
    }

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-14 text-zinc-900 dark:text-zinc-50">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h1 className="text-lg font-semibold">Reset your password</h1>

                {done ? (
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                        If that email belongs to an Imotara organisation account, a reset link has been sent. Check your inbox.
                    </p>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Enter the email for your organisation account.
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
                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                                {busy ? "Sending…" : "Send reset link"}
                            </button>
                        </form>
                    </>
                )}

                <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <Link href="/login" className="hover:text-zinc-700 dark:hover:text-zinc-200">
                        Back to sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense>
            <ForgotPasswordForm />
        </Suspense>
    );
}
