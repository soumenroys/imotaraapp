// scripts/generate-qr-codes.js
// Regenerates the static QR code PNGs used in transactional emails
// (see sendOrgInviteEmail in src/lib/connect/mailer.ts). These are static,
// pre-generated files hosted from public/ — NOT data: URIs — because Gmail
// and several other email clients silently strip inline base64 images.
// Re-run this only if the target URLs change.

const QRCode = require('qrcode');
const path = require('path');

const targets = [
  { file: 'qr-website.png', url: 'https://imotara.com' },
  { file: 'qr-android.png', url: 'https://play.google.com/store/apps/details?id=com.imotara.imotara' },
  { file: 'qr-ios.png',     url: 'https://apps.apple.com/in/app/imotara/id6756697569' },
];

(async () => {
  for (const { file, url } of targets) {
    const outPath = path.resolve(__dirname, '../public', file);
    await QRCode.toFile(outPath, url, { width: 240, margin: 1 });
    console.log(`Generated ${file} -> ${url}`);
  }
})();
