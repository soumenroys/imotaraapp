const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '../docs/imotara-product-one-pager.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-product-one-pager.pdf');

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Give Google Fonts a moment to load (optional — may timeout in offline env)
  await page.waitForTimeout(1500);

  await page.pdf({
    path:              pdfPath,
    format:            'A4',
    printBackground:   true,
    margin:            { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  });

  await browser.close();
  console.log(`PDF saved to: ${pdfPath}`);
})();
