"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DevLoginClient() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<string | null>(null);

    async function sendMagicLink() {
        setStatus("Sending magic link…");
        await supabase.auth.signOut();

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=/chat`,
            },
        });

        if (error) setStatus("❌ " + error.message);
        else setStatus("✅ Check your email for the login link");
    }

    async function devPasswordLogin() {
        setStatus("Signing in…");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: "sJan@2026",
        });

        if (error) setStatus("❌ " + error.message);
        else {
            setStatus("✅ Logged in");
            window.location.href = "/chat";
        }
    }

    return (
        <div style={{ padding: 24, maxWidth: 420 }}>
            <h1>Dev Login (Supabase)</h1>

            <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                style={{ width: "100%", padding: 8, marginBottom: 12 }}
            />

            <button onClick={sendMagicLink} style={{ padding: 8, width: "100%" }}>
                Send magic link
            </button>

            <button onClick={devPasswordLogin} style={{ marginTop: 8 }}>
                Dev login (password)
            </button>

            {status && <p style={{ marginTop: 12 }}>{status}</p>}
        </div>
    );
}
