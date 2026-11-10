/**
 * 🌙 THE CHECK-IN INVITE ON THE WEB (owner, 25 Oct 2026) — once ever, after a
 * real exchange, never near a crisis, and the browser's prompt only after a tap.
 * #16 (owner, 10 Nov 2026): A — guests too (their anonymous identity owns the
 * reminder); B — after 2 messages, not 3.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasMobileRepo, readMobileFile } from "./helpers/siblingRepo";
import { join } from "node:path";
import { INVITE, INVITE_MIN_MESSAGES, getInviteStrings, shouldOfferInvite } from "@/lib/imotara/checkInInviteStrings";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const base = { state: "unseen" as const, userMessageCount: 2, crisisInThread: false, hasIdentity: true, pushPossible: true };

describe("when the card may appear", () => {
  it("after 2 messages from the person (#16 B), not before", () => {
    expect(INVITE_MIN_MESSAGES).toBe(2);
    expect(shouldOfferInvite(base)).toBe(true);
    expect(shouldOfferInvite({ ...base, userMessageCount: 1 })).toBe(false);
  });
  it("#16 A: a guest with an identity is invited; nobody without one", () => {
    const page = src("src/app/chat/page.tsx");
    expect(page).toMatch(/hasIdentity: signedInCookiePresent\(document\.cookie\) \|\| Boolean\(await guestChatToken\(\)\)/);
    expect(shouldOfferInvite({ ...base, hasIdentity: false })).toBe(false);
  });
  it("#16 A: a guest's reminder is saved, re-timed and removed under THEIR identity", () => {
    const lib = src("src/lib/imotara/enableDailyCheckIn.ts");
    expect(lib).toMatch(/Authorization: `Bearer \$\{token\}`/);
    expect(lib).toMatch(/fetch\("\/api\/push\/subscribe", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json", \.\.\.who \}/);
    const settings = src("src/app/settings/page.tsx");
    expect(settings).toMatch(/method: "DELETE", headers: await reminderAuthHeaders\(\)/);
    expect(settings.match(/reminderAuthHeaders\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("⛔ never near a crisis, never twice, never where push cannot work", () => {
    expect(shouldOfferInvite({ ...base, crisisInThread: true })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "declined" })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "accepted" })).toBe(false);
    expect(shouldOfferInvite({ ...base, pushPossible: false })).toBe(false);
  });
  it("the chat checks distress across the WHOLE conversation", () =>
    expect(src("src/app/chat/page.tsx")).toMatch(/const userTexts = msgs\.filter\(\(m\) => m\.role === "user"\)[\s\S]{0,200}isCrisisTier2\(t\) \|\| CRISIS_TIER1_RE\.test\(t\)/));
  it("a card under the replies — never inside one, never saved to the thread", () => {
    const page = src("src/app/chat/page.tsx");
    expect(page).toMatch(/\{inviteLang && \(\s*<CheckInInviteCard/);
    expect(page).not.toMatch(/isCheckInInvite/);
  });
});

describe("the browser's permission prompt only after a tap", () => {
  it("only enableDailyCheckIn asks, and only the card's time buttons call it", () => {
    expect(src("src/lib/imotara/enableDailyCheckIn.ts")).toMatch(/Notification\.requestPermission\(\)/);
    expect(src("src/app/chat/page.tsx")).not.toMatch(/requestPermission/);
    expect(src("src/components/imotara/CheckInInviteCard.tsx")).toMatch(/onClick=\{\(\) => void pick\(INVITE_HOURS\.evening\)\}/);
  });
});

describe("its words in 22 languages — the same as the phone's", () => {
  it("every line written, the time inside the confirmation", () => {
    expect(Object.keys(INVITE)).toHaveLength(22);
    for (const s of Object.values(INVITE)) {
      for (const k of ["q", "sub", "choose", "later", "blocked"] as const) expect(s[k].trim().length).toBeGreaterThan(1);
      expect(s.done("TIME")).toContain("TIME");
    }
    expect(getInviteStrings("bn-IN").q).toBe(INVITE.bn.q);
  });
  // Runs wherever the phone's file exists — CI checks out imotara-mobile's main, which gains it with 1.6.1.
  const mobileInvite = hasMobileRepo() ? readMobileFile("src/notifications/checkInInvite.ts") : null;
  it.runIf(mobileInvite !== null)("identical to imotara-mobile's (when that repo sits beside this one)", () => {
    const web = src("src/lib/imotara/checkInInviteStrings.ts");
    const block = (t: string) => t.slice(t.indexOf("export const INVITE"), t.indexOf("export function getInviteStrings"));
    expect(block(web)).toBe(block(mobileInvite ?? ""));
  });
});
