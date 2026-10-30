/**
 * 🔴 FROM 30 OCT 2026 A NEW PUBLIC TABLE NEEDS ITS OWN GRANTs — or the API
 * answers "permission denied" ⇒ trap_new_supabase_tables_need_explicit_grants.
 *
 * Tables created before that date keep working, so the SQL files that create
 * them without a GRANT are listed here as grandfathered. ⛔ Any OTHER file
 * under docs/sql that creates a table must carry a GRANT (service_role too).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GRANDFATHERED = new Set([
  "org_schema.sql",
  "social_channel_stats.sql",
  "admin_password_resets.sql",
  "blog_comments.sql",
  "connect_schema.sql",
  "connect_v11_user_bans.sql",
  "connect_v12_user_profiles.sql",
  "connect_v2_features.sql",
  "crisis_events_v1.sql",
  "cron_heartbeats.sql",
  "imotara_wallet_migration.sql",
  "imotara_wallet_v3_ultra_safe.sql",
  "org_audit_log.sql",
  "org_phase2_features.sql",
  "payment_invoices.sql",
  "social_platform_dials.sql",
  "social_slot_attempts.sql",
  "super_admins.sql",
  "super_admins_security.sql",
  "usage_events.sql",
]);

describe("a new table ships with its GRANTs", () => {
  it("every docs/sql file that creates a table grants access (or predates 30 Oct 2026)", () => {
    const dir = join(process.cwd(), "docs/sql");
    const missing = readdirSync(dir)
      .filter((f) => f.endsWith(".sql") && !GRANDFATHERED.has(f))
      .filter((f) => {
        const sql = readFileSync(join(dir, f), "utf8");
        return /create table/i.test(sql) && !/\bgrant\b/i.test(sql);
      });
    expect(missing, "add GRANT ... TO authenticated / service_role in these files").toEqual([]);
  });
});
