// src/lib/broadcast/imageUrl.ts
// Is this address actually an image a mail client can fetch?
//
// The trap this exists for: a Google Drive or OneDrive "share link" looks like
// a link to a picture and is not one. It points at an HTML viewer page, and
// most of them additionally refuse to be loaded from anywhere but the
// provider's own site. Pasted into a message it passes every check we have —
// it is https, it is a URL — and then several thousand people receive a broken
// image, which cannot be recalled.
//
// So the guess is made here, before sending, where it can still be acted on.

export type UrlVerdict =
  | { ok: true; url: string; note?: string }
  | { ok: false; reason: string; fix: string };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i;

export function checkImageUrl(raw: string): UrlVerdict {
  const url = raw.trim();
  if (!url) return { ok: false, reason: "No address given.", fix: "Paste a link, or upload the file." };

  let u: URL;
  try { u = new URL(url); }
  catch { return { ok: false, reason: "That is not a web address.", fix: "It should start with https://" }; }

  if (u.protocol !== "https:") {
    return {
      ok: false,
      reason: "Only https images can be used.",
      fix: "Mail clients block insecure images, so most people would see nothing.",
    };
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  // Dropbox is the one that can be repaired: the same link with raw=1 serves
  // the file itself rather than the preview page.
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    if (u.searchParams.get("raw") === "1" || host === "dl.dropboxusercontent.com") {
      return { ok: true, url };
    }
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return { ok: true, url: u.toString(), note: "Adjusted the Dropbox link so it serves the image itself." };
  }

  // These cannot be repaired. Drive links that once worked as ?export=view are
  // now rate-limited and often refused outright, so producing one would give a
  // link that works while you are testing and fails in the recipient's inbox —
  // the worst possible outcome.
  const VIEWERS: Record<string, string> = {
    "drive.google.com": "Google Drive",
    "docs.google.com": "Google Docs",
    "photos.google.com": "Google Photos",
    "onedrive.live.com": "OneDrive",
    "1drv.ms": "OneDrive",
    "icloud.com": "iCloud",
    "sharepoint.com": "SharePoint",
  };
  const viewer = VIEWERS[host] ?? (host.endsWith(".sharepoint.com") ? "SharePoint" : null);
  if (viewer) {
    return {
      ok: false,
      reason: `That is a ${viewer} share link, not an image.`,
      fix: `It opens a web page, so email clients show nothing. Download the picture and use "Choose a file" instead — it is then hosted by us and cannot stop working.`,
    };
  }

  if (!IMAGE_EXT.test(u.pathname + u.search)) {
    return {
      ok: true,
      url,
      note: "This address does not end in an image file — check the preview shows the picture before sending.",
    };
  }

  return { ok: true, url };
}
