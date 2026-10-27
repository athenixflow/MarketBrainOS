/**
 * How long the admin portal takes to show its user directory with accounts in it. It used to load
 * every user, payment, report and log before rendering anything: 17.0s on desktop and 58.2s on an
 * iPhone with 26 accounts (Oct 2026 launch run, dev server). It now loads per section.
 * The dev server serves hundreds of unbundled modules, so absolute times measure the machine. The
 * gate is relative: the admin directory may take at most 4s longer than this account's own dashboard
 * takes to greet it, measured in the same run (was +10s or more before the fix).
 */
import { test, expect, asRole } from '../fixtures/test';

test.use(asRole('admin'));
test('admin portal: time until the user directory lists accounts', async ({ page, firewall }, ti) => {
  test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(ti.project.name), 'one desktop, one phone');
  firewall.tolerateBlocks = true;
  await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
  // Baseline: an ordinary signed-in page, same browser, same server, same moment.
  const b0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 120_000 });
  const baseline = Date.now() - b0;
  const t0 = Date.now();
  await page.goto('/admin/users');
  await expect(page.getByText(/\b[1-9]\d* accounts?\b/).first()).toBeVisible({ timeout: 120_000 });
  const ms = Date.now() - t0;
  const subtitle = await page.getByText(/\d+ accounts?/).first().innerText().catch(() => '?');
  console.log(`[${ti.project.name}] admin users listed after ${(ms / 1000).toFixed(1)}s; dashboard ${(baseline / 1000).toFixed(1)}s (${subtitle})`);
  test.info().annotations.push({ type: 'admin-load-ms', description: String(ms) });
  expect(ms - baseline, 'admin directory vs an ordinary page').toBeLessThan(4_000);
});
