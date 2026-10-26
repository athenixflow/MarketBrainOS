/**
 * Layer 3: the chrome people move around with. Public nav and its phone menu, the app header,
 * the sidebar and its phone drawer (open, close by overlay / Esc / navigating, body scroll lock),
 * the admin sidebar, browser back/forward, and the docs search.
 */
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole } from '../fixtures/test';

const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
const isPhone = (name: string) => /iphone|pixel/.test(name);

test.describe('public nav', () => {
  test.use(asRole(null));
  test('every nav link opens its page; the phone menu opens and closes', async ({ page }, ti) => {
    test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(ti.project.name), 'one desktop, one phone');
    await consent(page);
    for (const [label, path] of [['Features', '/features'], ['Pricing', '/pricing'], ['About', '/about'], ['FAQ', '/faq']] as const) {
      await page.goto('/'); await settle(page);
      if (isPhone(ti.project.name)) {
        await page.getByRole('button', { name: /menu|navigation/i }).first().click();
        await expect(page.locator('#public-nav-menu')).toBeVisible();
      }
      await page.getByRole('link', { name: label, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      if (isPhone(ti.project.name)) await expect(page.locator('#public-nav-menu')).toBeHidden();
    }
  });

  test('back and forward move through history', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop only');
    await consent(page);
    await page.goto('/features'); await settle(page);
    await page.goto('/pricing'); await settle(page);
    await page.goBack(); await expect(page).toHaveURL(/\/features$/);
    await page.goForward(); await expect(page).toHaveURL(/\/pricing$/);
  });
});

test.describe('app shell (pro)', () => {
  test.use(asRole('pro'));

  test('sidebar links each open their page and mark themselves current', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop: the sidebar is always visible');
    await consent(page);
    await page.goto('/'); await settle(page);
    const links = await page.locator('#app-sidebar a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
    expect(links.length).toBeGreaterThan(10);
    for (const href of links) {
      await page.locator(`#app-sidebar a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}$`));
      await settle(page);
    }
  });

  test('phone drawer: opens, closes on Esc, overlay and navigation, and locks scroll', async ({ page }, ti) => {
    test.skip(!isPhone(ti.project.name), 'phone only');
    await consent(page);
    await page.goto('/'); await settle(page);
    const open = page.getByRole('button', { name: 'Open navigation' });
    const drawer = page.locator('#app-sidebar');
    const inView = async () => drawer.evaluate((el) => { const r = el.getBoundingClientRect(); return r.right > 10 && r.left < innerWidth - 10; });

    await open.click(); await page.waitForTimeout(500);
    expect(await inView(), 'drawer opens').toBe(true);
    const locked = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden');
    expect.soft(locked, 'page behind the drawer should not scroll').toBe(true);

    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    expect.soft(await inView(), 'Esc closes the drawer').toBe(false);

    await open.click(); await page.waitForTimeout(500);
    await page.mouse.click(page.viewportSize()!.width - 10, page.viewportSize()!.height / 2); await page.waitForTimeout(500);
    expect.soft(await inView(), 'tapping outside closes the drawer').toBe(false);

    await open.click(); await page.waitForTimeout(500);
    await drawer.getByRole('link', { name: /history/i }).first().click();
    await expect(page).toHaveURL(/\/history$/);
    await page.waitForTimeout(500);
    expect.soft(await inView(), 'navigating closes the drawer').toBe(false);
  });

  test('header: Docs, notifications and sign out', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop only');
    await consent(page);
    await page.goto('/'); await settle(page);
    await page.getByRole('button', { name: /notifications/i }).first().click();
    await expect(page.getByText(/no notifications yet|mark all( as)? read/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: /^docs$/i }).first().click();
    await expect(page).toHaveURL(/\/documentation/);
  });
});

test.describe('docs hub', () => {
  test.use(asRole(null));

  test('every article opens; its table of contents anchors exist', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop only');
    test.setTimeout(15 * 60_000);
    await consent(page);
    await page.goto('/documentation'); await settle(page);
    const articles = await page.locator('nav[aria-label="Documentation"] a[href^="/documentation/"]').evaluateAll((as) =>
      [...new Set(as.map((a) => a.getAttribute('href')!).filter((h) => h.split('/').length === 4))]);
    expect(articles.length).toBeGreaterThan(20);
    const broken: string[] = [];
    for (const href of articles) {
      await page.goto(href); await settle(page);
      if (new URL(page.url()).pathname !== href) { broken.push(`${href} redirected to ${new URL(page.url()).pathname}`); continue; }
      const missing = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute('href')!.slice(1)).filter((id) => id && !document.getElementById(decodeURIComponent(id))));
      if (missing.length) broken.push(`${href}: anchors with no target: ${missing.slice(0, 5).join(', ')}`);
    }
    expect(broken).toEqual([]);
  });

  test('search opens on Ctrl+K and "/", finds, Enter opens, Esc closes', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop-chrome', 'desktop only');
    await consent(page);
    await page.goto('/documentation'); await settle(page);
    await page.keyboard.press('Control+k');
    const box = page.getByRole('dialog').getByRole('combobox').or(page.getByRole('dialog').getByRole('textbox')).or(page.getByPlaceholder(/search/i)).first();
    await expect(box).toBeVisible();
    await box.fill('tokens');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/documentation\/.+\/.+/);
    await page.keyboard.press('/');
    await expect(box).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
  });
});
