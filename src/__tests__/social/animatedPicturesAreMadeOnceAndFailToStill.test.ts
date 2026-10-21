/**
 * 🔑 ANIMATED PICTURES — YOUTUBE FIRST, AND NEVER AT THE COST OF A POST.
 *
 * Owner, 21 Oct: "its perfect now", option A — YouTube first, Facebook and
 * Instagram after one test. Each clip costs money, so it is made once, at
 * approval, and kept; and a failure anywhere means the still-picture video,
 * never a failed approval.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const storage = { kept: null as Blob | null, uploads: [] as string[] };
const animate = vi.fn();
const picture = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        download: async () => (storage.kept ? { data: storage.kept, error: null } : { data: null, error: { message: "nf" } }),
        upload: async (path: string) => {
          storage.uploads.push(path);
          return { error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/social/cardStore", () => ({ CARD_BUCKET: "social-cards", getIllustration: (id: string) => picture(id) }));
vi.mock("@/lib/social/animatePicture", () => ({ animatePicture: (...a: unknown[]) => animate(...a) }));

import { ensureAnimatedPicture, ANIMATED_PLATFORMS } from "@/lib/social/ensureAnimatedPicture";

beforeEach(() => {
  storage.kept = null;
  storage.uploads = [];
  animate.mockReset();
  picture.mockReset();
  picture.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe("which channels", () => {
  it("YouTube, Facebook and Instagram — all in the model's 9:16 shape", () => {
    expect(ANIMATED_PLATFORMS).toEqual({ youtube: "9:16", facebook: "9:16", instagram: "9:16" });
  });

  it("⛔ a channel not switched on never pays for a clip", async () => {
    expect(await ensureAnimatedPicture("p", "x")).toBeUndefined();
    expect(await ensureAnimatedPicture("p", "linkedin")).toBeUndefined();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe("made once, kept", () => {
  it("reuses a kept clip — a re-render never pays twice", async () => {
    storage.kept = new Blob([new Uint8Array([9, 9])]);
    const r = await ensureAnimatedPicture("p", "youtube");
    expect(r).toEqual(new Uint8Array([9, 9]));
    expect(animate).not.toHaveBeenCalled();
  });

  it("makes and keeps one when there is none", async () => {
    animate.mockResolvedValue({ ok: true, mp4: new Uint8Array([7]), ms: 1 });
    const r = await ensureAnimatedPicture("p", "youtube");
    expect(r).toEqual(new Uint8Array([7]));
    expect(storage.uploads).toEqual(["p/animation.mp4"]);
  });
});

describe("⛔ failure is the still picture, never a failed post", () => {
  it("the model fails ⇒ undefined", async () => {
    animate.mockResolvedValue({ ok: false, error: "busy" });
    expect(await ensureAnimatedPicture("p", "youtube")).toBeUndefined();
  });

  it("no picture ⇒ undefined, and nothing is paid for", async () => {
    picture.mockResolvedValue(null);
    expect(await ensureAnimatedPicture("p", "youtube")).toBeUndefined();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe("the approval passes it on", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/social/ensureCard.ts"), "utf8");
  it("ensureCard asks for the clip and hands it to the renderer", () => {
    expect(src).toMatch(/await ensureAnimatedPicture\(postId, post\.platform as string\)/);
    expect(src).toMatch(/\{ animatedBackground \}/);
  });
  it("and the approval route has time for it", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/admin/social/posts/[id]/route.ts"), "utf8");
    expect(route).toMatch(/export const maxDuration = 300;/);
  });
});

describe("🔴 too much movement behind the letters ⇒ the still picture", () => {
  const render = readFileSync(join(process.cwd(), "src/lib/social/renderAnimation.ts"), "utf8");
  const anim = readFileSync(join(process.cwd(), "src/lib/social/animate.ts"), "utf8");
  it("the limit is the measured 2.5", () => {
    expect(anim).toMatch(/export const MAX_MOTION_BEHIND_WORDS = 2\.5;/);
  });
  it("is checked before the clip is used, and falls back to the still", () => {
    const at = render.indexOf("await motionBehindWords(");
    expect(at).toBeGreaterThan(-1);
    const after = render.slice(at, at + 900);
    expect(after).toMatch(/motion > MAX_MOTION_BEHIND_WORDS/);
    expect(after).toMatch(/return renderAnimation\(post, format\)/);
    expect(at).toBeLessThan(render.indexOf("await pingPong("));
  });
  it("⛔ uses only filters production's 2018 ffmpeg has", () => {
    const body = anim.slice(anim.indexOf("export async function motionBehindWords"));
    for (const f of body.match(/"-vf", `([^`]*)`/g) ?? []) {
      expect(f).not.toMatch(/zoompan|normalize|scale2ref|xfade|maskedmerge/);
    }
  });
});

describe("the instruction keeps open space still", () => {
  it("names it", async () => {
    const { animationPrompt } = await vi.importActual<typeof import("@/lib/social/animatePicture")>("@/lib/social/animatePicture");
    expect(animationPrompt()).toMatch(/nothing drifts, floats or travels across open space/);
  });
});
