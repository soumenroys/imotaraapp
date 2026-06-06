// Isolated layout — no SiteHeader, no footer.
// The auth callback only shows "Signing you in…" then immediately navigates
// away. There is no nav needed, and isolating it prevents SiteHeader
// hydration issues from interfering with the OAuth redirect.
export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
