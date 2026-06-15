'use client';
// Mobile OAuth relay page.
//
// Flow:
//  1. Supabase OAuth completes and redirects to https://imotara.com/auth/callback-mobile
//     with #access_token=...&refresh_token=... in the URL hash (implicit flow).
//  2. This page reads the hash and immediately redirects to imotara://auth/callback#<tokens>.
//  3. On iOS: ASWebAuthenticationSession (opened by expo-web-browser) intercepts the
//     imotara:// URL and returns {type:"success", url:"imotara://..."} to the app.
//  4. On Android: the system intent fires, bringing the app to foreground. The app's
//     Linking handler in AuthContext processes the imotara://auth/callback URL.
//
// Required Supabase config:
//   Authentication → URL Configuration → Additional Redirect URLs:
//   add https://imotara.com/auth/callback-mobile

import { useEffect, useState } from 'react';

export default function MobileAuthCallback() {
    const [status, setStatus] = useState<'redirecting' | 'error'>('redirecting');

    const [appUrl, setAppUrl] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash;
        const search = window.location.search;

        // Parse tokens from URL hash (implicit flow) or query string (pkce fallback)
        const source = hash.startsWith('#') ? hash.slice(1) : search.startsWith('?') ? search.slice(1) : '';
        const params = new URLSearchParams(source);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
            const url = `imotara://auth/callback#${source}`;
            setAppUrl(url);
            // Redirect to the app — ASWebAuthenticationSession on iOS intercepts imotara://
            // before the navigation completes, returning the URL to the app code.
            // On Android the system intent redirects from the browser to the app.
            window.location.href = url;
        } else {
            setStatus('error');
        }
    }, []);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', fontFamily: 'sans-serif',
            backgroundColor: '#0f172a', color: '#e2e8f0',
            padding: '24px', textAlign: 'center',
        }}>
            {status === 'redirecting' ? (
                <>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
                    <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 20 }}>
                        Signed in — returning to Imotara…
                    </p>
                    {appUrl && (
                        <a
                            href={appUrl}
                            style={{
                                fontSize: 13, color: '#818cf8',
                                textDecoration: 'underline', marginTop: 4,
                            }}
                        >
                            Tap here if the app didn&apos;t open automatically
                        </a>
                    )}
                </>
            ) : (
                <>
                    <p style={{ fontSize: 16, color: '#f87171' }}>
                        Sign-in failed. Please return to the app and try again.
                    </p>
                </>
            )}
        </div>
    );
}
