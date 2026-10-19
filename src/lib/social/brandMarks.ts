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
 * Is this pair readable by a phone camera?
 *
 * 🔴 A QR CODE IS NOT A DESIGN ELEMENT THAT CAN BE TINTED TO TASTE. Scanners
 * threshold the image, so a low-contrast code is not a subtle code — it is a
 * code that does not work, and it fails silently and only for the reader.
 * ⇒ So the composer renders the code on its own light panel rather than on the
 * palette's ground, and this is the check that keeps that true.
 */
export function relativeLuminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function qrContrastOk(dark: string, light: string): boolean {
  // ⚠️ 7:1, well above the 4.5:1 that text needs. A camera has none of the
  // advantages a reading eye has: no context, no expectation, one exposure.
  return contrastRatio(dark, light) >= 7;
}

/** Hex to HSL, each component in 0..1. */
function toHsl(hex: string): { h: number; s: number; l: number } {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return { h, s, l };
}

/** HSL back to hex. */
function fromHsl(h: number, s: number, l: number): string {
  const ch = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(8)}${ch(4)}`.toUpperCase();
}

/**
 * The same colour, made visible against a particular ground.
 *
 * 🔴 THE RING AND THE DOT ARE NOT THE CODE, and only the code was ever
 * checked. The modules sit on a white panel and must stay dark to scan, which
 * is what qrContrastOk guards. The ring around the panel and the dot beside the
 * label sit on the CARD, and nothing guarded that pair — so when I measured it:
 * all three brand colours are dark, five of the six palettes have a dark
 * ground, and 15 of the 18 combinations came out below 3:1. On the ink palette
 * the iPhone ring measured 1.01 against the card it was drawn on. The owner
 * asked for codes that were more colourful; on five cards in six the colour was
 * not there at all.
 *
 * ⚠️ A guard can be correct and still be the wrong pair. qrContrastOk reads
 * exactly right, is well commented, and answers a question nobody was asking
 * about the ring.
 *
 * ⛔ THE BLUNT REPAIR IS TO PAINT ALL THREE RINGS IN THE PALETTE'S ACCENT, or
 * all three white. Both are perfectly legible and both throw away the one thing
 * the ring is for — telling the three codes apart at a glance, which is the
 * whole reason there are three rather than one. ⇒ Hue and saturation are kept
 * and only lightness moves, away from the ground, stopping at the first value
 * that clears the bar for a non-text graphic.
 */
export function onGround(color: string, ground: string, target = 3): string {
  if (contrastRatio(color, ground) >= target) return color;
  const { h, s, l: from } = toHsl(color);
  // Lighter on a dark card, darker on a light one.
  const away = relativeLuminance(ground) < 0.5 ? 1 : -1;
  for (let step = 1; step <= 100; step++) {
    const l = Math.max(0, Math.min(1, from + (away * step) / 100));
    const candidate = fromHsl(h, s, l);
    if (contrastRatio(candidate, ground) >= target) return candidate;
    if (l === 0 || l === 1) break;
  }
  // ⛔ No value in this hue clears the bar — a mid-grey ground can do that.
  // Give up the hue rather than the ring: an unidentifiable ring is a worse
  // outcome than an invisible one only if you cannot see either.
  return away > 0 ? "#FFFFFF" : "#000000";
}

/**
 * 🔴 THREE CODES, NOT ONE — and they were already defined here before I
 * arrived. `scripts/generate-qr-codes.js` has generated qr-website, qr-android
 * and qr-ios since the org-invite emails were built, pointing at the site, the
 * Play listing and the App Store listing.
 *
 * ⚠️ I shipped a single generic code to imotara.com and did not look. The
 * convention existed, the owner knew it, and a reader on a phone wants the
 * store for the phone they are holding — not a website that will ask them
 * which one they have.
 *
 * ⛔ The targets must stay identical to that script's. Two places encoding
 * different URLs for "the Android one" is the drift that makes a QR point
 * somewhere nobody checks.
 */
export const QR_TARGETS = [
  {
    id: "web",
    label: "Website",
    url: "https://imotara.com",
    // Imotara indigo, darkened until it clears the camera bar.
    color: "#312E81",
    // The same indigo, lightened for the ring and the dot on a dark card.
    onDark: "#A5B4FC",
  },
  {
    id: "android",
    label: "Android",
    url: "https://play.google.com/store/apps/details?id=com.imotara.imotara",
    // A deep green that reads as Play without borrowing their mark.
    color: "#14532D",
    onDark: "#4ADE80",
  },
  {
    id: "ios",
    label: "iPhone",
    url: "https://apps.apple.com/in/app/imotara/id6756697569",
    // Near-black slate: Apple's own listings are monochrome.
    color: "#0F172A",
    // ⚠️ NOT the lightened near-black. Lifting #0F172A keeps its hue and
    // lands on a blue 20ΔE from the lightened indigo next to it — measured,
    // after the first version of this fix did exactly that. The App Store's own
    // mark is blue, so the ring says Apple without colliding with Imotara.
    onDark: "#38BDF8",
  },
] as const;

/** ⚠️ `color` is the MODULES, which sit on white and must scan. `ringColor`
 *  is the ring and the dot, which sit on the card. Two jobs, two values. */
export type QrCode = {
  id: string;
  label: string;
  dataUri: string;
  color: string;
  ringColor: string;
};

/**
 * Where a scan lands, tagged so the channel is visible in analytics.
 *
 * ⚠️ `utm_*` only, and only on the website link — a store URL with unknown
 * query parameters is a store URL that may not resolve. ⛔ No post id, no
 * schedule id, nothing identifying: a QR on a mental-health post is exactly
 * the place not to build a tracking link.
 */
export function qrTarget(platform: string, base: string = QR_TARGETS[0].url): string {
  if (!base.startsWith("https://imotara.com")) return base;
  return `${base}/?utm_source=${encodeURIComponent(platform)}&utm_medium=social&utm_campaign=post`;
}

/**
 * A QR code as a PNG data URI, sized for the card.
 *
 * ⚠️ ERROR CORRECTION 'M', not 'L'. The code sits on a card photographed off a
 * screen at an angle, which is exactly when the lowest level fails. 'H' is more
 * robust and denser, which costs legibility at this size — M is the trade that
 * actually scans.
 *
 * ⛔ The quiet zone is NOT optional. A code butted against a coloured panel is
 * unreadable by most phone cameras, and it is the commonest way a QR on a
 * designed card fails while looking perfectly fine.
 */
export async function qrDataUri(target: string, dark: string, light: string): Promise<string> {
  return QRCode.toDataURL(target, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
    color: { dark, light },
  });
}

/** All three, ready for the composer. ⚠️ One failure loses one code, not the
 *  picture: a card with two codes is a card. */
/**
 * 🔑 HOW MANY CODES A CHANNEL CARRIES, and the honest reason.
 *
 * 🔴 THE FOLKLORE I CHECKED AND DID NOT FIND. The worry was that a repeated
 * logo + QR pattern reads as marketing and gets down-ranked. ⛔ Nothing in
 * Meta's own documentation supports that — the originality rules target
 * REPOSTED MEDIA, not a reused design, and QR codes are not mentioned
 * anywhere. The 20%-text rule people quote is an ADS delivery rule, not an
 * organic one ⇒ feedback_social_platform_rules_are_reviewed.
 *
 * ⚠️ SO THIS IS A DESIGN JUDGEMENT, NOT AN ALGORITHM ONE, and it is labelled
 * as such. Claiming a ranking reason I cannot evidence would be exactly the
 * confident nonsense this file tries to avoid.
 *
 * The judgement: three codes with coloured rings and labels are the second
 * loudest thing on the card after the headline, and on Instagram they are
 * read on the very phone that would have to scan them — so they cost
 * attention and return almost nothing. One quiet code keeps a way in.
 *
 * ⛔ Facebook keeps all three: it is far more often read on a desktop, where
 * a phone camera pointed at the screen is exactly how somebody installs an
 * app.
 */
export const QR_COUNT: Record<string, number> = {
  facebook: 3,
  instagram: 1,
  linkedin: 3,
  x: 1,
  youtube: 3,
};

export async function allQrCodes(platform: string): Promise<QrCode[]> {
  const out: QrCode[] = [];
  // ⚠️ `?? QR_TARGETS.length` — an unknown channel gets the full set rather
  // than silently none. A missing code is a dead end; an extra one is clutter.
  const want = QR_COUNT[platform] ?? QR_TARGETS.length;
  for (const t of QR_TARGETS.slice(0, want)) {
    /**
     * 🔴 THE COLOUR IS CHECKED, NOT TRUSTED. A QR code is the one graphic on a
     * card that is read by a machine with none of a human eye's advantages: no
     * context, no expectation, one exposure, often at an angle on a lit screen.
     *
     * ⛔ So a colour that does not clear 7:1 against white is NOT used in a
     * muted version or with a warning — it is replaced with near-black, and the
     * code still works. A pretty code that does not scan is not a pretty code,
     * it is a dead end that fails silently and only for the reader.
     */
    const dark = qrContrastOk(t.color, "#FFFFFF") ? t.color : "#111827";
    try {
      out.push({
        id: t.id,
        label: t.label,
        color: dark,
        ringColor: t.onDark,
        dataUri: await qrDataUri(qrTarget(platform, t.url), dark, "#FFFFFF"),
      });
    } catch {
      // Skipped, not fatal: a card with two codes is still a card.
    }
  }
  return out;
}

