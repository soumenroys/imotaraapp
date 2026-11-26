"use client";

// 🔴 A VIDEO POST HAD NO PREVIEW AT ALL (26 Nov 2026) — the review screen drew a picture
// only for "graphic" and "carousel", so the Sun 6 Dec Instagram video was approved unseen.
// ⇒ /api/admin/social/video/[id]: the stored video after approval, or a preview rendered
// now (same renderer, without the paid moving background) before it.
//
// ⚠️ Lives here, not in page.tsx: that screen has a word ceiling and a single-<img> rule
// (noAdminScreenSpeaksBeforeItHasBeenTold, aCardThatFailsSaysWhy).

import { useState } from "react";
import { Explain } from "@/app/admin/social/_components/ui";

/** The kinds that are a moving picture rather than a still card. */
export function isVideoKind(kind: string | null | undefined): boolean {
  return kind === "short_video" || kind === "animated_gif";
}

export function VideoPreview({
  post,
}: {
  post: { id: string; media_kind: string | null; platform: string; subject: string | null };
}) {
  const id = post.id;
  const subject = post.subject ?? "";
  // ⚠️ A GIF animates on X only; everywhere else the stored shape is an MP4 ⇒ formatForChannel.
  const gif = post.media_kind === "animated_gif" && post.platform === "x";
  const src = `/api/admin/social/video/${id}`;
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? src : `${src}?try=${attempt}`;

  // ⚠️ A broken <video> names no cause — ask the route, which answers in JSON.
  async function explain() {
    try {
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (res.ok) return;
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setFailure(`${res.status}: ${json?.error ?? "the video could not be made"}`);
    } catch (e) {
      setFailure(`The video could not be fetched: ${(e as Error).message}`);
    }
  }

  if (failure) {
    return (
      <div className="w-full max-w-xl space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
        <p>⚠️ This video did not load. {failure}</p>
        <button
          type="button"
          onClick={() => {
            setFailure(null);
            setAttempt((a) => a + 1);
          }}
          className="min-h-9 rounded-lg border border-white/15 px-3 font-semibold text-zinc-100 hover:bg-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <figure className="space-y-1">
      {gif ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={attempt}
          src={url}
          alt={`The animated GIF for “${subject}”`}
          className="w-full max-w-xl rounded-lg border border-white/8"
          onError={() => void explain()}
        />
      ) : (
        <video
          key={attempt}
          src={url}
          controls
          muted
          playsInline
          preload="metadata"
          className="w-full max-w-xl rounded-lg border border-white/8"
          onError={() => void explain()}
        />
      )}
      <figcaption className="text-xs text-zinc-500">Preview — can take up to a minute to appear.</figcaption>
      <Explain q="Is this the exact video that goes out?">
        <p>
          Before you approve, this is a preview made just now from the words and the picture. Approving
          makes the final video, which can add a moving background. After approval this shows the exact
          file that goes out.
        </p>
      </Explain>
    </figure>
  );
}
