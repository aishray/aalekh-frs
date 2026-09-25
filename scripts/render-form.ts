// Renders the sample paper application form to a scanned-looking PNG.
// Usage: npm run form-image
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const html = path.resolve('data/sources/application_form.html');
  const bundled = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(bundled) ? { executablePath: bundled } : {});
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1.5 });
  await page.goto('file://' + html);
  const out = path.resolve('public/samples/application_form.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.locator('.wrap').screenshot({ path: out });
  await browser.close();
  console.log('Wrote', out);
}
main().catch((e) => { console.error(e); process.exit(1); });
