#!/usr/bin/env node
/**
 * Builds the YouTube channel banner.
 *
 * 🔴 WHY THIS EXISTS. The banner that was live until 2026-10-16 read
 * "Connect with expert counselors". Imotara Connect supplies PEERS — the
 * twelve roles are friend, dad, mom, sister, brother, wellness companion,
 * grandfather, grandmother, yoga instructor. There is no counsellor role, and
 * the agreement every companion signs says plainly "I am NOT a licensed
 * therapist, psychologist, psychiatrist, counsellor". Counsellor is a
 * regulated title; claiming it while supplying peers is the misrepresentation
 * that would dismantle a liability defence on a mental-health product.
 *
 * ⛔ The banner was a flat image, so nobody could correct it without a design
 * tool — which is exactly why a false claim sat on the most public surface
 * Imotara has for months. Now it is code, and a wrong word is a one-line diff.
 *
 * 📐 YouTube geometry, and it is unforgiving:
 *   - Upload size            2560 x 1440
 *   - SAFE AREA              1546 x 423, centred — the ONLY region guaranteed
 *                            visible on every device. Phones crop to roughly
 *                            this. Everything that must be read lives inside.
 *   - Max file size          6 MB
 *
 * 📐 X/Twitter header is a different shape entirely: 1500 x 500, and the
 *    profile picture punches a hole in the BOTTOM-LEFT corner, so nothing may
 *    live there. Generated from the same copy so the two cannot drift.
 *
 * 📐 Facebook Page cover: 1640 x 624 (2x the 820 x 312 desktop slot, so it
 *    stays crisp). ⚠️ TWO crops, not one — desktop shows 820 x 312 while
 *    mobile shows a TALLER, NARROWER region, so only the centre survives both.
 *    The Page avatar also overlaps the bottom-left, exactly like X.
 *
 * 🔴 ADDED 2026-10-17, and for the same reason the file exists at all: the
 *    live Facebook cover read "A safe space to talk, HEAL & grow" with a badge
 *    saying "Human Consultation". Heal is a treatment claim and consultation
 *    is a clinical one — the third banner found carrying a claim the product
 *    denies. Images are copy, and no test can read them.
 *
 * ▶️ Run:  node scripts/generate-youtube-banner.js
 *    Output: docs/brand/imotara-youtube-banner.png   (2560 x 1440)
 *            docs/brand/imotara-x-header.png         (1500 x 500)
 *            docs/brand/imotara-facebook-cover.png   (1640 x 624)
 *            docs/brand/imotara-producthunt-gallery.png (1270 x 760)
 *            docs/brand/imotara-linkedin-banner.png  (1584 x 396)
 *         node scripts/generate-youtube-banner.js linkedin   — one canvas only
 *
 * 📐 Product Hunt gallery: 1270 x 760 — nearly 5:3, much squarer than every
 *    other canvas here, so the lockup stacks instead of sitting side by side.
 *    No avatar overlaps it, so nothing needs clearing.
 *
 * ⚠️ Rendered with headless Chrome because this machine has no rsvg-convert,
 * ImageMagick or Inkscape. Chrome is the one renderer that is definitely here.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "brand");
const OUT_PNG = path.join(OUT_DIR, "imotara-youtube-banner.png");
const OUT_X = path.join(OUT_DIR, "imotara-x-header.png");
const OUT_FB = path.join(OUT_DIR, "imotara-facebook-cover.png");
const OUT_PH = path.join(OUT_DIR, "imotara-producthunt-gallery.png");
const OUT_LI = path.join(OUT_DIR, "imotara-linkedin-banner.png");
const LOGO = path.join(ROOT, "public", "icon-512.png");

const CHROME =
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * ⛔ Copy rules for this banner, learned the hard way:
 *   - Never a regulated title (counsellor, therapist, psychologist).
 *   - "Peers, not clinicians" is the honest framing and also the
 *     differentiator — say it rather than hide it.
 *   - The app icon ALREADY contains the Imotara wordmark, so the banner must
 *     not print the name again. The first draft did and looked amateurish.
 */
const HEAD = "Somewhere to say how<br>you actually feel.";
const SUB = "22 languages. Eleven of them Indian.";
const PILLS = [
    ["#6366f1", "Talk or type, day or night"],
    ["#0ea5e9", "Private by default"],
    ["#10b981", "Peer companions, not clinicians"],
];

/**
 * The two canvases. ⚠️ They are NOT the same shape and must not be scaled from
 * one another.
 *
 * ⛔ X punches the profile picture through the BOTTOM-LEFT of the header, so
 * the lockup is nudged UP and RIGHT to clear it. YouTube centres everything in
 * its safe area instead.
 */
const SPECS = {
    youtube: {
        w: 2560, h: 1440,
        // YouTube's safe area: the only region guaranteed visible on a phone.
        safeW: 1546, safeH: 423, safeShift: "",
        logo: 232, gap: 60, head: 62, sub: 40, subGap: 14,
        pillGap: 28, pillSpace: 13, pillText: 22, pillPadY: 13, pillPadX: 24, pillDot: 11,
        out: OUT_PNG, maxMb: 6,
    },
    x: {
        w: 1500, h: 500,
        // Nudged up and right so the avatar cannot cover the logo or the pills.
        safeW: 1320, safeH: 330, safeShift: "transform:translate(44px,-34px);",
        logo: 136, gap: 36, head: 38, sub: 25, subGap: 9,
        pillGap: 18, pillSpace: 9, pillText: 14, pillPadY: 8, pillPadX: 15, pillDot: 7,
        out: OUT_X, maxMb: 5,
    },
    producthunt: {
        w: 1270, h: 760,
        /**
         * ⚠️ The only canvas here that is nearly square, so the side-by-side
         * lockup the other three use would leave the copy cramped and the
         * image mostly empty. This one STACKS — logo above the words — which
         * is why `stack: true` exists at all.
         */
        stack: true,
        safeW: 1040, safeH: 600, safeShift: "",
        logo: 180, gap: 44, head: 58, sub: 32, subGap: 14,
        pillGap: 30, pillSpace: 12, pillText: 19, pillPadY: 11, pillPadX: 20, pillDot: 9,
        out: OUT_PH, maxMb: 5,
    },
    facebook: {
        w: 1640, h: 624,
        /**
         * ⚠️ TWO crops to survive, worked out rather than guessed:
         *   - desktop 820 x 312 — the same 2.63 ratio as this canvas, so no
         *     side crop at all;
         *   - mobile ~1.78 ratio — crops the SIDES, keeping only x 265..1375.
         * The Page avatar overlaps roughly x 0..213, y 424..624.
         *
         * ⛔ NO SHIFT. X needs one because its canvas is tight and the avatar
         * sits under the lockup; here the content already lands at x≈345..1295
         * and y≈217..407, clearing the avatar zone and sitting inside the
         * mobile crop. Nudging it up only created dead space along the bottom.
         */
        safeW: 1280, safeH: 400, safeShift: "",
        logo: 160, gap: 42, head: 44, sub: 29, subGap: 11,
        pillGap: 22, pillSpace: 11, pillText: 16, pillPadY: 10, pillPadX: 18, pillDot: 8,
        out: OUT_FB, maxMb: 5,
    },
    linkedin: {
        w: 1584, h: 396,
        /**
         * 🔴 ADDED 2026-10-22: the live LinkedIn profile banner still read
         * "talk, HEAL and grow" and "Connect with expert COUNSELORS" — the
         * same two claims already removed from YouTube and Facebook, on the
         * profile whose headline says "Not therapy, and we say so".
         *
         * 📐 Personal-profile background, 4:1. The round profile photo sits
         * over the BOTTOM-LEFT, roughly x 40..360 on this canvas, so the
         * lockup is pushed RIGHT to clear it. At 396 px tall there is no
         * vertical slack, so everything is smaller than on Facebook.
         */
        /**
         * ⚠️ LinkedIn shows this at about HALF size on a laptop (≈790 px wide)
         * and smaller on a phone. The first render used Facebook-like sizes
         * and its pills came out ~7 px tall on screen — unreadable. Text is
         * sized for the half-size view.
         *
         * ⛔ NO LOGO CARD. The profile photo directly below IS the logo, so
         * the card printed it twice, a few centimetres apart.
         */
        noLogo: true,
        safeW: 1100, safeH: 360, safeShift: "transform:translateX(190px);",
        logo: 0, gap: 0, head: 58, sub: 34, subGap: 10,
        pillGap: 20, pillSpace: 12, pillText: 22, pillPadY: 11, pillPadX: 20, pillDot: 9,
        out: OUT_LI, maxMb: 8,
    },
};

function buildHtml(logoB64, spec) {
    return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${spec.w}px;height:${spec.h}px;overflow:hidden}
  body{
    font-family:Inter,-apple-system,sans-serif;
    background:
      radial-gradient(1300px 760px at 20% 36%, rgba(99,102,241,.24), transparent 62%),
      radial-gradient(1200px 700px at 80% 66%, rgba(52,211,153,.22), transparent 62%),
      radial-gradient(1000px 640px at 52% 18%, rgba(14,165,233,.19), transparent 60%),
      #fbfcff;
    display:flex;align-items:center;justify-content:center;
  }
  /* The safe area, centred. Nothing outside it is guaranteed to survive a phone. */
  .safe{width:${spec.safeW}px;height:${spec.safeH}px;display:flex;align-items:center;justify-content:center;gap:${spec.gap}px;${spec.safeShift}
        ${spec.stack ? "flex-direction:column;" : ""}}
  .logo{width:${spec.logo}px;height:${spec.logo}px;flex:0 0 ${spec.logo}px;border-radius:${Math.round(spec.logo*0.224)}px;
        box-shadow:0 20px 56px rgba(79,70,229,.22), 0 2px 8px rgba(0,0,0,.05)}
  .copy{display:flex;flex-direction:column;align-items:${spec.stack ? "center" : "flex-start"};text-align:${spec.stack ? "center" : "left"}}
  .head{font-size:${spec.head}px;font-weight:700;letter-spacing:-2px;line-height:1.1;color:#0f172a}
  .sub{margin-top:${spec.subGap}px;font-size:${spec.sub}px;font-weight:700;letter-spacing:-1.1px;line-height:1.1;
       background:linear-gradient(100deg,#4f46e5 0%,#0284c7 46%,#059669 100%);
       -webkit-background-clip:text;background-clip:text;color:transparent}
  .pills{margin-top:${spec.pillGap}px;display:flex;gap:${spec.pillSpace}px;justify-content:center;flex-wrap:wrap}
  .pill{display:flex;align-items:center;gap:${spec.pillDot}px;padding:${spec.pillPadY}px ${spec.pillPadX}px;border-radius:999px;
        background:rgba(255,255,255,.85);border:1.5px solid rgba(79,70,229,.15);
        font-size:${spec.pillText}px;font-weight:600;color:#273449;white-space:nowrap;
        box-shadow:0 2px 12px rgba(30,41,59,.06)}
  .dot{width:${spec.pillDot}px;height:${spec.pillDot}px;border-radius:50%;flex:0 0 ${spec.pillDot}px}
</style></head>
<body>
  <div class="safe">
    ${spec.noLogo ? "" : `<img class="logo" src="data:image/png;base64,${logoB64}" alt="">`}
    <div class="copy">
      <div class="head">${HEAD}</div>
      <div class="sub">${SUB}</div>
      <div class="pills">
        ${PILLS.map(([c, t]) => `<span class="pill"><span class="dot" style="background:${c}"></span>${t}</span>`).join("\n        ")}
      </div>
    </div>
  </div>
</body></html>`;
}

function render(spec, logoB64, label) {
    const htmlPath = path.join(OUT_DIR, `.banner.${label}.tmp.html`);
    fs.writeFileSync(htmlPath, buildHtml(logoB64, spec), "utf8");
    execFileSync(
        CHROME,
        [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            `--window-size=${spec.w},${spec.h}`,
            `--screenshot=${spec.out}`,
            `file://${htmlPath}`,
        ],
        { stdio: "ignore" },
    );
    fs.unlinkSync(htmlPath);

    // ⚠️ Verify the geometry rather than trusting it. A banner at the wrong
    // size is silently rejected or cropped.
    const buf = fs.readFileSync(spec.out);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const mb = buf.length / 1024 / 1024;
    if (width !== spec.w || height !== spec.h) {
        console.error(`${label}: wrong size ${width}x${height}, expected ${spec.w}x${spec.h}`);
        process.exit(1);
    }
    if (mb > spec.maxMb) {
        console.error(`${label}: ${mb.toFixed(2)} MB exceeds the ${spec.maxMb} MB limit`);
        process.exit(1);
    }
    console.log(`  ${label.padEnd(8)} ${width} x ${height}, ${mb.toFixed(2)} MB  ->  ${path.relative(ROOT, spec.out)}`);
}

function main() {
    if (!fs.existsSync(CHROME)) {
        console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const logoB64 = fs.readFileSync(LOGO).toString("base64");
    // ⚠️ One name renders one canvas, so adding a size does not re-render
    // (and churn) every banner that is already live.
    const only = process.argv[2];
    for (const label of only ? [only] : Object.keys(SPECS)) {
        if (!SPECS[label]) {
            console.error(`Unknown canvas "${label}". Known: ${Object.keys(SPECS).join(", ")}`);
            process.exit(1);
        }
        render(SPECS[label], logoB64, label);
    }
}

main();
