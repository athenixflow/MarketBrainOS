/**
 * Dashboard tool cards at a 1024px laptop: the title ("Audience Intelligence") and its token badge
 * shared a row that could not wrap, so the badge was pushed past the card edge and cut off ("4 T").
 * Every card's content must fit its card at laptop, tablet and phone widths.
 */
import { test, expect, settle, asRole } from '../fixtures/test';

test.use(asRole('free'));
test('the welcome card quick actions sit in an even grid', async ({ page, firewall }, ti) => {
  test.skip(!['laptop-chrome', 'tablet-chrome', 'desktop-chrome', 'pixel-7-chrome'].includes(ti.project.name));
  firewall.tolerateBlocks = true;
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
  await page.goto('/'); await settle(page);
  const actions = page.locator('[data-quick-actions] > *');
  await expect(actions.first()).toBeVisible({ timeout: 30_000 });
  const widths = await actions.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(widths.length).toBeGreaterThanOrEqual(3);
  expect(Math.max(...widths) - Math.min(...widths), `quick action widths ${widths.join(', ')}`).toBeLessThanOrEqual(2);
});

test('a tool page shows the report outline, not a blank card, before a run', async ({ page, firewall }, ti) => {
  test.skip(ti.project.name !== 'desktop-chrome', 'desktop: the result column sits beside the form');
  firewall.tolerateBlocks = true;
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
  await page.goto('/audience-intelligence'); await settle(page);
  const outline = page.getByLabel('Your report will include');
  await expect(outline).toBeVisible({ timeout: 30_000 });
  await expect(outline.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByText('Your analysis will appear here')).toHaveCount(0);
});

test('every dashboard tool card fits, badge included', async ({ page, firewall }, ti) => {
  test.skip(!['laptop-chrome', 'tablet-chrome', 'desktop-chrome', 'pixel-7-chrome'].includes(ti.project.name));
  firewall.tolerateBlocks = true;
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
  await page.goto('/'); await settle(page);
  await page.locator('#tools-section').scrollIntoViewIfNeeded().catch(() => {});
  await expect(page.getByRole('link', { name: 'Open tool' }).first()).toBeVisible({ timeout: 30_000 });
  const clipped = await page.evaluate(() => [...document.querySelectorAll('#tools-section .paper')]
    .filter((card) => card.scrollWidth > card.clientWidth + 1)
    .map((card) => `${(card.querySelector('h3') as HTMLElement)?.innerText} (${card.scrollWidth} in ${card.clientWidth})`));
  const cards = await page.locator('#tools-section .paper').count();
  expect(cards, 'found the tool cards').toBeGreaterThan(10);
  expect(clipped, 'tool cards whose content is cut off').toEqual([]);
});
