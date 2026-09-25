import { test, expect, type Page } from '@playwright/test';

// Runs the demo path (brief Section 13) with recorded responses and asserts each finding appears.

const shot = (page: Page, name: string) =>
  process.env.SHOTS ? page.screenshot({ path: `screenshots/demo-${name}.png`, fullPage: process.env.FULL === '1' }) : Promise.resolve();

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('demo path', async ({ page }) => {
  await fresh(page);

  // 1. Dashboard: items needing attention across 8 projects.
  await expect(page.getByText('across 8 FRS projects')).toBeVisible();
  await expect(page.getByTestId('attention')).toContainText('State Post-Matric Scholarship Portal');

  // 2. Sources: GO, corrigendum, minutes, Hindi voice brief, scanned form; open a clause.
  await page.goto('/projects/pms-scholarship/sources');
  for (const t of ['GO on online Post-Matric Scholarship', 'Corrigendum 1: income limit', 'Minutes of kick-off meeting', 'Voice brief by Joint Director', 'Existing paper application form']) {
    await expect(page.getByRole('button', { name: new RegExp(t) })).toBeVisible();
  }
  await page.getByRole('button', { name: /Voice brief by Joint Director/ }).click();
  await expect(page.getByText('छात्रों के लिए एक मोबाइल एप्लिकेशन')).toBeVisible();
  await expect(page.getByText('There should also be a mobile application')).toBeVisible();
  await shot(page, '02-sources');

  // 3. Reconcile: supersession, conflict, missing annexure; resolve.
  await page.goto('/projects/pms-scholarship/reconcile');
  await page.getByRole('button', { name: 'Run reconciliation' }).first().click();
  await expect(page.getByTestId('reconcile-gate')).toContainText('Drafting is blocked', { timeout: 15000 });
  await expect(page.getByText('Supersession', { exact: true })).toBeVisible();
  await expect(page.getByText('Conflict', { exact: true })).toBeVisible();
  await expect(page.getByText('Gap by reference', { exact: true })).toBeVisible();
  await shot(page, '03-reconcile');
  // Accept supersession (RES-1), GO prevails in the conflict (RES-2), defer Annexure A (RES-3).
  await page.getByTestId('resolve-RES-1').getByRole('button', { name: 'Record resolution' }).click();
  await page.getByTestId('resolve-RES-2').getByLabel('GO 5.1 prevails').check();
  await page.getByTestId('resolve-RES-2').getByRole('button', { name: 'Record resolution' }).click();
  await page.getByTestId('resolve-RES-3').getByRole('button', { name: 'Defer as open issue' }).click();
  await expect(page.getByTestId('reconcile-gate')).toContainText('All findings resolved');
  await shot(page, '03b-reconciled');
});
