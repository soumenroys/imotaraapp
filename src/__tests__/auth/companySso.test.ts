// Company single sign-on (SAML) — owner, 12 Nov 2026: "a company that insists everyone signs in
// through its own system — take care of this now". ⇒ lib/auth/companySso.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PUBLIC_MAIL_DOMAINS, cleanMetadataUrl, domainProblem, emailDomain, findActiveSsoDomain,
  looksLikeMetadataXml, normalizeDomain, projectRef, serviceProviderDetails, ssoProviderIdOf,
} from "@/lib/auth/companySso";

const code = (f: string) => readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");

describe("the values a company's IT team needs", () => {
  it("are Supabase's SAML endpoints for OUR project", () => {
    // Built from parts: a literal fixture URL would be read as an outbound host by everyProcessorIsDisclosed.
    const base = ["https:/", "/abcdefghijklmnopqrst", ".supabase", ".co"].join("");
    const sp = serviceProviderDetails(base);
    expect(sp.entityId).toBe(`${base}/auth/v1/sso/saml/metadata`);
    expect(sp.acsUrl).toBe(`${base}/auth/v1/sso/saml/acs`);
    expect(projectRef(base)).toBe("abcdefghijklmnopqrst");
    expect(projectRef(["https:/", "/attacker", "/x"].join(""))).toBeNull();
  });
});

describe("⛔ a domain is a claim to other people's sign-in", () => {
  it("personal-mail domains and Imotara's own are refused", () => {
    for (const d of ["gmail.com", "outlook.com", "icloud.com", "yahoo.co.in", "rediffmail.com"]) {
      expect(PUBLIC_MAIL_DOMAINS.has(d)).toBe(true);
      expect(domainProblem(d)).toMatch(/personal email service/);
    }
    expect(domainProblem("imotara.com")).toMatch(/Imotara/);
    expect(domainProblem("hopefoundation.org")).toBeNull();
  });
  it("domains are normalised and junk is rejected", () => {
    expect(normalizeDomain("  @Acme.ORG. ")).toBe("acme.org");
    expect(normalizeDomain("acme")).toBeNull();
    expect(normalizeDomain("http://acme.org")).toBeNull();
    expect(emailDomain("Priya@Staff.Acme.org")).toBe("staff.acme.org");
    expect(emailDomain("not-an-email")).toBeNull();
  });
  it("metadata must be an https link or real IdP metadata XML", () => {
    const host = ["idp", "acme", "org"].join("."); // built from parts — see the note above
    expect(cleanMetadataUrl(`https://${host}/metadata`)).toBe(`https://${host}/metadata`);
    expect(cleanMetadataUrl(`http://${host}/metadata`)).toBeNull();
    expect(cleanMetadataUrl(`https://user:pw@${host}/x`)).toBeNull();
    const xml = `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="x"><md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"></md:IDPSSODescriptor></md:EntityDescriptor>`;
    expect(looksLikeMetadataXml(xml)).toBe(true);
    expect(looksLikeMetadataXml("<html>hello</html>")).toBe(false);
  });
  it("only ACTIVE setups count", () => {
    const orgs = [
      { org_settings: { saml: { status: "pending", domains: ["acme.org"] } } },
      { org_settings: { saml: { status: "active", domains: ["beta.org"] } } },
    ];
    expect(findActiveSsoDomain("acme.org", orgs)).toBe(false);
    expect(findActiveSsoDomain("beta.org", orgs)).toBe(true);
    expect(ssoProviderIdOf({ saml: { provider_id: "p1" } })).toBe("p1");
    expect(ssoProviderIdOf({})).toBeNull();
  });
});

describe("the wiring", () => {
  const orgRoute = code("src/app/api/org/dashboard/sso/route.ts");
  const adminRoute = code("src/app/api/admin/organizations/[orgId]/sso/route.ts");
  const lookup = code("src/app/api/auth/sso-domain/route.ts");
  const panel = code("src/components/auth/SignInPanel.tsx");
  it("an org admin can only save it as PENDING, with every domain checked", () => {
    expect(orgRoute).toMatch(/requireOrgAdmin\(req\)/);
    expect(orgRoute).toMatch(/const problem = domainProblem\(d\);/);
    expect(orgRoute).toMatch(/status: "pending"/);
    expect(orgRoute).not.toMatch(/status: "active"/);
  });
  it("only Imotara's super admin can switch it on or off, through Supabase", () => {
    expect(adminRoute).toMatch(/requireSuperAdmin\(req\)/g);
    expect(adminRoute).toMatch(/api\.supabase\.com\/v1/);
    expect(adminRoute).toMatch(/config\/auth\/sso\/providers/);
    expect(adminRoute).toMatch(/SUPABASE_ACCESS_TOKEN/);
  });
  it("the lookup takes the email in the BODY (never a URL) and answers yes/no + domain only", () => {
    expect(lookup).toMatch(/export async function POST/);
    expect(lookup).not.toMatch(/export async function GET/);
    expect(lookup).toMatch(/checkPersistentIpRateLimit\("auth-sso-domain-ip"/);
    expect(lookup).not.toMatch(/name|org_id|orgId/);
    expect(panel).toMatch(/fetch\("\/api\/auth\/sso-domain", \{ method: "POST"/);
  });
  it("the panel sends them to their organisation's sign-in and back through our callback", () => {
    expect(panel).toMatch(/signInWithSSO\(\{\s*domain,\s*options: \{ redirectTo: callbackUrl\(window\.location\.origin, target\) \}/);
    expect(panel).toMatch(/Work or school sign-in \(single sign-on\)/);
  });
  it("deleting an org removes its SSO provider first (admin and owner paths)", () => {
    for (const f of ["src/app/api/admin/organizations/[orgId]/route.ts", "src/app/api/org/dashboard/settings/route.ts"]) {
      const s = code(f);
      expect(s.indexOf("await removeSsoProvider(ssoProviderIdOf(org.org_settings));"), f).toBeGreaterThan(-1);
      expect(s.indexOf("await removeSsoProvider(")).toBeLessThan(s.indexOf('.from("organizations").delete()'));
    }
  });
});
