/**
 * Founder decision D1 (Oct 2026): Nigerian buyers keep both price lists, and a dollar price shown to
 * them says it is charged in USD (checkout pins billing_currency, so it is). Enterprise has no naira
 * price; under the Naira toggle it used to read "$999/mo" with no word about the currency.
 */
import { test, expect, settle, asRole } from '../fixtures/test';

test.use({ ...asRole(null), timezoneId: 'Africa/Lagos', locale: 'en-NG' });
test.beforeEach(async ({ page }, ti) => {
  test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(ti.project.name), 'one desktop, one phone');
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
});

test('pricing, as a Nigerian visitor: naira by default, "Charged in USD" when dollars are picked', async ({ page }) => {
  await page.goto('/pricing'); await settle(page);
  const naira = page.getByRole('button', { name: /naira/i });
  const dollars = page.getByRole('button', { name: /dollars/i });
  await expect(naira).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Charged in USD')).toHaveCount(0);
  await expect(page.getByText('Billed in USD').first(), 'Enterprise, dollars-only, says so under Naira').toBeVisible();

  await dollars.click();
  await expect(dollars).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Charged in USD').first()).toBeVisible();
});

test('a visitor outside Nigeria never sees the note', async ({ browser }, ti) => {
  test.skip(ti.project.name !== 'desktop-chrome');
  const ctx = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US', storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/pricing'); await settle(page);
  await page.getByRole('button', { name: /dollars/i }).click();
  await expect(page.getByText('Charged in USD')).toHaveCount(0);
  await ctx.close();
});
