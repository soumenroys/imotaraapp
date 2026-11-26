/**
 * 🔴 A VIDEO DRAFT HAD NO PREVIEW AT ALL (26 Nov 2026).
 *
 * The admin drew a picture only for "graphic" and "carousel", so a short_video or
 * animated_gif draft showed its words and nothing else. The owner approved the Sun 6 Dec
 * Instagram video without seeing it. The video is encoded only at approval, and the public
 * video route serves approved posts only — so a reviewer had no way to look.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const route = read("src/app/api/admin/social/video/[id]/route.ts");
const code = route.replace(/\/\/.*$/gm, "");
const page = read("src/app/admin/social/page.tsx");
const preview = read("src/app/admin/social/_components/VideoPreview.tsx");

describe("the admin video preview route", () => {
  it("checks the admin sign-in before touching the database", () => {
    const g = code.indexOf("requireSocialAdmin(req)");
    expect(g).toBeGreaterThan(-1);
    expect(g).toBeLessThan(code.indexOf("getSupabaseAdmin()"));
  });

  it("serves the STORED video first — the exact bytes that publish", () => {
    expect(code.indexOf("await getVideo(id, format)")).toBeGreaterThan(-1);
    expect(code.indexOf("await getVideo(id, format)")).toBeLessThan(code.indexOf("await renderAnimation("));
  });

  it("⛔ a preview never spends the paid moving-background clip, and never stores anything", () => {
    expect(code).not.toContain("ensureAnimatedPicture");
    expect(code).not.toContain("animatedBackground");
    expect(code).not.toContain("putVideo");
    expect(code).not.toMatch(/\.update\(/);
  });

  it("says which one it served", () => {
    expect(code).toContain('"x-imotara-preview": "stored"');
    expect(code).toContain('"x-imotara-preview": "rendered"');
  });

  it("only exports what a Next route file may export", () => {
    const exported = [...code.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((m) => m[1]);
    for (const name of exported) expect(["GET", "maxDuration", "runtime", "dynamic"]).toContain(name);
  });
});

describe("the admin page shows it", () => {
  it("renders the video preview for short_video and animated_gif posts", () => {
    expect(page).toContain("{isVideoKind(post.media_kind) && <VideoPreview post={post} />}");
    expect(page).toContain('import { VideoPreview, isVideoKind } from "@/app/admin/social/_components/VideoPreview"');
    expect(preview).toContain('return kind === "short_video" || kind === "animated_gif";');
    expect(preview).toContain("`/api/admin/social/video/${id}`");
  });

  it("a GIF for X is shown as a picture, everything else as a playable video", () => {
    expect(preview).toContain('const gif = post.media_kind === "animated_gif" && post.platform === "x";');
    expect(preview).toMatch(/<video[\s\S]{0,200}controls/);
  });
});
