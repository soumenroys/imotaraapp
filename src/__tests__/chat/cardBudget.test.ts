// src/__tests__/chat/cardBudget.test.ts
// UX-22. Eight banners already competed for one slot via activeTier2Banner.
// Five more cards rendered with no mutual exclusion at all, so they stacked —
// and the engaged returning user triggered the most of them at once.
//
// Read as source: the failure is "two cards rendered", which no unit test of a
// single component would catch, and rendering the whole chat page in jsdom to
// find out would be a far more fragile test than this.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

const CARDS = ["toneReflection", "moodGlimpse", "openLoop", "companionInsight", "discovery"];

describe("every card goes through the arbiter", () => {
  it("the arbiter exists", () => {
    expect(SRC).toMatch(/const activeCard = useMemo\(\(\)/);
  });

  for (const card of CARDS) {
    it(`${card} renders only when it is the chosen one`, () => {
      expect(SRC).toMatch(new RegExp(`\\{activeCard === "${card}"`));
    });
  }

  it("no card is still rendered on its own condition alone", () => {
    // The exact shape of the bug: a bare `{companionInsight && (` with nothing
    // arbitrating it. Each of these was one of the five.
    for (const bare of [
      /\{companionInsight && \(/,
      /\{activeOpenLoop && \(/,
      /\{discoveryCard && \(/,
      /\{moodGlimpseEnabled && !moodGlimpseDismissedSession && latestMoodHint && \(/,
    ]) {
      expect(SRC).not.toMatch(bare);
    }
  });
});

describe("priority order is time-sensitive before evergreen", () => {
  const body = /const activeCard = useMemo\([\s\S]*?\n  \}, \[/.exec(SRC)?.[0] ?? "";

  it("captures the arbiter body", () => {
    expect(body.length).toBeGreaterThan(100);
  });

  it("orders the returns as agreed with the owner", () => {
    const order = [...body.matchAll(/return "(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["toneReflection", "moodGlimpse", "openLoop", "companionInsight", "discovery"]);
  });
});

describe("what must never be suppressed", () => {
  it("the crisis banner is not gated by the arbiter", () => {
    // A safety rule, not a preference, and not counted against the budget.
    const crisisBlock = /#4: Crisis intervention banner[\s\S]{0,400}/.exec(SRC)?.[0] ?? "";
    expect(crisisBlock.length).toBeGreaterThan(0);
    expect(crisisBlock).not.toMatch(/activeCard/);
  });

  it("the undo toast and voice confirm stay outside the budget", () => {
    // Direct responses to something the person just did — hiding them would
    // break the action rather than tidy the screen.
    expect(SRC).toMatch(/\{pendingUndo && \(/);
    expect(SRC).toMatch(/\{pendingVoiceTranscript && \(/);
  });

  it("the sentiment seed chips stay — an input aid, not a card", () => {
    expect(SRC).toMatch(/\{sentimentChipsEnabled && !sentimentChipsDismissedSession/);
  });
});
