// src/lib/social/brandMarks.ts
// The logo and the QR code that go on every composed picture.
//
// 🔑 WHY A QR CODE AT ALL, since they are easy to do badly. A post is seen on a
// phone, and the thing a reader would have to do next — open a browser, type a
// name, find the right result — is where almost everyone stops. A code removes
// that, on the channels where somebody is plausibly holding a second device or
// looking at a screen across a room.
//
// ⛔ AND WHY NOT ON EVERY CHANNEL. On X and Instagram the image is a thumbnail
// in a feed on the same phone that would have to scan it. A code there is
// decoration pretending to be a function, and it costs space the words need.
// ⇒ platforms.ts decides, per channel.

import QRCode from "qrcode";

/**
 * The logo, fetched rather than bundled.
 *
 * ⚠️ 192px, 16 KB — not the 512px asset, which is 215 KB. Satori's whole render
 * has a 500 KB budget including fonts, and the mark is drawn at about 64px, so
 * the larger file would spend a third of the budget on detail nothing can see.
 */
export const LOGO_URL = "https://www.imotara.com/android-chrome-192.png";

/**
 * Where a scan lands, tagged so the channel is visible in analytics.
 *
 * ⚠️ `utm_*` only. ⛔ No post id, no schedule id, nothing that identifies the
 * reader or lets two scans be tied together — a QR on a mental-health post is
 * exactly the place not to build a tracking link.
 */
export function qrTarget(platform: string): string {
  return `https://www.imotara.com/?utm_source=${encodeURIComponent(platform)}&utm_medium=social&utm_campaign=post`;
}

/**
 * A QR code as a PNG data URI, sized for the card.
 *
 * ⚠️ ERROR CORRECTION 'M', not 'L'. The code sits on a coloured ground and is
 * photographed off a screen at an angle, which is exactly when the lowest level
 * fails. 'H' would be more robust still and makes the code denser, which costs
 * legibility at this size — M is the trade that actually scans.
 *
 * ⛔ The quiet zone is NOT optional. A code butted against a coloured panel is
 * unreadable by most phone cameras, and it is the single commonest way a QR on
 * a designed card fails while looking perfectly fine.
 */
export async function qrDataUri(target: string, dark: string, light: string): Promise<string> {
  return QRCode.toDataURL(target, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
    color: { dark, light },
  });
}

/**
 * Is this pair readable by a phone camera?
 *
 * 🔴 A QR CODE IS NOT A DESIGN ELEMENT THAT CAN BE TINTED TO TASTE. Scanners
 * threshold the image, so a low-contrast code is not a subtle code — it is a
 * code that does not work, and it fails silently and only for the reader.
 * ⇒ So the composer renders the code on its own light panel rather than on the
 * palette's ground, and this is the check that keeps that true.
 */
export function qrContrastOk(dark: string, light: string): boolean {
  const lum = (hex: string) => {
    const v = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const a = lum(dark);
  const b = lum(light);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // ⚠️ 7:1, well above the 4.5:1 that text needs. A camera has none of the
  // advantages a reading eye has: no context, no expectation, one exposure.
  return ratio >= 7;
}
