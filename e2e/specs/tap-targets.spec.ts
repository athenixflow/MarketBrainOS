/**
 * Phone tap targets that the launch run found under 24px: the header's Docs "?" (6px wide), Sign
 * out (16px tall) and "+ Advanced context" (16px tall). WCAG 2.2 target size (minimum) is 24px.
 * The header must also still fit at phone width once they grow.
 */
import { test, expect, settle, asRole } from '../fixtures/test';

const PHONE = ['iphone-xr-webkit', 'pixel-7-chrome'];
const size = (el: Element) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };

test.use(asRole('free'));
test.beforeEach(async ({ page, firewall }, ti) => {
  test.skip(!PHONE.includes(ti.project.name), 'phone only');
  firewall.tolerateBlocks = true;
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
});

test('header: Docs and Sign out are at least 24px, and the header fits', async ({ page }) => {
  await page.goto('/'); await settle(page);
  const docs = await page.getByRole('link', { name: 'Documentation' }).evaluate(size);
  const out = await page.getByRole('button', { name: 'Sign out' }).evaluate(size);
  expect(docs.w, 'Docs "?" width').toBeGreaterThanOrEqual(24);
  expect(docs.h, 'Docs "?" height').toBeGreaterThanOrEqual(24);
  expect(out.h, 'Sign out height').toBeGreaterThanOrEqual(24);
  const overflow = await page.locator('header').first().evaluate((h) => h.scrollWidth - h.clientWidth);
  expect(overflow, 'header must not overflow at phone width').toBeLessThanOrEqual(0);
});

test('tool forms: "+ Advanced context" is at least 24px tall and says whether it is open', async ({ page }) => {
  for (const route of ['/conversion-doctor', '/audience-intelligence']) {
    await page.goto(route); await settle(page);
    const toggle = page.getByRole('button', { name: /advanced context/i }).first();
    expect((await toggle.evaluate(size)).h, `${route} toggle height`).toBeGreaterThanOrEqual(24);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
});
