// Takes screenshots of routes for visual review. Usage: tsx scripts/shots.ts / /projects /projects/pms-scholarship
import { chromium } from '@playwright/test';
import fs from 'node:fs';

async function main() {
  const routes = process.argv.slice(2);
  const base = process.env.BASE ?? 'http://localhost:3100';
  const bundled = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(bundled) ? { executablePath: bundled } : {});
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  fs.mkdirSync('screenshots', { recursive: true });
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const name = (r.replace(/[/?=&#]+/g, '_').replace(/^_|_$/g, '') || 'home') + '.png';
    await page.screenshot({ path: `screenshots/${name}`, fullPage: process.env.FULL === '1' });
    console.log('shot', name);
  }
  if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
