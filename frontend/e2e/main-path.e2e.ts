import { expect, test } from '@playwright/test';

// The path every study takes: the example in, the analysis run, the report out.
// Catches what unit tests cannot: a page that does not render, a request the
// backend refuses, a report that does not come back.
test('example → analysis → report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Try the example' }).click();
  await expect(page).toHaveURL(/data-collection/);

  await page.getByRole('link', { name: 'Potential Analysis' }).first().click();
  await expect(page).toHaveURL(/potential-analysis/);

  // The analysis runs on its own for the selected streams: pinch, then the
  // heat pump optimization with its filters.
  await expect(page.getByText('Pinch Temperature').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Select All' })).toBeVisible({ timeout: 60_000 });

  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Report' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toBe('heat_integration_report.html');
  const html = await (await report.createReadStream()).toArray();
  expect(Buffer.concat(html).toString()).toContain('Pinch');

  expect(errors).toEqual([]);
});
