/**
 * The emergency ADMIN_SECRET must not be able to appoint its own successor,
 * or delete an organisation.
 *
 * 🔴 WHAT IT USED TO DO. The legacy bearer fallback in requireSuperAdmin
 * returned a synthetic identity with `role: "owner"`. Four routes gate on
 * `role === "owner"`, so anyone holding that one environment variable could:
 *
 *   • DELETE any organisation — which cascades its members and their licences;
 *   • CREATE a new owner-role super-admin, turning possession of a shared
 *     secret into permanent access that SURVIVES ROTATING THE SECRET;
 *   • unlock or modify existing super-admins.
 *
 * An emergency key is for getting back in. It is not for granting itself a
 * successor, and not for destroying customer data.
 *
 * 🔑 THIS IS NOT A NEW RULE. requireOwner() already refused this identity
 * outright, on the reasoning that broadcast cannot send mail as a synthetic
 * "legacy" user who is not a row in super_admins. This brings the rest of the
 * owner-gated surface into line with that precedent.
 *
 * ⚠️ Ordinary emergency access is deliberately UNCHANGED: adminAuthorized()
 * and every requireSuperAdmin() caller without an explicit owner check still
 * accept the key. Locking yourself out of read and repair access would be a
 * worse outcome than the escalation this prevents.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AUTH = () => strip(read("src/app/api/admin/_auth.ts"));

describe("the legacy key is not an owner", () => {
  it("the synthetic identity carries role 'admin'", () => {
    const s = AUTH();
    const i = s.indexOf('id: "legacy"');
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 220)).toContain('role: "admin"');
  });

  it("it no longer claims owner anywhere in the fallback", () => {
    const s = AUTH();
    const i = s.indexOf('id: "legacy"');
    expect(s.slice(i, i + 220)).not.toContain('role: "owner"');
  });
});

describe("the owner-gated routes therefore refuse it", () => {
  // These four are the entire reason the grant mattered. Each gates on
  // role === "owner", so an "admin" identity is refused by code that already
  // existed — no new check was added, and none can be forgotten.
  const OWNER_GATED = [
    "src/app/api/admin/organizations/[orgId]/route.ts",
    "src/app/api/admin/super-admins/route.ts",
    "src/app/api/admin/super-admins/[id]/route.ts",
    "src/app/api/admin/super-admins/[id]/unlock/route.ts",
  ];

  it.each(OWNER_GATED)("%s still gates on the owner role", (file) => {
    expect(strip(read(file))).toMatch(/role\s*!==\s*"owner"|role\s*===\s*"owner"/);
  });

  it("deleting an organisation is one of them — it cascades members and licences", () => {
    const s = strip(read("src/app/api/admin/organizations/[orgId]/route.ts"));
    const del = s.slice(s.indexOf("export async function DELETE"));
    expect(del).toMatch(/role\s*!==\s*"owner"/);
  });
});

describe("emergency access itself is NOT removed", () => {
  it("adminAuthorized still accepts the bearer key", () => {
    const s = AUTH();
    const fn = s.slice(s.indexOf("export async function adminAuthorized"),
                       s.indexOf("export async function requireSuperAdmin"));
    expect(fn).toContain("ADMIN_SECRET");
    expect(fn).toContain("timingSafeEqual");
  });

  it("the kill switch still works", () => {
    // ADMIN_SECRET_DISABLED=true must still turn the whole path off.
    expect(AUTH()).toContain("ADMIN_SECRET_DISABLED");
  });

  it("the secret is still compared in constant time", () => {
    // Downgrading the role must not quietly become a rewrite of the compare.
    const s = AUTH();
    expect((s.match(/timingSafeEqual/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(s).toMatch(/auth\.length\s*!==\s*expected\.length|auth\.length\s*===\s*expected\.length/);
  });

  it("requireOwner still rejects the legacy identity outright", () => {
    // The stricter precedent this change follows — do not lose it.
    const s = AUTH();
    const fn = s.slice(s.indexOf("export async function requireOwner"));
    expect(fn).toMatch(/result\.admin\.id\s*===\s*"legacy"/);
  });
});
