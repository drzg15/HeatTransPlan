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

  // The heat pump view: Example 1's default pump at its four temperatures,
  // then the same point through the Carnot reference.
  await page.getByRole('button', { name: 'Heat pump temperatures' }).click();
  const view = page.getByRole('dialog', { name: 'Heat pump temperatures' });
  await expect(view.getByLabel('Source outlet temperature')).toHaveValue('58.2');
  await expect(view.getByLabel('Sink outlet temperature')).toHaveValue('113.0');
  await expect(view.getByText('COP 4.75')).toBeVisible({ timeout: 15_000 });
  // The optimization's balance: on both profiles at the pump's own point,
  // short of waste heat once the source may only cool to 66 °C.
  await expect(view.getByText(/Needed and available waste heat match/)).toBeVisible();
  await view.getByLabel('Source outlet temperature').fill('66');
  await expect(view.getByText(/kW of waste heat short: source-limited/)).toBeVisible({ timeout: 15_000 });
  await view.getByRole('button', { name: "Back to the pump's values" }).click();
  await view.getByLabel('Carnot (50 %)').check();
  await expect(view.getByText('COP 4.29')).toBeVisible();
  // Ticking T source,in makes the optimization search it too (it re-runs):
  // it then follows the source position, like T source,out.
  // The COP model page: the same inputs give the same prediction; changing
  // one input changes it live.
  await view.getByRole('tab', { name: 'COP model' }).click();
  await expect(view.getByText('COP 4.748')).toBeVisible({ timeout: 15_000 });
  await view.getByLabel('Sink outlet', { exact: true }).fill('100');
  await expect(view.getByText('COP 4.748')).toBeHidden({ timeout: 15_000 });
  await view.getByRole('tab', { name: 'Heat pump' }).click();
  await view.getByLabel('Search T source,in in the optimization').check();
  await expect(async () => {
    const sourceIn = await view.getByLabel('Source inlet temperature').inputValue();
    expect(sourceIn).not.toBe('68.0');
    expect(sourceIn).toBe(await view.getByLabel('Source outlet temperature').inputValue());
  }).toPass({ timeout: 30_000 });
  await view.getByLabel('Search T source,in in the optimization').uncheck();
  await expect(view.getByLabel('Source inlet temperature')).toHaveValue('68.0', { timeout: 30_000 });
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
