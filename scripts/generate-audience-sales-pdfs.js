// scripts/generate-audience-sales-pdfs.js
//
// Builds the ten "Imotara for <audience>" sales PDFs by rendering the LIVE
// /for/<slug> pages.
//
// 🔴 WHY THIS EXISTS. The ten PDFs in ~/Documents/Imotara/Sales were one-off
// exports with no link back to anything. Six of them still quoted ₹99/month and
// ₹699/year — the pricing retired on 2026-09-25 — so a prospect sent one would
// have met a ~50% higher price at checkout. Nothing could have caught that: the
// files lived outside the repo and no test could read them.
//
// ✅ Rendering the live page fixes the CAUSE rather than the six files. The
// pages take their prices from PRODUCT_CATALOG (src/lib/imotara/pricing.ts) via
// src/data/audiencePages.ts, and audiencePages.test.ts already pins that the
// retired annual price can never be advertised. So a PDF produced here cannot
// disagree with the website, and cannot drift at the next price change.
//
// Usage:
//   node scripts/generate-audience-sales-pdfs.js            # against production
//   BASE_URL=http://localhost:3000 node scripts/...         # against a local dev server
//   node scripts/generate-audience-sales-pdfs.js seniors    # just one
//
// Output: docs/sales/Imotara for <Name>.pdf — filenames deliberately match the
// ones already in ~/Documents/Imotara/Sales so they drop straight in.

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE = process.env.BASE_URL || 'https://imotaraapp.vercel.app';
const OUT  = path.resolve(__dirname, '../docs/sales');

// slug → the filename the business already uses. Keep these in step with
// src/data/audiencePages.ts; a slug that disappears should fail loudly here
// rather than silently produce nine PDFs.
const AUDIENCES = {
  'everyone':     'Imotara for Everyone',
  'young-people': 'Imotara for Young People',
  'young-adults': 'Imotara for Young Adults_21-39',
  'adults':       'Imotara for Adults 40-60',
  'seniors':      'Imotara for Seniors 61+',
  'parents':      'Imotara for Parents of Teenagers',
  'ngos':         'Imotara for NGOs',
  'schools':      'Imotara for Educational Institutions',
  'hospitals':    'Imotara for Medical Institutions',
  'care-homes':   'Imotara for Old Age Homes',
};

/**
 * Site chrome that helps on the web and only wastes paper in a PDF: the sticky
 * header, the site footer, the cookie/install prompts. The page's own content
 * is left untouched.
 */
const PRINT_CSS = `
  header, footer, nav[aria-label="Main"], [data-pwa-prompt], [role="banner"],
  [role="contentinfo"] { display: none !important; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  main { padding-top: 0 !important; }
`;

(async () => {
  const only = process.argv[2];
  const slugs = only ? [only] : Object.keys(AUDIENCES);

  const unknown = slugs.filter((s) => !AUDIENCES[s]);
  if (unknown.length) {
    console.error(`Unknown audience(s): ${unknown.join(', ')}`);
    console.error(`Known: ${Object.keys(AUDIENCES).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page    = await browser.newPage();
  let failed    = 0;

  for (const slug of slugs) {
    const url = `${BASE}/for/${slug}`;
    const pdfPath = path.join(OUT, `${AUDIENCES[slug]}.pdf`);
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      if (!res || !res.ok()) throw new Error(`HTTP ${res ? res.status() : 'no response'}`);

      await page.addStyleTag({ content: PRINT_CSS });
      await page.waitForTimeout(1200);

      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
      });
      console.log(`  ✅ ${AUDIENCES[slug]}.pdf   ← ${url}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ${slug}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\n${slugs.length - failed}/${slugs.length} written to docs/sales/`);
  // A partial run is a failure: a half-updated sales folder is worse than an
  // obviously failed one, because nobody notices the three that did not rebuild.
  process.exit(failed ? 1 : 0);
})();
