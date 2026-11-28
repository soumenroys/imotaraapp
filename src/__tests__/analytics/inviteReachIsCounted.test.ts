// #182 (owner 28 Nov 2026, "measure first"): count WHY a chatter who would get the check-in
// invite cannot get it — anonymously, once a day — without changing who is offered it.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FUNNEL_STEPS, parseTallyEvents } from "@/lib/analytics/visitTally";
import { shouldOfferInvite } from "@/lib/imotara/checkInInviteStrings";

const PAGE = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");
const fn = PAGE.slice(PAGE.indexOf("async function maybeOfferInvite"), PAGE.indexOf("// EN-3 — Daily micro check-in"));

describe("#182 invite reach counts", () => {
  it("new steps are added at the end, old numbers unchanged", () => {
    expect(FUNNEL_STEPS).toMatchObject({ invite_shown: 1, get_app_from_other: 25, invite_no_push: 26, invite_no_identity: 27, invite_already_on: 28 });
  });
  it("the server accepts the new steps as plain numbers", () => {
    expect(parseTallyEvents({ events: [{ kind: "funnel", bucket: 26, delta: 1 }, { kind: "funnel", bucket: 28, delta: 1 }] })).toHaveLength(2);
  });
  it("who is OFFERED the invite is unchanged (same shouldOfferInvite call, real values)", () => {
    expect(fn).toMatch(/const offer = shouldOfferInvite\(\{ state, userMessageCount: userTexts\.length, crisisInThread, hasIdentity, pushPossible: canPush \}\)/);
  });
  it("a reach count is only for someone who would otherwise be offered it — never in a crisis, never once answered", () => {
    const base = { state: "unseen" as const, userMessageCount: 1, crisisInThread: false, hasIdentity: true, pushPossible: true };
    expect(shouldOfferInvite(base)).toBe(true);
    expect(shouldOfferInvite({ ...base, crisisInThread: true })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "declined" })).toBe(false);
    // the page re-checks with identity + push forced true before counting
    expect(fn).toMatch(/if \(shouldOfferInvite\(\{ state, userMessageCount: userTexts\.length, crisisInThread, hasIdentity: true, pushPossible: true \}\)\) \{\s*tallyFunnel\(!canPush \? "invite_no_push" : "invite_no_identity"\);/);
  });
  it("already subscribed is counted before the card is retired", () => {
    expect(fn).toContain('if (await alreadySubscribed()) { tallyFunnel("invite_already_on"); setInviteState("accepted"); return; }');
  });
});
