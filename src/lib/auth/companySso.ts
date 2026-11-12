// src/lib/auth/companySso.ts — company single sign-on (SAML: Okta, Microsoft Entra, Google
// Workspace, OneLogin, …). Owner, 12 Nov 2026: "a company that insists everyone signs in through
// its own system — take care of this now".
//
// HOW IT FITS TOGETHER
//   1. An org admin (dashboard ⇒ Settings ⇒ SSO) gives their identity provider's METADATA (a URL,
//      or the XML) and their email DOMAIN(s). Saved as `pending` in organizations.org_settings.saml.
//   2. Imotara's owner presses "Activate SSO" in /admin — the server registers the provider with
//      Supabase (Management API, SUPABASE_ACCESS_TOKEN) and stores its id; status `active`.
//   3. On the sign-in panel, an email at an ACTIVE domain offers "Continue with your organisation's
//      sign-in" ⇒ supabase.auth.signInWithSSO({ domain }) ⇒ their IdP ⇒ back, signed in.
//
// ⛔ A domain is a claim to OTHER PEOPLE'S sign-in. Personal-mail domains are refused outright, and
//    nothing goes live without Imotara's owner activating it (who checks the org owns the domain).
// ⚠️ Supabase does not link an SSO identity to an existing email/password account with the same
//    address — the same person can end up with two accounts. Said in the dashboard copy.

/** The values a company's IT team types into their identity provider. */
export function serviceProviderDetails(supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") {
  const base = supabaseUrl.replace(/\/+$/, "");
  return {
    entityId: `${base}/auth/v1/sso/saml/metadata`,
    metadataUrl: `${base}/auth/v1/sso/saml/metadata`,
    metadataDownload: `${base}/auth/v1/sso/saml/metadata?download=true`,
    acsUrl: `${base}/auth/v1/sso/saml/acs`,
    nameIdFormat: "emailAddress",
  };
}

/** The Supabase project ref, from its URL (https://<ref>.supabase.co). */
export function projectRef(supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string | null {
  const m = /^https:\/\/([a-z0-9]{10,40})\.supabase\.co\/?$/i.exec(supabaseUrl.trim());
  return m ? m[1] : null;
}

/** Big free/personal mail services: nobody may claim these for company SSO. */
export const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "zoho.com", "zohomail.com", "gmx.com", "gmx.de", "mail.com", "yandex.com", "yandex.ru",
  "rediffmail.com", "qq.com", "163.com", "126.com", "naver.com", "hey.com", "fastmail.com",
  "tutanota.com", "privaterelay.appleid.com",
]);

const DOMAIN_RX = /^(?=.{3,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

/** "  @Acme.ORG " ⇒ "acme.org"; anything that is not a plain domain ⇒ null. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  const d = (raw ?? "").trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  return DOMAIN_RX.test(d) ? d : null;
}

/** The domain part of an email address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  const at = (email ?? "").lastIndexOf("@");
  return at > 0 ? normalizeDomain((email ?? "").slice(at + 1)) : null;
}

/** Why a domain cannot be used for company SSO, or null if it can. */
export function domainProblem(domain: string): string | null {
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return `${domain} is a personal email service — single sign-on needs your organisation's own domain.`;
  if (domain === "imotara.com" || domain.endsWith(".imotara.com")) return "That domain belongs to Imotara.";
  return null;
}

/** An https metadata URL, or null. */
export function cleanMetadataUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

/** Looks like SAML IdP metadata XML (not a full parse — Supabase validates it on activation). */
export function looksLikeMetadataXml(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  return s.length > 100 && s.length < 200_000 && /<(?:\w+:)?EntityDescriptor[\s>]/.test(s) && /IDPSSODescriptor/.test(s);
}

export type OrgSaml = {
  status?: "pending" | "active" | "off";
  metadata_url?: string | null;
  metadata_xml?: string | null;
  domains?: string[];
  provider_id?: string | null;
  activated_at?: string | null;
  // older, pre-12-Nov fields (entity_id / sso_url / certificate / email_domain) may still be present
  [k: string]: unknown;
};

/** The ACTIVE org whose SSO covers this domain, if any. Pure — callers pass the rows. */
export function findActiveSsoDomain(domain: string, orgs: Array<{ org_settings: unknown }>): boolean {
  return orgs.some((o) => {
    const saml = ((o.org_settings ?? {}) as { saml?: OrgSaml }).saml;
    return saml?.status === "active" && Array.isArray(saml.domains) && saml.domains.includes(domain);
  });
}

/**
 * Remove an org's SAML provider from Supabase (server only). Used when an org is DELETED — a provider
 * left behind would keep routing that domain's sign-in to an IdP with no organisation behind it.
 * Never throws; returns whether Supabase confirmed (or it was already gone).
 */
export async function removeSsoProvider(providerId: string | null | undefined): Promise<boolean> {
  const ref = projectRef();
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!providerId || !ref || !token) return !providerId;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth/sso/providers/${providerId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok || res.status === 404;
  } catch { return false; }
}

/** The provider id stored on an org's settings, if any. */
export function ssoProviderIdOf(orgSettings: unknown): string | null {
  const saml = ((orgSettings ?? {}) as { saml?: OrgSaml }).saml;
  return typeof saml?.provider_id === "string" && saml.provider_id ? saml.provider_id : null;
}
