/**
 * The analysis tools, end to end.
 *
 * 1. Sample results (dev `?fixture=1`, no backend, no tokens) for the three bespoke tools: results
 *    render and the exports download, at desktop and phone widths.
 * 2. REAL runs on the Pro test account (founder-approved budget, ~60 tokens): every tool once.
 *    Each asserts the label's price is what the server charges (balance before minus after), that
 *    a result renders, and that it appears in History. Then Save as report, and Share.
 */
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole } from '../fixtures/test';
import { DEFAULT_PRICING_CONFIG as CFG } from '../../config/pricingConfig';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });

/* slug -> module key, read from config/toolConfigs.ts so a new tool is covered without editing this. */
const toolSrc = readFileSync(path.join(root, 'config', 'toolConfigs.ts'), 'utf8');
const TOOLS = [...toolSrc.matchAll(/slug:\s*'([a-z0-9-]+)'[\s\S]*?module:\s*'([A-Za-z_]+)'/g)].map((m) => ({ slug: m[1], module: m[2] }));

/** The sidebar's balance card: "TOKEN BALANCE 300 TOKENS". */
async function balance(page: Page): Promise<number> {
  const card = page.locator('a[href="/billing"]').filter({ hasText: /token balance/i }).first();
  await expect(card).toContainText(/\d/, { timeout: 20_000 });
  return Number((await card.innerText()).replace(/[^\d]/g, ''));
}

/** Fills every empty visible input with plausible text, so any tool's form becomes submittable. */
async function fillForm(page: Page) {
  const sample: Record<string, string> = {
    url: 'https://example.com',
    default: 'A project management app for small marketing agencies that bundles client approvals, briefs and invoicing into one workspace. Pricing starts at $29/month.',
    short: 'Small marketing agencies (5-20 staff)',
  };
  for (const el of await page.locator('main input:visible, main textarea:visible').all()) {
    const type = (await el.getAttribute('type')) || 'text';
    if (['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes(type)) continue;
    // The bot-trap field (HoneypotField) sits off-screen, aria-hidden, out of the Tab order. A person
    // never fills it; filling it is exactly what the app is right to refuse.
    if (await el.evaluate((n) => !!n.closest('[aria-hidden="true"]') || n.getAttribute('tabindex') === '-1')) continue;
    if ((await el.inputValue()).trim()) continue;
    const ph = `${await el.getAttribute('placeholder')} ${await el.getAttribute('name')} ${await el.getAttribute('aria-label')} ${type}`.toLowerCase();
    const isArea = await el.evaluate((n) => n.tagName === 'TEXTAREA');
    await el.fill(/url|http|website|page address/.test(ph) || type === 'url' ? sample.url
      : !isArea && /audience|target|who|industry|niche/.test(ph) ? sample.short : sample.default);
  }
  for (const sel of await page.locator('main select:visible').all()) {
    const opts = await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    if (opts.length && !(await sel.inputValue())) await sel.selectOption(opts[0]);
  }
}

test.describe('sample results (no backend)', () => {
  test.use(asRole('free'));
  for (const slug of ['angle-miner', 'test-lab', 'conversion-doctor']) {
    test(`${slug}: sample result renders and exports`, async ({ page }, ti) => {
      test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(ti.project.name), 'one desktop, one phone');
      await consent(page);
      await page.goto(`/${slug}?fixture=1`);
      await settle(page);
      // A fixture result replaces the empty state; the empty state's prompt must be gone.
      await expect(page.getByText(/fill in the inputs and run|run the analysis to see/i)).toHaveCount(0);
      const exports = page.getByRole('button', { name: /^(csv|txt|pdf|download|export)/i });
      const n = await exports.count();
      for (let i = 0; i < n; i++) {
        const b = exports.nth(i);
        if (!(await b.isEnabled())) continue;
        const dl = page.waitForEvent('download', { timeout: 20_000 });
        await b.click();
        const file = await dl;
        expect(file.suggestedFilename()).toMatch(/\.(csv|txt|pdf)$/i);
      }
    });
  }
});

test.describe('real runs (Pro account, spends tokens)', () => {
  test.use(asRole('pro'));
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop-chrome', 'real runs: once, on desktop'); });

  for (const t of TOOLS) {
    test(`${t.slug}: runs, charges what the button says, lands in History`, async ({ page, firewall, diag }) => {
      test.setTimeout(6 * 60_000);
      firewall.allow('executeAnalysis');
      await consent(page);
      await page.goto(`/${t.slug}`);
      await settle(page);
      const before = await balance(page);
      const run = page.getByRole('button', { name: /\(\d+ tokens?\)$/ }).first();
      // textContent, not innerText: the button is uppercased by CSS, which innerText reflects.
      const labelCost = Number(/\((\d+) tokens?\)/i.exec((await run.textContent()) || '')![1]);
      const serverCost = CFG.toolCosts[t.module as keyof typeof CFG.toolCosts];
      expect.soft(labelCost, `${t.slug}: the button's price vs the server's cost table`).toBe(serverCost);

      await fillForm(page);
      await run.click();
      await expect(page.getByRole('button', { name: /Analyzing/ })).toHaveCount(0, { timeout: 5 * 60_000 });
      await expect(page.getByRole('button', { name: 'Save as report' }), 'a result should render').toBeVisible({ timeout: 30_000 });
      expect(diag.pageErrors).toEqual([]);

      await page.reload(); await settle(page);
      const after = await balance(page);
      expect(before - after, `${t.slug}: tokens charged`).toBe(serverCost);

      await page.goto('/history'); await settle(page);
      await expect(page.locator('main')).toContainText(new RegExp(t.slug.replace(/-/g, '.'), 'i'));
    });
  }

  test('Save as report and Share on a fresh result', async ({ page, firewall, context }) => {
    test.setTimeout(6 * 60_000);
    firewall.allow('executeAnalysis', 'createShareLink');
    await consent(page);
    await page.goto('/messaging-analyzer'); await settle(page);
    await fillForm(page);
    await page.getByRole('button', { name: /\(\d+ tokens?\)$/ }).first().click();
    await expect(page.getByRole('button', { name: 'Save as report' })).toBeVisible({ timeout: 5 * 60_000 });

    await page.getByRole('button', { name: 'Save as report' }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 20_000 });

    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.getByRole('button', { name: 'Share' }).click();
    // The link is announced in the action message ("Link copied — https://…/s/<id>"), not as an anchor.
    const msg = page.getByText(/\/s\/[A-Za-z0-9_-]+/).first();
    await expect(msg).toBeVisible({ timeout: 30_000 });
    const sharePath = /\/s\/[A-Za-z0-9_-]+/.exec((await msg.textContent()) || "")![0]; // raw text: CSS uppercases innerText
    const shareUrl = new URL(sharePath, 'https://www.marketbrainos.app');
    // /s/:id is served by the sharePage function through Vercel, so open it on the live site.
    const res = await page.request.get(`https://www.marketbrainos.app${shareUrl.pathname}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/MarketBrain/i);

    await page.goto('/reports'); await settle(page);
    await expect(page.locator('main')).toContainText(/messaging/i);
  });
});
