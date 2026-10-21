/**
 * The Google key goes in as the whole downloaded file (GOOGLE_SA_JSON), so the
 * owner never has to pick a field out of it. A broken paste reads as "not set
 * up" on the admin page — never a crash.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { sheetsConfigured } from "@/lib/voice/sheets";

afterEach(() => vi.unstubAllEnvs());

describe("Google sheet credentials", () => {
  it("the whole key file is enough", () => {
    vi.stubEnv("GOOGLE_SA_JSON", JSON.stringify({ client_email: "robot@x.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n" }));
    expect(sheetsConfigured()).toBe(true);
  });
  it("⚠️ a half-pasted file is 'not set up', not a crash", () => {
    vi.stubEnv("GOOGLE_SA_JSON", '{"client_email": "robot@x');
    expect(sheetsConfigured()).toBe(false);
  });
  it("the two-variable way still works", () => {
    vi.stubEnv("GOOGLE_SA_JSON", "");
    vi.stubEnv("GOOGLE_SA_EMAIL", "robot@x.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_SA_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----");
    expect(sheetsConfigured()).toBe(true);
  });
  it("nothing set ⇒ not set up", () => {
    vi.stubEnv("GOOGLE_SA_JSON", "");
    vi.stubEnv("GOOGLE_SA_EMAIL", "");
    vi.stubEnv("GOOGLE_SA_PRIVATE_KEY", "");
    expect(sheetsConfigured()).toBe(false);
  });
});
