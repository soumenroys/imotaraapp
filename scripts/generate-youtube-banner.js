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
 * ▶️ Run:  node scripts/generate-youtube-banner.js
 *    Output: docs/brand/imotara-youtube-banner.png
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

function buildHtml(logoB64) {
    return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:2560px;height:1440px;overflow:hidden}
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
  .safe{width:1546px;height:423px;display:flex;align-items:center;justify-content:center;gap:60px}
  .logo{width:232px;height:232px;flex:0 0 232px;border-radius:52px;
        box-shadow:0 20px 56px rgba(79,70,229,.22), 0 2px 8px rgba(0,0,0,.05)}
  .copy{display:flex;flex-direction:column;align-items:flex-start}
  .head{font-size:62px;font-weight:700;letter-spacing:-2px;line-height:1.1;color:#0f172a}
  .sub{margin-top:14px;font-size:40px;font-weight:700;letter-spacing:-1.1px;line-height:1.1;
       background:linear-gradient(100deg,#4f46e5 0%,#0284c7 46%,#059669 100%);
       -webkit-background-clip:text;background-clip:text;color:transparent}
  .pills{margin-top:28px;display:flex;gap:13px}
  .pill{display:flex;align-items:center;gap:10px;padding:13px 24px;border-radius:999px;
        background:rgba(255,255,255,.85);border:1.5px solid rgba(79,70,229,.15);
        font-size:22px;font-weight:600;color:#273449;white-space:nowrap;
        box-shadow:0 2px 12px rgba(30,41,59,.06)}
  .dot{width:11px;height:11px;border-radius:50%;flex:0 0 11px}
</style></head>
<body>
  <div class="safe">
    <img class="logo" src="data:image/png;base64,${logoB64}" alt="">
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

function main() {
    if (!fs.existsSync(CHROME)) {
        console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const logoB64 = fs.readFileSync(LOGO).toString("base64");
    const htmlPath = path.join(OUT_DIR, ".banner.tmp.html");
    fs.writeFileSync(htmlPath, buildHtml(logoB64), "utf8");

    execFileSync(
        CHROME,
        [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--window-size=2560,1440",
            `--screenshot=${OUT_PNG}`,
            `file://${htmlPath}`,
        ],
        { stdio: "ignore" },
    );
    fs.unlinkSync(htmlPath);

    // ⚠️ Verify the geometry rather than trusting it. A banner at the wrong
    // size is silently rejected or cropped by YouTube.
    const buf = fs.readFileSync(OUT_PNG);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const mb = (buf.length / 1024 / 1024).toFixed(2);
    if (width !== 2560 || height !== 1440) {
        console.error(`Wrong size: ${width}x${height}, expected 2560x1440`);
        process.exit(1);
    }
    if (buf.length > 6 * 1024 * 1024) {
        console.error(`Too large: ${mb} MB, YouTube's limit is 6 MB`);
        process.exit(1);
    }
    console.log(`Banner written: ${OUT_PNG}`);
    console.log(`  ${width} x ${height}, ${mb} MB — within YouTube's limits`);
}

main();
