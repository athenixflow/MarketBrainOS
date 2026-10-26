/**
 * Admin portal as an ops_admin (the e2e admin account, promoted by the founder). Every section is
 * already loaded by the route sweep; this covers what a sweep cannot: the scope wall around the
 * super-admin-only sections, the user directory search, and one legitimate admin token grant
 * (+10 to the free test account, which the billing-grants rule allows: admins may grant).
 * Never touched here: refunds, bulk actions, lockdown, pricing or system settings.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole } from '../fixtures/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const accounts = JSON.parse(readFileSync(path.join(here, '..', '.accounts.local.json'), 'utf8')) as { emails: Record<string, string> };
const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });

test.describe('ops_admin', () => {
  test.use(asRole('admin'));
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop-chrome', 'admin: desktop only'); });

  test('super-admin-only sections are walled off', async ({ page, firewall }) => {
    firewall.tolerateBlocks = true;
    await consent(page);
    for (const s of ['pricing', 'settings']) {
      await page.goto(`/admin/${s}`); await settle(page);
      await expect(page.locator('body'), `/admin/${s} must not show its controls to ops_admin`)
        .toContainText(/permission|not authori[sz]ed|restricted|super.?admin|access denied/i);
    }
    await expect(page.locator('nav, aside').getByRole('link', { name: /Pricing & Plans/ })).toHaveCount(0);
  });

  test('the user directory finds the e2e accounts by email', async ({ page }) => {
    await consent(page);
    await page.goto('/admin/users'); await settle(page);
    await page.getByPlaceholder(/search by email/i).fill('e2e-free');
    await expect(page.locator('main')).toContainText(accounts.emails.free, { timeout: 20_000 });
  });

  test('grant +10 tokens to the free account (a legitimate admin grant)', async ({ page, firewall }) => {
    firewall.allow('adminManageTokens');
    await consent(page);
    await page.goto('/admin/users'); await settle(page);
    await page.getByPlaceholder(/search by email/i).fill('e2e-free');
    await page.getByText(accounts.emails.free).first().click();
    await settle(page);
    const before = Number((await page.locator('main').innerText()).match(/(\d+)\s*tokens?/i)?.[1] ?? NaN);
    await page.getByPlaceholder('Amount').fill('10');
    await page.getByRole('button', { name: 'Apply Adjustment' }).click();
    // The confirm box is not marked up as a dialog (an a11y finding), so target its own controls.
    await page.getByPlaceholder('CONFIRM').fill('CONFIRM');
    await page.getByRole('button', { name: /^execute$/i }).click();
    // Then a step-up code. It is a client-side constant (services/securityEngine.ts), itself a finding.
    const stepUp = page.getByPlaceholder('000000');
    await stepUp.fill('133742', { timeout: 20_000 });
    await page.getByRole('button', { name: /^authorize$/i }).click();
    await expect(stepUp).toBeHidden({ timeout: 20_000 });
    await page.waitForTimeout(3_000);
    test.info().annotations.push({ type: 'balance-before', description: String(before) });
  });
});
