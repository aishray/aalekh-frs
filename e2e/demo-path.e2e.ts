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
  if (process.env.RECORD) test.setTimeout(900_000);
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

  // 6. Generate FRS: builds from the model; click GO 4.2; reused requirement from Building Plan Approval.
  await page.goto('/projects/pms-scholarship/document');
  await page.getByRole('button', { name: 'Generate FRS' }).first().click();
  await expect(page.locator('article[data-req]')).not.toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Regenerate all' })).toBeEnabled({ timeout: 90000 });
  const count = await page.locator('article[data-req]').count();
  expect(count).toBeGreaterThanOrEqual(50);
  expect(count).toBeLessThanOrEqual(80);
  await page.locator('#FR-REG-002').getByRole('button', { name: 'GO 4.2' }).click();
  await expect(page.getByRole('complementary', { name: 'Reference GO 4.2' })).toContainText('Aadhaar-based e-KYC');
  await shot(page, '06-document-ref');
  await page.keyboard.press('Escape');
  const reuse = page.getByTestId('reuse-FR-APP-002');
  await expect(reuse).toContainText('FR-APP-011');
  await expect(reuse).toContainText('Online Building Plan Approval');
  await reuse.scrollIntoViewIfNeeded();
  await shot(page, '06b-document-reuse');

  // 7. Quality: GO 7.3 uncovered, "quickly", DBT payment failure; fixing all three raises the score.
  await page.goto('/projects/pms-scholarship/quality');
  await page.getByRole('button', { name: 'Run full review' }).click();
  const issues = page.getByTestId('issues');
  await expect(issues).toContainText('DBT payment fails', { timeout: 20000 });
  await expect(issues).toContainText('GO-7.3 (Timeline) is not cited by any requirement');
  await expect(issues).toContainText('uses the ambiguous term "quickly"');
  const before = Number(await page.getByTestId('score-total').innerText());
  await shot(page, '07-quality');
  for (const issue of ['COV-GO-7.3', 'AMB-FR-GRV-001-quickly', 'REV-1']) {
    const row = page.locator(`tr[data-issue="${issue}"]`);
    await row.getByRole('button', { name: /Fix|Draft requirement/ }).click();
    await row.getByRole('button', { name: 'Accept' }).click({ timeout: 20000 });
  }
  await expect(issues).not.toContainText('quickly');
  const after = Number(await page.getByTestId('score-total').innerText());
  expect(after).toBeGreaterThan(before);
  await shot(page, '07b-quality-fixed');

  // 8. Approve as Director (baseline v1.0); Corrigendum 2 impact; vendor CR scope check.
  await page.goto('/projects/pms-scholarship/review');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByTestId('persona-menu').click();
  await page.getByRole('menuitemradio', { name: /S\. Raghavan/ }).click();
  await page.getByRole('button', { name: 'Approve and freeze baseline' }).click();
  await expect(page.getByText('Baseline v1.0').first()).toBeVisible();
  await expect(page.getByTestId('noting')).toContainText('S. Raghavan');
  await shot(page, '08-approved');

  await page.goto('/projects/pms-scholarship/changes');
  await page.getByRole('button', { name: 'Add corrigendum' }).click();
  await page.getByRole('button', { name: 'Corrigendum 2 (grievance timeline)' }).click();
  await page.getByRole('button', { name: 'Index clauses' }).click();
  await page.getByRole('button', { name: 'Run impact analysis' }).click({ timeout: 20000 });
  const impact = page.getByTestId('impact').first();
  await expect(impact).toContainText('supersedes', { timeout: 20000 });
  const imp = page.locator('table').filter({ hasText: 'Affected item' }).first();
  await expect(imp).toContainText('FR-GRV-004');
  await expect(imp).toContainText('TC-FR-GRV-004-1');
  await expect(imp).toContainText('5 working days');
  await shot(page, '08b-impact');
  await page.getByRole('button', { name: 'Apply as tracked changes' }).click();

  await page.getByRole('tab', { name: 'Vendor change request scope check' }).click();
  await page.getByRole('button', { name: 'Load sample CR-07' }).click();
  await page.getByRole('button', { name: 'Check scope' }).click();
  const cr = page.getByTestId('cr-result');
  await expect(cr).toBeVisible({ timeout: 20000 });
  await expect(cr.locator('tr[data-classification="In scope"]')).toHaveCount(2);
  await expect(cr.locator('tr[data-classification="New scope"]')).toHaveCount(1);
  await expect(cr.locator('tr[data-classification="In scope"]').first()).toContainText('FR-NOT-001');
  await expect(cr.locator('tr[data-classification="New scope"]')).toContainText('Income Tax');
  await shot(page, '08c-cr');

  // 9. Export: Word FRS and UAT test cases in Excel.
  await page.goto('/projects/pms-scholarship/export');
  const [word] = await Promise.all([page.waitForEvent('download'), page.getByRole('listitem').filter({ hasText: 'FRS in Word' }).getByRole('button', { name: 'Download' }).click()]);
  expect(word.suggestedFilename()).toMatch(/\.docx$/);
  await word.saveAs('test-results/demo-frs.docx');
  const [xl] = await Promise.all([page.waitForEvent('download'), page.getByRole('listitem').filter({ hasText: 'UAT test cases' }).getByRole('button', { name: 'Download' }).click()]);
  expect(xl.suggestedFilename()).toMatch(/\.xlsx$/);
  await xl.saveAs('test-results/demo-uat.xlsx');
  const [note] = await Promise.all([page.waitForEvent('download'), page.getByRole('listitem').filter({ hasText: 'CR assessment note' }).getByRole('button', { name: 'Download' }).click()]);
  await note.saveAs('test-results/demo-cr-note.docx');
  await shot(page, '09-export');

  // Beyond the demo path: data dictionary, roles, deliverables and library on the same state.
  await page.goto('/projects/pms-scholarship/data');
  await page.getByRole('button', { name: 'Build from form' }).first().click();
  await expect(page.locator('tr[data-field="FLD-aadhaarNumber"]')).toContainText('Verhoeff', { timeout: 20000 });
  await expect(page.getByText(/Aadhaar number.*classified Aadhaar or sensitive/)).toBeVisible();
  await shot(page, '10-data');
  await page.goto('/projects/pms-scholarship/roles');
  await page.getByRole('button', { name: 'Propose matrix' }).first().click();
  await expect(page.getByText('No role both verifies and sanctions')).toBeVisible({ timeout: 20000 });
  await page.getByLabel('Institution nodal officer can Sanction').check();
  await expect(page.getByTestId('perm-findings')).toContainText('Maker-checker');
  await page.getByLabel('Institution nodal officer can Sanction').uncheck();
  await shot(page, '11-roles');
  await page.goto('/projects/pms-scholarship/deliverables');
  await expect(page.getByText('TC-WF-1')).toBeVisible();
  await page.getByRole('tab', { name: /Screen inventory/ }).click();
  await expect(page.getByText('Application detail with actions').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Indicative size estimate' }).click();
  await expect(page.getByText('Indicative, for planning only.')).toBeVisible();
  await shot(page, '12-estimate');
  await page.goto('/library');
  await page.getByLabel('Search the library').fill('assisted application consent OTP');
  await expect(page.getByText('FR-APP-011').first()).toBeVisible();
  await shot(page, '13-library');

  // `npm run record` only: exercise the remaining AI steps so their live responses are captured too.
  if (process.env.RECORD) {
    await page.goto('/projects/pms-scholarship/discovery');
    await page.getByRole('tab', { name: /Interview/ }).click();
    await page.getByRole('button', { name: 'Generate questions' }).click();
    await expect(page.getByText(/^Questions for /)).toBeVisible({ timeout: 30000 });
    await page.goto('/projects/pms-scholarship/sources');
    await page.getByRole('button', { name: 'Add source' }).first().click();
    await page.getByLabel('Type').selectOption('Form');
    await page.getByLabel('Name').fill('Scanned application form (recording)');
    await page.locator('input[type=file][accept*=".pdf"]').setInputFiles('public/samples/application_form.png');
    await page.getByRole('button', { name: 'Index clauses' }).click();
    await expect(page.getByRole('button', { name: /Scanned application form \(recording\)/ })).toBeVisible({ timeout: 60000 });
  }
});
