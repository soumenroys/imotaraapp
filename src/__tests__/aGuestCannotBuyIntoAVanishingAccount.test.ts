/**
 * 💳 A purchase never lands on a GUEST identity (25 Oct 2026). On the phone a guest's
 * session is anonymous; a plan bought onto it vanishes on reinstall. Checked live:
 * 0 paid purchases on anonymous accounts so far (309 grandfathered Plus are — and
 * stay, they are not purchases). This is the server backstop.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("purchase verification refuses an anonymous caller", () => {
  it("Google Play", () => expect(src("src/app/api/payments/google-play/verify/route.ts"))
    .toMatch(/if \(authData\?\.user\?\.is_anonymous\) return NextResponse\.json\(\{ ok: false, error: "sign_in_required" \}, \{ status: 403 \}\);/));
  it("Apple (purchase and restore share resolveUserId)", () => expect(src("src/app/api/license/verify-apple-purchase/route.ts"))
    .toMatch(/if \(data\?\.user\?\.is_anonymous\) return null;\s*return data\?\.user\?\.id \?\? null;/));
});
