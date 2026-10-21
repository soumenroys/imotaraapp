/**
 * ⛔ A PAID TRIAL THAT CANNOT PUBLISH, AND CANNOT BE FIRED BY ACCIDENT.
 *
 * The owner asked for characters that move, like a cartoon; this makes one
 * clip from a post's own picture so the owner can judge it. It costs money on
 * every call and must never replace what the publisher serves.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { animationPrompt, findVideo, animatePicture } from "@/lib/social/animatePicture";

const route = readFileSync(join(process.cwd(), "src/app/api/admin/social/animation-trial/[id]/route.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the trial route", () => {
  it("is POST only — opening a link can never spend money", () => {
    expect(route).toMatch(/export async function POST/);
    expect(route).not.toMatch(/export async function GET/);
  });

  it("is owner-only", () => {
    expect(route).toMatch(/requireSocialOwner\(/);
  });

  it("⛔ never reads or writes the published motion.mp4", () => {
    expect(route).not.toMatch(/motion\.mp4|putVideo/);
    expect(route).toMatch(/animation-trial\.mp4/);
  });
});

describe("the instruction keeps the picture's safety clause", () => {
  const p = animationPrompt();
  it("adds no people and no text", () => {
    expect(p).toMatch(/Do not add any new people/);
    expect(p).toMatch(/text, letters, numbers, logos/);
  });
  it("stays calm — no cuts, no zoom, no flashing", () => {
    expect(p).toMatch(/No camera cuts, no zoom, no fast motion, no flashing/);
  });
});

describe("finding the video in the answer", () => {
  it("as inline data in the model_output step", () => {
    const body = { steps: [{ type: "user_input" }, { type: "model_output", content: [{ type: "video", mime_type: "video/mp4", data: "AAA" }] }] };
    expect(findVideo(body)).toEqual({ data: "AAA", uri: undefined });
  });
  it("as a uri", () => {
    expect(findVideo({ steps: [{ content: [{ type: "video", uri: "https://x/y" }] }] })).toEqual({ data: undefined, uri: "https://x/y" });
  });
  it("null when there is none", () => {
    expect(findVideo({ steps: [{ content: [{ type: "text", text: "sorry" }] }] })).toBeNull();
  });
});

describe("failures are answers, not crashes", () => {
  it("an error status is reported with its body", async () => {
    const saved = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test";
    try {
      const fail = (async () => ({ ok: false, status: 400, text: async () => "bad request" })) as unknown as typeof fetch;
      const r = await animatePicture(new Uint8Array([1]), { aspect: "9:16", fetchImpl: fail });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.error).toMatch(/400: bad request/);
    } finally {
      process.env.GEMINI_API_KEY = saved;
    }
  });
});

describe("the request the API actually accepts", () => {
  it("🔴 response_format carries type: video — refused with a 400 without it", async () => {
    const saved = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test";
    let sent: Record<string, unknown> = {};
    try {
      const capture = (async (_u: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return { ok: false, status: 418, text: async () => "stop" };
      }) as unknown as typeof fetch;
      await animatePicture(new Uint8Array([1]), { aspect: "9:16", fetchImpl: capture });
      expect((sent.response_format as Record<string, unknown>).type).toBe("video");
      expect((sent.response_format as Record<string, unknown>).aspect_ratio).toBe("9:16");
      // ⛔ uri delivery is refused unless store is true — and nothing is stored.
      expect((sent.response_format as Record<string, unknown>).delivery).toBeUndefined();
      expect(sent.store).toBe(false);
    } finally {
      process.env.GEMINI_API_KEY = saved;
    }
  });
});
