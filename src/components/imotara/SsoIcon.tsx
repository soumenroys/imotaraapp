// src/components/imotara/SsoIcon.tsx
// Provider-agnostic "sign in" icon. Used instead of a Google-branded mark so
// this button doesn't visually commit to one identity provider — Imotara's
// org-level SSO/SAML support is planned, and the underlying provider behind
// this button may not always be Google. Inherits text color via currentColor,
// same convention as EyeIcon.

export default function SsoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="8" cy="14.5" r="3.5" />
      <path d="M10.5 12 19 3.5" />
      <path d="M15.5 7 18 9.5" />
      <path d="M18.5 4 21 6.5" />
    </svg>
  );
}
