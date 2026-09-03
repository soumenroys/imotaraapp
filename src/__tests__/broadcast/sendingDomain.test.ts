// src/__tests__/broadcast/sendingDomain.test.ts
// from_email is snapshotted from whichever owner created the draft, and this
// platform has two owners — one on @imotara.com and one on a personal Gmail
// address. Without this check the Gmail owner can compose an entire broadcast
// and only discover the problem when the run pauses mid-send.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { canSendFrom, sendingDomain } from "@/lib/broadcast/resendClient";

const original = process.env.RESEND_EMAIL_DOMAIN;
beforeEach(() => { process.env.RESEND_EMAIL_DOMAIN = "imotara.com"; });
afterEach(() => { process.env.RESEND_EMAIL_DOMAIN = original; });

describe("canSendFrom", () => {
  it("accepts an address on the verified domain", () => {
    expect(canSendFrom("suchismita.sen@imotara.com")).toBe(true);
  });

  it("accepts a subdomain of it", () => {
    expect(canSendFrom("noreply@send.imotara.com")).toBe(true);
  });

  it("refuses another owner's personal address", () => {
    expect(canSendFrom("soumenroys@gmail.com")).toBe(false);
  });

  it("is not fooled by a lookalike domain", () => {
    // The suffix check must not accept a domain that merely ENDS in ours.
    expect(canSendFrom("attacker@notimotara.com")).toBe(false);
    expect(canSendFrom("attacker@imotara.com.evil.test")).toBe(false);
  });

  it("ignores case and surrounding space", () => {
    expect(canSendFrom("  Suchismita.Sen@Imotara.COM ")).toBe(true);
  });

  it("refuses nothing at all", () => {
    expect(canSendFrom("")).toBe(false);
    expect(canSendFrom(null)).toBe(false);
    expect(canSendFrom(undefined)).toBe(false);
  });

  it("falls back to imotara.com when the variable is unset", () => {
    delete process.env.RESEND_EMAIL_DOMAIN;
    expect(sendingDomain()).toBe("imotara.com");
  });
});
