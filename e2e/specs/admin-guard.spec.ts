/**
 * A non-admin must never see the admin portal, on any engine, however slowly the session restores.
 * Repeats the visit so a race shows up as a failure rather than hiding in one lucky run. Admin chrome
 * is recognised by its own "Exit Admin" control and the admin section names.
 */
import { test, expect, asRole } from '../fixtures/test';

/* Negative control: the same detector, on an account that IS an admin, must see the admin chrome.
   Without this, a detector matching nothing would pass the five visits below vacuously. */
test.describe('control: ops_admin on /admin', () => {
  test.use(asRole('admin'));
  test('the detector sees admin content when it is there', async ({ page, firewall }, ti) => {
    test.skip(!['iphone-xr-webkit', 'desktop-chrome'].includes(ti.project.name), 'same projects as below');
    firewall.tolerateBlocks = true;
    await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
    await page.goto('/admin');
    await expect(page.getByText(/Exit Admin|Control Center|User Management/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('pro account on /admin', () => {
  test.use(asRole('pro'));
  for (let i = 1; i <= 5; i++) {
    test(`visit ${i}: never shows admin content, ends on /`, async ({ page, firewall }, ti) => {
      test.skip(!['iphone-xr-webkit', 'desktop-chrome'].includes(ti.project.name), 'WebKit (where the sweep wobbled) + a desktop control');
      firewall.tolerateBlocks = true;
      await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
      await page.goto('/admin');
      // Sample the page as it loads: admin chrome must not appear at any moment.
      for (let t = 0; t < 60; t++) {
        const leaked = await page.getByText(/Exit Admin|Control Center|User Management/i).first().isVisible().catch(() => false);
        expect(leaked, `admin content visible ${t / 2}s after opening /admin`).toBe(false);
        if (new URL(page.url()).pathname === '/') break;
        await page.waitForTimeout(500);
      }
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    });
  }
});
