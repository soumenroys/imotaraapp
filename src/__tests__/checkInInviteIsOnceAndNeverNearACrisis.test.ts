/**
 * 🌙 THE CHECK-IN INVITE ON THE WEB (owner, 25 Oct 2026) — once ever, after a
 * real exchange, never near a crisis, signed-in only (web reminders are a push
 * to the account), and the browser's prompt only after a tap.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasMobileRepo, readMobileFile } from "./helpers/siblingRepo";
import { join } from "node:path";
import { INVITE, getInviteStrings, shouldOfferInvite } from "@/lib/imotara/checkInInviteStrings";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const base = { state: "unseen" as const, userMessageCount: 3, crisisInThread: false, signedIn: true, pushPossible: true };

describe("when the card may appear", () => {
  it("after 3 messages from the person", () => {
    expect(shouldOfferInvite(base)).toBe(true);
    expect(shouldOfferInvite({ ...base, userMessageCount: 2 })).toBe(false);
  });
  it("⛔ never near a crisis, never twice, never for a guest, never where push cannot work", () => {
    expect(shouldOfferInvite({ ...base, crisisInThread: true })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "declined" })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "accepted" })).toBe(false);
    expect(shouldOfferInvite({ ...base, signedIn: false })).toBe(false);
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
  it.runIf(hasMobileRepo())("identical to imotara-mobile's (when that repo sits beside this one)", () => {
    const web = src("src/lib/imotara/checkInInviteStrings.ts");
    const block = (t: string) => t.slice(t.indexOf("export const INVITE"), t.indexOf("export function getInviteStrings"));
    expect(block(web)).toBe(block(readMobileFile("src/notifications/checkInInvite.ts") ?? ""));
  });
});
