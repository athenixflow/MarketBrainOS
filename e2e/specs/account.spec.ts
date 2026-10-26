/**
 * Sign-in, password and account flows on the real backend. The throwaway account's password change
 * and deletion run last and serially: deletion is irreversible, which is what that account is for.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole } from '../fixtures/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const accounts = JSON.parse(readFileSync(path.join(here, '..', '.accounts.local.json'), 'utf8')) as { password: string; emails: Record<string, string> };
const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
const desktopOnly = ({}, ti: { project: { name: string } }) => { test.skip(ti.project.name !== 'desktop-chrome', 'account flows: desktop only'); };

/** Settings tabs are plain buttons; scope to <main> so the header's Notifications bell is not picked. */
async function openTab(page: Page, name: string) {
  const main = page.locator('main');
  await main.getByRole('tab', { name, exact: true }).or(main.getByRole('button', { name, exact: true })).first().click();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('signed out', () => {
  test.use(asRole(null));
  test.beforeEach(desktopOnly);

  test('wrong password shows an error and stays on /auth', async ({ page }) => {
    await consent(page);
    await page.goto('/auth'); await settle(page);
    await signIn(page, accounts.emails.free, 'not-the-password-123');
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('forgot password sends a reset (one email to the free alias)', async ({ page, firewall }) => {
    firewall.allow('requestPasswordReset');
    await consent(page);
    await page.goto('/auth'); await settle(page);
    await page.getByRole('button', { name: 'Forgot?' }).click();
    await page.getByLabel('Email', { exact: true }).fill(accounts.emails.free);
    await page.getByRole('button', { name: /send|reset/i }).last().click();
    await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: /sent|check your (email|inbox)|if an account/i }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('an invalid email-action link says so', async ({ page }) => {
    await consent(page);
    await page.goto('/auth/action?mode=resetPassword&oobCode=not-a-real-code'); await settle(page);
    await expect(page.getByText(/invalid link|expired|already been used/i).first()).toBeVisible({ timeout: 20_000 });
    await page.goto('/auth/action?mode=verifyEmail&oobCode=not-a-real-code'); await settle(page);
    await expect(page.getByText(/invalid link|expired|already been used|could not/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('a deep link survives sign-in (bug #4: lands on / instead)', async ({ page }) => {
    await consent(page);
    await page.goto('/billing'); await settle(page);
    await expect(page).toHaveURL(/\/auth$/);
    await signIn(page, accounts.emails.free, accounts.password);
    await page.waitForURL((u) => u.pathname !== '/auth', { timeout: 45_000 });
    await settle(page);
    expect(new URL(page.url()).pathname, 'after signing in, the visitor should be back where they were going').toBe('/billing');
  });

  test('Continue with Google opens the Google sign-in popup', async ({ page }) => {
    await consent(page);
    await page.goto('/auth'); await settle(page);
    const popup = page.waitForEvent('popup', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    const p = await popup;
    await p.waitForLoadState('domcontentloaded').catch(() => {});
    expect(p.url()).toMatch(/accounts\.google\.com|firebaseapp\.com\/__\/auth/);
    await p.close();
  });
});

test.describe('settings (free account)', () => {
  test.use(asRole('free'));
  test.beforeEach(desktopOnly);

  test('every tab renders without errors', async ({ page, diag }) => {
    await consent(page);
    await page.goto('/settings'); await settle(page);
    for (const tab of ['Profile', 'Account', 'Security', 'Notifications', 'Subscription', 'Billing', 'Integrations']) {
      await openTab(page, tab);
      await page.waitForTimeout(800);
      await expect(page.locator('main')).not.toBeEmpty();
    }
    expect(diag.pageErrors).toEqual([]);
  });

  test('a profile edit survives a reload, then is reverted', async ({ page }) => {
    await consent(page);
    await page.goto('/settings'); await settle(page);
    const company = page.getByLabel(/company/i).first();
    const original = await company.inputValue();
    await company.fill('E2E Test Co');
    await page.getByRole('button', { name: /save profile/i }).click();
    await page.waitForTimeout(2_000);
    await page.reload(); await settle(page);
    await expect(page.getByLabel(/company/i).first()).toHaveValue('E2E Test Co');
    await page.getByLabel(/company/i).first().fill(original);
    await page.getByRole('button', { name: /save profile/i }).click();
    await page.waitForTimeout(2_000);
  });

  test('a notification toggle survives a reload, then is reverted', async ({ page }) => {
    await consent(page);
    await page.goto('/settings'); await settle(page);
    await openTab(page, 'Notifications');
    const toggle = page.getByRole('switch', { name: /product updates/i }).or(page.getByLabel(/product updates/i)).first();
    const was = (await toggle.getAttribute('aria-checked')) ?? String(await toggle.isChecked());
    await toggle.click();
    await page.waitForTimeout(2_000);
    await page.reload(); await settle(page);
    await openTab(page, 'Notifications');
    const t2 = page.getByRole('switch', { name: /product updates/i }).or(page.getByLabel(/product updates/i)).first();
    const now = (await t2.getAttribute('aria-checked')) ?? String(await t2.isChecked());
    expect(now, 'the toggle should keep its new state').not.toBe(was);
    await t2.click();
    await page.waitForTimeout(2_000);
  });
});

test.describe.serial('throwaway account: password change, then deletion', () => {
  test.use(asRole('throwaway'));
  test.beforeEach(desktopOnly);
  const newPassword = `${accounts.password}-2`;

  test('change password, then sign in with the new one', async ({ page, browser }) => {
    await consent(page);
    await page.goto('/settings'); await settle(page);
    await openTab(page, 'Security');
    await page.getByLabel('Current password').fill(accounts.password);
    await page.getByLabel('New password').fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/updated|changed/i).first()).toBeVisible({ timeout: 20_000 });

    const fresh = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await fresh.newPage();
    await p.goto('/auth');
    await signIn(p, accounts.emails.throwaway, newPassword);
    await p.waitForURL((u) => u.pathname === '/', { timeout: 45_000 });
    await fresh.close();
  });

  test('delete the account: dry run, confirm, gone', async ({ page, firewall }) => {
    firewall.allow('deleteAccount');
    await consent(page);
    // The password change revoked the saved session (as it should), so sign in afresh.
    await page.goto('/auth'); await settle(page);
    await signIn(page, accounts.emails.throwaway, newPassword);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 });
    await page.goto('/settings'); await settle(page);
    await openTab(page, 'Account');
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByLabel('Type DELETE to confirm').fill('DELETE', { timeout: 30_000 });
    await page.getByLabel('Your password').fill(newPassword);
    await page.getByRole('button', { name: 'Delete my account permanently' }).click();
    await page.waitForURL(/\/auth\?deleted=1/, { timeout: 60_000 });
    await expect(page.getByText('Deletion complete')).toBeVisible();

    await signIn(page, accounts.emails.throwaway, newPassword);
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 20_000 });
  });
});
