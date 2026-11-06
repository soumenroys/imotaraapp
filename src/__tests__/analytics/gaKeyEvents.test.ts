// src/__tests__/analytics/gaKeyEvents.test.ts — #76, 6 Nov 2026: GA had 0 key events.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

type Call = unknown[];
let calls: Call[];
let store: Record<string, string>;

beforeEach(() => {
  vi.resetModules();
  calls = [];
  store = {};
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
  const w: Record<string, unknown> = {
    location: { pathname: "/chat" },
    gtag: (...a: unknown[]) => calls.push(a),
  };
  vi.stubGlobal("window", w);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  });
});

describe("GA key events", () => {
  it("first_message is sent ONCE per device, however many messages follow", async () => {
    const { noteFirstMessageForGa } = await import("@/lib/analytics/gaEvent");
    noteFirstMessageForGa(); noteFirstMessageForGa(); noteFirstMessageForGa();
    expect(calls.filter((c) => c[1] === "first_message")).toHaveLength(1);
  });

  it("⛔ nothing personal travels — only the name and send_to (plus a provider for sign-up)", async () => {
    const { gaEvent } = await import("@/lib/analytics/gaEvent");
    gaEvent("sign_up", { method: "google" });
    expect(calls[0]).toEqual(["event", "sign_up", { method: "google", send_to: "G-TEST" }]);
  });

  it("our own admin pages send nothing", async () => {
    (globalThis as unknown as { window: { location: { pathname: string } } }).window.location.pathname = "/admin/social";
    const { gaEvent } = await import("@/lib/analytics/gaEvent");
    gaEvent("first_message");
    expect(calls).toHaveLength(0);
  });

  it("storage that refuses ⇒ send nothing, rather than a first_message on every message", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const { noteFirstMessageForGa } = await import("@/lib/analytics/gaEvent");
    noteFirstMessageForGa(); noteFirstMessageForGa();
    expect(calls).toHaveLength(0);
  });

  it("a sign-in that created the account minutes ago is a sign_up; an old account is a login", async () => {
    const { signInKind } = await import("@/lib/analytics/gaEvent");
    const now = Date.parse("2026-11-06T06:00:00Z");
    expect(signInKind("2026-11-06T05:58:00Z", now)).toBe("sign_up");
    expect(signInKind("2026-10-01T00:00:00Z", now)).toBe("login");
    expect(signInKind(undefined, now)).toBe("login");
  });

  it("the chat page and the sign-in callback actually send them", () => {
    expect(readFileSync("src/app/chat/page.tsx", "utf8")).toMatch(/noteMessageSent\(\);\n\s+noteFirstMessageForGa\(\);/);
    expect(readFileSync("src/app/auth/callback/page.tsx", "utf8")).toMatch(/gaEvent\(signInKind\(session\.user\?\.created_at\)/);
  });
});
