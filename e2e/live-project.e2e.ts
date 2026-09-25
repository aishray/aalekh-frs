import { test, expect } from '@playwright/test';
const GO = `GOVERNMENT OF RAJYAPRADESH, SOCIAL WELFARE DEPARTMENT
G.O. No. SW/2026/PEN/044, dated 10 September 2026
1. Widows aged 18 years and above who are domiciled in Rajyapradesh are eligible for a monthly pension.
2. The annual family income of the applicant shall not exceed Rs. 1,20,000.
3. Applications shall be submitted online or at Common Service Centres with Aadhaar e-KYC.
4. The Tehsildar shall verify the application within 10 working days of submission.
5. The District Social Welfare Officer shall sanction or reject within 10 working days of verification, recording reasons for rejection.
6. The pension of Rs. 1,500 per month shall be paid by DBT to the Aadhaar-seeded bank account.
7. Grievances shall be resolved within 7 working days.`;
// Opt-in (LIVE=1): creates a new project and runs live Sarvam calls (clause typing, reconciliation, discovery).
// Uses credits; run it against a deployment with E2E_BASE_URL=https://aalekh-frs.vercel.app LIVE=1 npm run e2e.
test('live new project', async ({ page }) => {
  test.skip(!process.env.LIVE, 'Set LIVE=1 to run live AI calls.');
  test.setTimeout(420_000);
  page.on('response', (r) => { if (r.url().includes('/api/ai/')) console.log('AI', r.status(), r.url().split('/api/ai/')[1], r.headers()['x-vercel-cache'] ?? ''); });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/projects/new');
  await page.getByLabel('Project name').fill('Widow Pension Sanction (live test)');
  await page.getByLabel('Line department').fill('Social Welfare');
  await page.getByLabel('File number').fill(`IT/SW/2026/LIVE-${Date.now() % 10000}`);
  await page.getByRole('button', { name: /Create project and add sources/ }).click();
  await expect(page.getByText(/created with file number/)).toBeVisible();
  await page.getByRole('button', { name: 'Add source' }).first().click();
  await expect(page.getByRole('tab', { name: 'Paste text' })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('GO on widow pension');
  await page.getByRole('tab', { name: 'Paste text' }).click();
  await page.getByLabel('Source text').fill(GO);
  let t = Date.now();
  await page.getByRole('button', { name: 'Index clauses' }).click();
  await expect(page.getByRole('cell', { name: /GO on widow pension/ })).toBeVisible({ timeout: 120_000 });
  console.log('indexed in', Date.now() - t, 'ms');
  await page.getByRole('button', { name: /Continue to reconciliation/ }).click();
  t = Date.now();
  await page.getByRole('button', { name: 'Run reconciliation' }).first().click();
  await expect(page.getByTestId('reconcile-gate')).toBeVisible({ timeout: 300_000 });
  console.log('reconciled in', Date.now() - t, 'ms:', (await page.getByTestId('reconcile-gate').innerText()).slice(0, 120));
  await page.goto(page.url().replace('/reconcile', '/discovery'));
  t = Date.now();
  await page.getByRole('button', { name: 'Run discovery' }).first().click();
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 300_000 });
  const missing = await page.getByTestId('checklist').getByRole('row').filter({ hasText: 'Missing' }).count();
  console.log('discovery in', Date.now() - t, 'ms; missing topics:', missing);
  await page.screenshot({ path: 'screenshots/live-discovery.png' });
});
