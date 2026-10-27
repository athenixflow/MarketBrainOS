/**
 * Accessibility regression gate for the main pages: zero serious or critical axe violations (WCAG 2.2
 * A/AA, contrast included) on 27 pages, desktop and iPhone. The launch run found 377 pages flagged
 * (1,337 low-contrast elements, 168 unnamed buttons, buttons nested in links, unfocusable scroll
 * regions, unlabeled switches). a11y.spec.ts still sweeps every route; this is the short gate.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, settle, asRole } from '../fixtures/test';

const PAGES: Record<string, string[]> = {
  null: ['/', '/pricing', '/features', '/about', '/faq', '/compare', '/compare/chatgpt', '/press', '/status', '/privacy',
    '/documentation', '/documentation/getting-started', '/tools/landing-page-score', '/auth', '/research/landing-page-study-2026'],
  pro: ['/', '/angle-miner', '/conversion-doctor', '/test-lab', '/audience-intelligence', '/settings', '/billing', '/store', '/history', '/reports', '/team', '/workflow'],
};

for (const [r, routes] of Object.entries(PAGES)) {
  test.describe(`a11y gate as ${r === 'null' ? 'signed-out' : r}`, () => {
    test.use(asRole(r === 'null' ? null : (r as any)));
    for (const route of routes) {
      test(route, async ({ page, firewall }, ti) => {
        test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(ti.project.name), 'one desktop, one phone');
        firewall.tolerateBlocks = true;
        await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
        await page.goto(route); await settle(page);
        await page.waitForTimeout(1500); // let entrance animations finish: mid-fade colours are not the real ones
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const serious = res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
          .map((v) => `${v.impact}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(serious, `serious/critical axe violations on ${route}`).toEqual([]);
      });
    }
  });
}

test.describe('keyboard: tabs', () => {
  test.use(asRole('pro'));
  test('Settings tabs: only the selected tab is a Tab stop; arrow keys move and select', async ({ page, firewall }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop keyboard');
    firewall.tolerateBlocks = true;
    await page.goto('/settings'); await settle(page);
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const n = await tabs.count();
    expect(n).toBeGreaterThan(2);
    const stops = await tabs.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') !== '-1').length);
    expect(stops, 'one Tab stop in the tab row').toBe(1);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.nth(n - 1)).toHaveAttribute('aria-selected', 'true');
  });
});
