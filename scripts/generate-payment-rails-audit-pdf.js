const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '../docs/imotara-payment-rails-audit.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-payment-rails-audit.pdf');

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
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
