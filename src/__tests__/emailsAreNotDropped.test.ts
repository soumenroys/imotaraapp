// 12 Nov 2026: the org invite email was `void sendInviteEmail(…)` — the route answered first and the
// serverless function could stop before the mail left (seen live: "Invite sent", nothing arrived).
// The same shape sat in 10 more places (new-org alert, payment activation alert, Connect booking
// confirmation, counsellor registration, session completion, verification decision, admin alerts).
// They now run in `after()` — after the response, and Vercel keeps the function alive until done.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? routes(p) : /route\.ts$/.test(n) ? [p] : [];
  });
}
const code = (f: string) => readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");

describe("no API route fires an email and forgets it", () => {
  const files = routes("src/app/api");
  it("finds the routes", () => expect(files.length).toBeGreaterThan(50));
  it("no `void sendX(` anywhere in a route", () => {
    const offenders = files.filter((f) => /\bvoid\s+send[A-Z]\w*\(/.test(code(f)));
    expect(offenders).toEqual([]);
  });
  it("the ten converted sends run inside after()", () => {
    const want: Array<[string, string]> = [
      ["src/app/api/payments/razorpay/webhook/route.ts", "sendActivationAlert"],
      ["src/app/api/org/dashboard/settings/route.ts", "sendDeletionAlert"],
      ["src/app/api/org/new/route.ts", "sendAdminAlert"],
      ["src/app/api/admin/organizations/[orgId]/route.ts", "sendOrgVerificationDecisionEmail"],
      ["src/app/api/admin/organizations/[orgId]/route.ts", "sendAdminDeletionAlert"],
      ["src/app/api/admin/users/[userId]/route.ts", "sendAdminUserDeletionAlert"],
      ["src/app/api/connect/consultant/register/route.ts", "sendRegistrationEmails"],
      ["src/app/api/connect/sessions/route.ts", "sendSessionRequestEmail"],
      ["src/app/api/connect/sessions/[id]/tick/route.ts", "sendCompletionEmails"],
    ];
    for (const [f, fn] of want) {
      const src = code(f);
      expect(src, f).toMatch(/import \{[^}]*\bafter\b[^}]*\} from "next\/server"/);
      expect(src, `${f} ${fn}`).toMatch(new RegExp(`after\\(async \\(\\) => \\{[\\s\\S]{0,400}?await ${fn}\\(`));
    }
  });
});
