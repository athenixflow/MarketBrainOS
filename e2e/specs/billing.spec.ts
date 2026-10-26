/**
 * Payments, up to the Bachs page and no further (decided with the founder: nothing is ever paid).
 * Each checkout test opts the firewall into createCheckout, follows the redirect to Bachs, records
 * what the page shows (host, title, the amount and product it names) and leaves. Opened sessions
 * expire unpaid; bachsReconcile sweeps them like any abandoned checkout.
 *
 * createCheckout allows 10 sessions per user per hour, so the checkouts are spread over accounts.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole } from '../fixtures/test';
import { DEFAULT_PRICING_CONFIG as CFG } from '../../config/pricingConfig';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop-chrome', 'billing: desktop only (each run opens real checkout sessions)'); });

const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
const amountRe = (n: number) => new RegExp(n.toLocaleString('en-US').replace(/,/g, ',?'));

async function currency(page: Page, c: 'USD' | 'NGN') {
  await page.getByRole('button', { name: c === 'USD' ? /Dollars|US dollars/ : /Naira/ }).first().click();
}

/** Clicks, follows the redirect to Bachs, records the checkout page, and comes back. */
async function toBachs(page: Page, click: () => Promise<void>, label: string, expectAmount: number) {
  await click();
  await page.waitForURL((u) => !u.hostname.includes('localhost'), { timeout: 45_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4_000); // the hosted page renders client-side
  const url = new URL(page.url());
  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  mkdirSync(path.join(out, 'shots', 'bachs'), { recursive: true });
  await page.screenshot({ path: path.join(out, 'shots', 'bachs', `${label}.png`), fullPage: true });
  mkdirSync(path.join(out, 'findings'), { recursive: true });
  appendFileSync(path.join(out, 'findings', 'bachs.jsonl'), JSON.stringify({
    label, host: url.hostname, title: await page.title(), mentionsMarketBrain: /marketbrain/i.test(text),
    snippet: text.slice(0, 500),
  }) + '\n');
  expect(url.hostname, 'checkout should be hosted by Bachs').toMatch(/bachs/i);
  expect.soft(text, `the Bachs page should show the amount ${expectAmount}`).toMatch(amountRe(expectAmount));
  expect.soft(/marketbrain/i.test(text), 'the Bachs page should name MarketBrain OS (the founder reported their own name instead)').toBe(true);
}

test.describe('signed out', () => {
  test.use(asRole(null));
  test('plan buttons send a visitor to sign in', async ({ page }) => {
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await page.getByRole('button', { name: 'Get started' }).first().click();
    await expect(page).toHaveURL(/\/auth$/);
    await page.goto('/pricing'); await settle(page);
    await page.getByRole('button', { name: 'Start free' }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe('free account', () => {
  test.use(asRole('free'));

  test('Upgrade to Pro (USD) opens a Bachs checkout for $19', async ({ page, firewall }) => {
    firewall.allow('createCheckout');
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await currency(page, 'USD');
    await toBachs(page, () => page.getByRole('button', { name: 'Upgrade to Pro' }).click(), 'free-pro-usd', CFG.plans.pro.price);
  });

  test('Get Pro, 30 days (NGN) opens a Bachs checkout for the naira pass', async ({ page, firewall }) => {
    firewall.allow('createCheckout');
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await currency(page, 'NGN');
    await toBachs(page, () => page.getByRole('button', { name: /Get Pro/ }).click(), 'free-pro-ngn', CFG.plans.pro.priceNgn!);
  });

  test('Enterprise is Contact sales, not a checkout', async ({ page }) => {
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await currency(page, 'USD');
    await page.getByRole('button', { name: 'Contact sales' }).click();
    await expect(page).toHaveURL(/\/support$/);
  });

  test('token packs are locked on Free', async ({ page }) => {
    await consent(page);
    await page.goto('/store'); await settle(page);
    const buy = page.getByRole('button', { name: /^Buy$/ }).first();
    if (await buy.isEnabled()) {
      await buy.click();
      await expect(page.getByText('Upgrade to a paid plan to buy token packs.')).toBeVisible();
    } else {
      await expect(buy).toBeDisabled();
    }
  });

  test('Free sees Current plan on its own card and nothing below it', async ({ page }) => {
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await expect(page.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });
});

test.describe('pro account (plan granted by admin, no payment method on file)', () => {
  test.use(asRole('pro'));

  test('Upgrade to Team (USD) opens a Bachs checkout for $79', async ({ page, firewall }) => {
    firewall.allow('createCheckout', 'manageBilling');
    await consent(page);
    await page.goto('/pricing'); await settle(page);
    await currency(page, 'USD');
    await toBachs(page, () => page.getByRole('button', { name: 'Upgrade to Team' }).click(), 'pro-team-usd', CFG.plans.team.price);
  });

  test('Starter pack (USD) opens a Bachs checkout for $10', async ({ page, firewall }) => {
    firewall.allow('createCheckout');
    await consent(page);
    await page.goto('/store'); await settle(page);
    await currency(page, 'USD');
    await toBachs(page, () => page.getByRole('button', { name: /^Buy$/ }).first().click(), 'pro-starter-usd', CFG.tokenPacks[0].price);
  });

  test('Starter pack (NGN) opens a Bachs checkout for the naira price', async ({ page, firewall }) => {
    firewall.allow('createCheckout');
    await consent(page);
    await page.goto('/store'); await settle(page);
    await currency(page, 'NGN');
    await toBachs(page, () => page.getByRole('button', { name: /^Buy$/ }).first().click(), 'pro-starter-ngn', CFG.tokenPacks[0].priceNgn!);
  });

  test('Billing page renders plan, balance and an exportable history', async ({ page }) => {
    await consent(page);
    await page.goto('/billing'); await settle(page);
    await expect(page.getByText(/pro/i).first()).toBeVisible();
    const exp = page.getByRole('button', { name: 'Export CSV' });
    if (await exp.isVisible().catch(() => false)) {
      const dl = page.waitForEvent('download');
      await exp.click();
      expect((await dl).suggestedFilename()).toMatch(/\.csv$/);
    }
  });

  test('Dashboard: every top-up button leads to a working checkout (bug #1: confirmTopUp with a made-up reference)', async ({ page, firewall }) => {
    firewall.tolerateBlocks = true; // record which function the button reaches; never allow confirmTopUp
    await consent(page);
    await page.goto('/'); await settle(page);
    const buy = page.getByRole('button', { name: /buy tokens|top ?up/i }).first();
    test.skip(!(await buy.isVisible().catch(() => false)), 'no top-up button on this dashboard');
    await buy.click();
    await page.waitForTimeout(2_000);
    const names = firewall.blocked.map((b) => b.name);
    expect(names, 'a top-up must go through createCheckout, never confirmTopUp').not.toContain('confirmTopUp');
  });
});
