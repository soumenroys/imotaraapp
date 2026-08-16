/**
 * Regression test for the "Show feature discovery cards" Settings toggle
 * added 2026-08-16 (user report: no way to turn off the "Make Imotara
 * yours" style tips short of dismissing each one individually).
 *
 * The real selection logic lives inline inside chat/page.tsx's discovery
 * effect (not exported), so this test locks in the exact same expression
 * against the same localStorage keys the real component reads/writes:
 *   - "imotara.onboarding.discovery.enabled.v1" — master on/off switch
 *   - "imotara.onboarding.discovery.v1" — per-card dismissed-forever list
 */

import { describe, it, expect } from "vitest";

const DISCOVERY_CARD_ORDER = ["trends", "companion", "offline", "unsent_letter", "connect_translation"] as const;
type DiscoveryCardId = (typeof DISCOVERY_CARD_ORDER)[number];

// Mirrors chat/page.tsx's discovery-card effect exactly.
function pickNextDiscoveryCard(
  enabledRaw: string | null,
  dismissedRaw: string | null,
): DiscoveryCardId | null {
  if (enabledRaw === "0") return null;
  const dismissed: DiscoveryCardId[] = JSON.parse(dismissedRaw ?? "[]");
  return DISCOVERY_CARD_ORDER.find((id) => !dismissed.includes(id)) ?? null;
}

describe("feature discovery card — master toggle gating", () => {
  it("toggle off (enabled key = '0') suppresses every card, even undismissed ones", () => {
    expect(pickNextDiscoveryCard("0", null)).toBeNull();
    expect(pickNextDiscoveryCard("0", "[]")).toBeNull();
  });

  it("toggle absent (never touched) behaves as enabled — default is on", () => {
    expect(pickNextDiscoveryCard(null, null)).toBe("trends");
  });

  it("toggle explicitly on ('1') behaves the same as absent", () => {
    expect(pickNextDiscoveryCard("1", null)).toBe("trends");
  });

  it("with the toggle on, still cycles through undismissed cards in order", () => {
    expect(pickNextDiscoveryCard("1", JSON.stringify(["trends", "companion"]))).toBe("offline");
  });

  it("with the toggle on and everything dismissed, no card is shown (distinct from toggle-off)", () => {
    expect(pickNextDiscoveryCard("1", JSON.stringify([...DISCOVERY_CARD_ORDER]))).toBeNull();
  });
});
