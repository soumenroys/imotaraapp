#!/usr/bin/env node
/**
 * Builds the App Store screenshots from REAL app screens.
 *
 * 🔴 WHY: every screenshot on the App Store until Oct 2026 showed test data —
 * "Hallo there", the owner's name, a companion saying chatting was "the
 * highlight of my day", an empty mood radar, "Positive 0%". The screens here
 * were captured on 22–23 Oct from a clean 1.5.9 install (iPhone 17 simulator,
 * guest "Asha"), replies straight from the live service.
 *
 * 📐 Apple (screenshot-specifications, read 22 Oct 2026):
 *   iPhone, Dynamic Island (medium) — 1206 x 2622 — REQUIRED set
 *   iPhone Duo outer display      — 1398 x 2034
 *   iPhone Duo inner display      — 2007 x 2853
 *   .png/.jpg, NO alpha, up to 10 per size. Must show the app in use.
 *
 * 📐 Google Play phone (read 25 Oct 2026): 16:9 or 9:16, each side 320–3840,
 *   the long side at most twice the short one. ⛔ No iPhone frame and no iOS
 *   status bar there — Play showed iPhone captures until Oct 2026. `crop` cuts
 *   the status bar (time, Dynamic Island, battery: y < 186) and the empty strip
 *   under the tab bar off the same real captures.
 *
 * ⛔ Captions follow the banner copy rules (generate-youtube-banner.js): no
 * clinical titles, no prices, no other platforms' logos.
 *
 * ▶️ node scripts/generate-appstore-screens.js
 *    → docs/brand/appstore/screens/<size>/<n>-<name>.png
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "docs", "brand", "appstore", "raw-2026-10-22");
const OUT = path.join(ROOT, "docs", "brand", "appstore", "screens");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SCREENS = [
  { file: "c-chat.png", name: "chat", head: "Say how you actually feel.", sub: "It listens. No judgment, no ads." },
  { file: "c-chat-bn.png", name: "bengali", head: "In your own language.", sub: "22 languages. Eleven of them Indian." },
  { file: "c-welcome.png", name: "welcome", head: "Start with one tap.", sub: "Or just start typing — or talk." },
  { file: "c-roles.png", name: "roles", head: "A friend, a mentor, an elder.", sub: "You choose who Imotara is to you." },
];

const SIZES = {
  "iphone-6.3": { w: 1206, h: 2622, head: 84, sub: 46, top: 190, phoneW: 0.80 },
  "duo-outer": { w: 1398, h: 2034, head: 78, sub: 42, top: 130, phoneW: 0.52 },
  "duo-inner": { w: 2007, h: 2853, head: 104, sub: 56, top: 200, phoneW: 0.56 },
  "play-phone": { w: 1080, h: 1920, head: 66, sub: 36, top: 110, phoneW: 0.70, crop: { top: 186, bottom: 100 } },
};

const RAW_W = 1206, RAW_H = 2622;

function html(sz, s, shot) {
  const sw = Math.round(sz.w * sz.phoneW);
  // Frameless: the real screen, cropped, in a plain rounded card.
  const device = sz.crop
    ? `<div class="card"><img src="data:image/png;base64,${shot}" style="display:block;width:100%;margin-top:${-Math.round(sz.crop.top * sw / RAW_W)}px"></div>`
    : `<div class="phone"><div class="screen"></div></div>`;
  const cardH = sz.crop ? Math.round((RAW_H - sz.crop.top - sz.crop.bottom) * sw / RAW_W) : 0;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${sz.w}px;height:${sz.h}px;overflow:hidden}
body{font-family:Inter,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;
  background:radial-gradient(${sz.w}px ${sz.h * 0.6}px at 20% 10%,rgba(99,102,241,.22),transparent 65%),
             radial-gradient(${sz.w}px ${sz.h * 0.6}px at 85% 95%,rgba(52,211,153,.20),transparent 65%),#fbfcff}
.cap{margin-top:${sz.top}px;text-align:center;padding:0 60px}
.head{font-size:${sz.head}px;font-weight:700;letter-spacing:-2px;line-height:1.08;color:#0f172a}
.sub{margin-top:${Math.round(sz.head * 0.32)}px;font-size:${sz.sub}px;font-weight:600;letter-spacing:-.5px;
  background:linear-gradient(100deg,#4f46e5,#0284c7 46%,#059669);-webkit-background-clip:text;background-clip:text;color:transparent}
.phone{margin-top:${Math.round(sz.head * 0.9)}px;width:${Math.round(sz.w * sz.phoneW)}px;aspect-ratio:1206/2622;
  border-radius:${Math.round(sz.w * sz.phoneW * 0.13)}px;background:#0b0b10;padding:${Math.round(sz.w * sz.phoneW * 0.025)}px;
  box-shadow:0 40px 120px rgba(30,41,59,.30)}
.card{margin-top:${Math.round(sz.head * 0.9)}px;width:${sw}px;height:${cardH}px;overflow:hidden;
  border-radius:${Math.round(sw * 0.05)}px;border:1px solid rgba(15,23,42,.08);box-shadow:0 40px 120px rgba(30,41,59,.30)}
.screen{width:100%;height:100%;border-radius:${Math.round(sz.w * sz.phoneW * 0.11)}px;overflow:hidden;
  background:url(data:image/png;base64,${shot}) top center/100% auto no-repeat}
</style></head><body>
<div class="cap"><div class="head">${s.head}</div><div class="sub">${s.sub}</div></div>
${device}
</body></html>`;
}

function main() {
  for (const [label, sz] of Object.entries(SIZES)) {
    const dir = path.join(OUT, label);
    fs.mkdirSync(dir, { recursive: true });
    SCREENS.forEach((s, i) => {
      const shot = fs.readFileSync(path.join(RAW, s.file)).toString("base64");
      const tmp = path.join(dir, ".tmp.html");
      const out = path.join(dir, `${i + 1}-${s.name}.png`);
      fs.writeFileSync(tmp, html(sz, s, shot));
      execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        `--window-size=${sz.w},${sz.h}`, `--screenshot=${out}`, `file://${tmp}`], { stdio: "ignore" });
      fs.unlinkSync(tmp);
      const b = fs.readFileSync(out);
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ct = b[25];
      if (w !== sz.w || h !== sz.h) throw new Error(`${out}: ${w}x${h}`);
      if (ct === 6 || ct === 4) throw new Error(`${out}: has alpha`);
      console.log(`  ${label.padEnd(11)} ${w}x${h}  ${path.relative(ROOT, out)}`);
    });
  }
}
main();
