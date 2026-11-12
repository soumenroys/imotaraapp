// src/__tests__/auth/guestHistoryJoinsAccount.test.ts
// 🔑 #135 (owner chose A, 12 Nov 2026): chats typed as a guest in this browser join the account when
// the person signs in (any way), so they follow them to every device. Found in the #134 live test:
// the guest message was saved under the browser's id; the account had 0 rows; nothing joined them.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { isClaimableScope, rekeyId } from "@/lib/history/claimGuestHistory";

describe("only this browser's own guest id can be moved", () => {
  it.each([
    ["2ibehxfyli5-mui3p7pp", true],          // the real guest id from the live test
    ["local_mwiw9tpk_6xium9yp", true],
    ["198a5f40-edc6-4ad1-8f4e-c0758aec1245", false], // an ACCOUNT id — never
    ["short", false],
    ["has space here", false],
    ["x".repeat(81), false],
    [42, false],
  ])("%s ⇒ %s", (scope, ok) => {
    expect(isClaimableScope(scope)).toBe(ok);
  });
});

describe("re-keying", () => {
  it("moves a record from the guest id to the account id, keeping its own id", () => {
    expect(rekeyId("2ibehxfyli5-mui3p7pp:rec-1", "2ibehxfyli5-mui3p7pp", "acct")).toBe("acct:rec-1");
  });
  it("never touches a record under another id", () => {
    expect(rekeyId("someoneelse:rec-1", "2ibehxfyli5-mui3p7pp", "acct")).toBeNull();
    expect(rekeyId("2ibehxfyli5-mui3p7ppX:rec-1", "2ibehxfyli5-mui3p7pp", "acct")).toBeNull();
  });
});

describe("the move itself", () => {
  const SRC = readFileSync("src/lib/history/claimGuestHistory.ts", "utf8");
  it("escapes the LIKE wildcard — '_' in a guest id must not match other ids", () => {
    expect(SRC).toMatch(/replace\(\/\[\\\\%_\]\/g/);
    expect(SRC).toMatch(/r\.id\.startsWith\(`\$\{deviceScope\}:`\)/);
  });
  it("never overwrites what the account already has", () => {
    expect(SRC).toMatch(/const fresh = moved\.filter\(\(m\) => !taken\.has\(m\.id\)\)/);
  });
  it("moves chat messages too", () => {
    expect(SRC).toMatch(/from\("imotara_chat_messages"\)\s*\.update\(\{ user_scope: userId \}\)\s*\.eq\("user_scope", deviceScope\)/);
  });
});

describe("the route and the browser", () => {
  const ROUTE = readFileSync("src/app/api/history/claim/route.ts", "utf8");
  const HOOK = readFileSync("src/components/auth/GuestHistoryClaim.tsx", "utf8");
  it("a real, signed-in account only — never a guest, never its own id", () => {
    expect(ROUTE).toMatch(/if \(!user \|\| user\.anonymous\)/);
    expect(ROUTE).toMatch(/body\.deviceScope === user\.id/);
  });
  it("rate-limited per account", () => {
    expect(ROUTE).toMatch(/checkPersistentIpRateLimit\("history-claim", `u:\$\{user\.id\}`/);
  });
  it("the browser sends its own guest id — never a Link Key", () => {
    expect(HOOK).toMatch(/const deviceScope = getUserScopeId\(\)/);
    expect(HOOK).not.toMatch(/CHAT_LINK_KEY|linkKey|imotara\.chatLink/i);
  });
  it("runs on every sign-in, and is mounted once in the layout", () => {
    expect(HOOK).toMatch(/event === "SIGNED_IN"/);
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("<GuestHistoryClaim />");
  });
});
