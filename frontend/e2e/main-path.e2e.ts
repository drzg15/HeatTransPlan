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

  // The heat pump view: Example 1's default pump at the two temperatures the
  // 2-temperature model reads.
  await page.getByRole('button', { name: 'Model 2 temps' }).click();
  const view = page.getByRole('dialog', { name: 'Heat pump temperatures' });
  await expect(view.getByLabel('Source outlet temperature')).toHaveValue('58.6');
  await expect(view.getByLabel('Sink outlet temperature')).toHaveValue('113.0');
  await expect(view.getByText('COP 4.34')).toBeVisible({ timeout: 15_000 });
  // Only the 2-temperature model: no inlet fields, no model pages.
  await expect(view.getByLabel('Source inlet temperature')).toHaveCount(0);
  await expect(view.getByRole('tab')).toHaveCount(0);
  // The optimization's balance: on both profiles at the pump's own point,
  // short of waste heat once the source may only cool to 66 °C.
  await expect(view.getByText(/Needed and available waste heat match/)).toBeVisible();
  await view.getByLabel('Source outlet temperature').fill('66');
  await expect(view.getByText(/kW of waste heat short: source-limited/)).toBeVisible({ timeout: 15_000 });
  await view.getByRole('button', { name: "Back to the pump's values" }).click();
  await view.getByRole('button', { name: 'Close' }).last().click();
  await expect(view).toBeHidden();

  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Report' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toBe('heat_integration_report.html');
  const html = await (await report.createReadStream()).toArray();
  expect(Buffer.concat(html).toString()).toContain('Pinch');

  expect(errors).toEqual([]);
});
