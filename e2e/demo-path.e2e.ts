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

  // 4. Discovery: checklist shows missing payment failure, appeal, legacy migration; answer two questions.
  await page.goto('/projects/pms-scholarship/discovery');
  await page.getByRole('button', { name: 'Run discovery' }).first().click();
  const checklist = page.getByTestId('checklist');
  await expect(checklist).toBeVisible({ timeout: 20000 });
  for (const topic of ['Payment failure handling', 'Appeal against rejection', 'Legacy data migration']) {
    await expect(checklist.getByRole('row', { name: new RegExp(topic) })).toContainText('Missing');
  }
  await shot(page, '04-discovery');
  await page.getByRole('tab', { name: /Questions and assumptions/ }).click();
  await page.getByRole('button', { name: /Notify the student by SMS to correct bank details/ }).click();
  await page.getByRole('button', { name: 'Save answer' }).first().click();
  await page.getByRole('button', { name: /Appeal to the Director, Social Welfare within 30 days/ }).click();
  await page.getByRole('button', { name: 'Save answer' }).first().click();
  await expect(page.getByText('Answered, citable as ANS-1')).toBeVisible();
  await expect(page.getByText('Answered, citable as ANS-2')).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Use default assumption' }).first().click();
  await shot(page, '04b-questions');

  // 5. Workflow: RTS 30 of 30 compliant; SLA 15 to 20 fails; rules tester.
  await page.goto('/projects/pms-scholarship/workflow');
  await page.getByRole('button', { name: 'Propose workflow' }).first().click();
  await expect(page.getByTestId('rts')).toContainText('Total 30 working days against notified 30 days: compliant', { timeout: 20000 });
  await expect(page.locator('.mermaid-host svg')).toBeVisible({ timeout: 20000 });
  await shot(page, '05-workflow');
  await page.getByRole('button', { name: 'Edit WF-T3' }).click();
  await page.getByLabel('SLA (working days)').fill('20');
  await page.getByRole('button', { name: 'Save transition' }).click();
  await expect(page.getByTestId('rts')).toContainText('35 working days exceeds the notified 30 days');
  await shot(page, '05b-workflow-rts-fail');
  await page.getByRole('button', { name: 'Edit WF-T3' }).click();
  await page.getByLabel('SLA (working days)').fill('15');
  await page.getByRole('button', { name: 'Save transition' }).click();
  await expect(page.getByTestId('rts')).toContainText('compliant');

  await page.goto('/projects/pms-scholarship/rules');
  await page.getByRole('button', { name: 'Build decision tables' }).first().click();
  await page.getByRole('tab', { name: /Boundary tests/ }).click({ timeout: 20000 });
  await expect(page.getByText('₹3,00,001').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Rule tester' }).click();
  await page.getByLabel('State of domicile').fill('Rajyapradesh');
  await page.getByLabel(/Annual family income/).fill('300001');
  await page.getByLabel('Course level').fill('Post-matric');
  await page.getByLabel('Institution recognised in Rajyapradesh').selectOption('Yes');
  await page.getByRole('button', { name: 'Check eligibility' }).click();
  const result = page.getByTestId('rule-result');
  await expect(result).toContainText('Ineligible: BR-002');
  await expect(result).toContainText('₹3,00,001');
  await expect(result.getByRole('button', { name: 'COR1 1' }).first()).toBeVisible();
  await shot(page, '05c-rule-tester');
});
