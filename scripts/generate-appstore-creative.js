#!/usr/bin/env node
/**
 * Builds the App Store "Search results" creative asset.
 *
 * 📐 Apple, creative-assets-specifications (read 22 Oct 2026):
 *   Search results image — 3:2, min 1920 x 1280, max 3840 x 2560,
 *   .png/.jpg, NO alpha channel. Shown in the Search tab; without one Apple
 *   falls back to screenshots.
 *   Apple's guidance: state the purpose at a glance AND show the app itself —
 *   so this is the brand headline beside a real app screen, not artwork alone.
 *
 * ⛔ Same copy as every other banner (scripts/generate-youtube-banner.js), so
 * the claims cannot drift: no regulated titles, "peers, not clinicians".
 * ⛔ Apple also forbids prices, URLs and other platforms' logos in assets.
 *
 * The screen is the REAL chat captured 22 Oct on a clean 1.5.9 install
 * (raw-2026-10-22/c-chat.png). ⛔ The first draft used the old App Store
 * screenshot, which showed test chat — replaced.
 *
 * ▶️ Run:  node scripts/generate-appstore-creative.js
 *    Output: docs/brand/appstore/imotara-appstore-search.png (2880 x 1920)
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "docs", "brand", "appstore");
const OUT = path.join(DIR, "imotara-appstore-search.png");
const SHOT = path.join(DIR, "raw-2026-10-22", "c-chat.png");
const LOGO = path.join(ROOT, "public", "icon-512.png");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const W = 2880, H = 1920;
const HEAD = "Somewhere to say how<br>you actually feel.";
const SUB = "22 languages. Eleven of them Indian.";
const PILLS = [
  ["#6366f1", "Talk or type, day or night"],
  ["#0ea5e9", "Private by default"],
  ["#10b981", "Peer companions, not clinicians"],
];

function html(shot, logo) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;gap:150px;
  background:radial-gradient(1800px 1200px at 18% 30%,rgba(99,102,241,.26),transparent 62%),
             radial-gradient(1700px 1100px at 85% 75%,rgba(52,211,153,.22),transparent 62%),#fbfcff}
.copy{width:1300px;display:flex;flex-direction:column}
.logo{width:190px;height:190px;border-radius:43px;margin-bottom:64px;box-shadow:0 24px 60px rgba(79,70,229,.22)}
.head{font-size:118px;font-weight:700;letter-spacing:-4px;line-height:1.06;color:#0f172a}
.sub{margin-top:30px;font-size:66px;font-weight:700;letter-spacing:-2px;
  background:linear-gradient(100deg,#4f46e5,#0284c7 46%,#059669);-webkit-background-clip:text;background-clip:text;color:transparent}
.pills{margin-top:60px;display:flex;flex-wrap:wrap;gap:22px}
.pill{display:flex;align-items:center;gap:16px;padding:22px 34px;border-radius:999px;background:rgba(255,255,255,.9);
  border:2px solid rgba(79,70,229,.15);font-size:38px;font-weight:600;color:#273449;white-space:nowrap}
.dot{width:16px;height:16px;border-radius:50%}
/* A phone, showing the top of the real chat screen. */
.phone{width:860px;height:1640px;border-radius:120px;background:#0b0b10;padding:26px;
  box-shadow:0 60px 140px rgba(30,41,59,.35),0 0 0 6px #1f2230 inset}
.screen{width:100%;height:100%;border-radius:96px;overflow:hidden;background:#13121a;
  background-image:url(data:image/png;base64,${shot});background-size:100% auto;
  background-position:0 -118px;background-repeat:no-repeat}
</style></head><body>
<div class="copy">
  <img class="logo" src="data:image/png;base64,${logo}" alt="">
  <div class="head">${HEAD}</div>
  <div class="sub">${SUB}</div>
  <div class="pills">${PILLS.map(([c, t]) => `<span class="pill"><span class="dot" style="background:${c}"></span>${t}</span>`).join("")}</div>
</div>
<div class="phone"><div class="screen"></div></div>
</body></html>`;
}

function main() {
  const tmp = path.join(DIR, ".search.tmp.html");
  fs.writeFileSync(tmp, html(fs.readFileSync(SHOT).toString("base64"), fs.readFileSync(LOGO).toString("base64")));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${W},${H}`, `--screenshot=${OUT}`, `file://${tmp}`], { stdio: "ignore" });
  fs.unlinkSync(tmp);
  const b = fs.readFileSync(OUT);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colorType = b[25];
  // ⚠️ Apple refuses an alpha channel: PNG colour type 6 (RGBA) or 4 (grey+alpha).
  if (w !== W || h !== H) throw new Error(`wrong size ${w}x${h}`);
  console.log(`  search  ${w} x ${h}, PNG colour type ${colorType}${colorType === 6 || colorType === 4 ? " ⚠️ HAS ALPHA" : ""}  ->  ${path.relative(ROOT, OUT)}`);
}

main();
