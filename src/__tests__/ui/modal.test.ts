// src/__tests__/ui/modal.test.ts
// UX-08/09. The test environment here is node, with no DOM, so the wrapper's
// actual behaviour — focus trap, Escape, inert, focus restore — is proven in a
// real browser instead (see the commit message). What these guard is the part
// a browser check cannot: that overlays keep USING the wrapper, rather than a
// later change quietly hand-rolling a thirteenth one.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const MIGRATED = [
  "src/components/imotara/GlobalSearch.tsx",
  "src/components/connect/EmergencyModal.tsx",
  "src/components/connect/RechargeModal.tsx",
  "src/components/imotara/UnsentLetterModal.tsx",
  "src/components/imotara/ConflictReviewModal.tsx",
  "src/components/connect/TranslationToggleModal.tsx",
];

describe("the wrapper does what a dialog owes its user", () => {
  const src = read("src/components/ui/Modal.tsx");

  it("declares itself a modal dialog", () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
  });

  it("is always named", () => {
    // An unnamed dialog is announced as just "dialog".
    expect(src).toMatch(/aria-labelledby|aria-label/);
  });

  it("makes the page behind unreachable both ways", () => {
    // inert for the keyboard, aria-hidden for screen readers whose browser
    // does not support inert yet.
    expect(src).toMatch(/setAttribute\("inert"/);
    expect(src).toMatch(/setAttribute\("aria-hidden", "true"\)/);
  });

  it("restores focus on close, not just moves it on open", () => {
    expect(src).toMatch(/returnFocusTo/);
  });

  it("wraps Tab at both ends", () => {
    expect(src).toMatch(/shiftKey/);
  });

  it("puts back what it changed", () => {
    // A dialog that leaves the body scroll-locked breaks the whole page.
    expect(src).toMatch(/document\.body\.style\.overflow = overflow/);
    expect(src).toMatch(/removeAttribute\("inert"\)/);
  });
});

describe("migrated overlays use it", () => {
  for (const file of MIGRATED) {
    it(`${path.basename(file)} renders through Modal`, () => {
      const s = read(file);
      expect(s).toMatch(/from "@\/components\/ui\/Modal"/);
      expect(s).toMatch(/<Modal\b/);
    });

    it(`${path.basename(file)} no longer hand-rolls its own overlay`, () => {
      // The shape being replaced: a bare fixed inset-0 with an onClick close.
      expect(read(file)).not.toMatch(/className="fixed inset-0[^"]*"\s*\n\s*onClick=/);
    });
  }

  it("the wrapper supplies no layout of its own", () => {
    // It used to hardcode `items-center justify-center p-4` on the backdrop,
    // so GlobalSearch — which needs top alignment — carried BOTH items-center
    // and items-start. Tailwind resolves that by stylesheet order, not by the
    // order in the string, so it rendered correctly only by luck.
    const src = read("src/components/ui/Modal.tsx");
    expect(src).toMatch(/backdropClassName = "flex items-center justify-center p-4"/);
    expect(src).not.toMatch(/fixed inset-0 z-\[100\] flex items-center/);
  });

  it("the bottom sheet is still a bottom sheet on a phone", () => {
    // UnsentLetterModal is items-end on mobile and centred from sm up. That
    // layout lives entirely in its own backdropClassName now.
    const s = read("src/components/imotara/UnsentLetterModal.tsx");
    expect(s).toMatch(/items-end justify-center bg-black\/60 sm:items-center/);
  });

  it("the translation modal refuses to close mid-request", () => {
    const s = read("src/components/connect/TranslationToggleModal.tsx");
    expect(s).toMatch(/closeOnEscape=\{!loading\}/);
  });

  it("the payment modal still refuses to close mid-payment", () => {
    // It already guarded the backdrop while loading; Escape had no handler at
    // all, so that gap is what the wrapper closed.
    const s = read("src/components/connect/RechargeModal.tsx");
    expect(s).toMatch(/closeOnEscape=\{!loading\}/);
    expect(s).toMatch(/closeOnBackdrop=\{!loading\}/);
  });
});
