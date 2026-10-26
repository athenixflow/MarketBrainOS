/**
 * Team, Agency and Enterprise on the real backend. Each suite creates its own container named
 * "E2E …", walks every tab, and exercises its core action. The team invite goes to the free test
 * account (one email), which accepts it; the team owner then removes it again.
 * Containers are deleted in the cleanup phase, before the accounts that own them.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole, authFile } from '../fixtures/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const accounts = JSON.parse(readFileSync(path.join(here, '..', '.accounts.local.json'), 'utf8')) as { emails: Record<string, string> };
const consent = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
const desktopOnly = ({}, ti: { project: { name: string } }) => { test.skip(ti.project.name !== 'desktop-chrome', 'org flows: desktop only'); };

async function walkTabs(page: Page, tabs: string[]) {
  const main = page.locator('main');
  for (const t of tabs) {
    await main.getByRole('tab', { name: t, exact: true }).or(main.getByRole('button', { name: t, exact: true })).first().click();
    await page.waitForTimeout(1_000);
    await expect(main.getByText(/something went wrong|failed to load/i)).toHaveCount(0);
  }
}

/** Creates the container if this account has none yet. */
async function ensureCreated(page: Page, nameLabel: string, name: string, button: string) {
  const field = page.getByLabel(nameLabel, { exact: true });
  if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await field.fill(name);
    await page.getByRole('button', { name: button }).click();
    await expect(field).toBeHidden({ timeout: 30_000 });
  }
}

test.describe('free account on the collaboration pages', () => {
  test.use(asRole('free'));
  test.beforeEach(desktopOnly);

  test('the Team page does not promise an upgrade the server refuses (bug #2)', async ({ page, firewall }) => {
    firewall.tolerateBlocks = true;
    await consent(page);
    await page.goto('/team'); await settle(page);
    await expect(page.locator('main'), 'copy must not say creating a workspace upgrades the plan').not.toContainText(/upgrades you to the Team plan/i);
  });

  test('the Agency page does not promise an upgrade the server refuses (bug #2)', async ({ page, firewall }) => {
    firewall.tolerateBlocks = true;
    await consent(page);
    await page.goto('/agency'); await settle(page);
    await expect(page.locator('main'), 'copy must not say creating an agency upgrades the plan').not.toContainText(/upgrades you to the Agency plan/i);
  });

  test('loading the collaboration pages raises no permission errors', async ({ page, diag, firewall }) => {
    firewall.tolerateBlocks = true;
    await consent(page);
    for (const p of ['/team', '/agency', '/enterprise']) { await page.goto(p); await settle(page); }
    expect(diag.consoleErrors.filter((e) => /permission/i.test(e)), 'invitation lookups refused by the rules').toEqual([]);
  });
});

test.describe.serial('team workspace', () => {
  test.use(asRole('team'));
  test.beforeEach(desktopOnly);

  test('create, walk every tab, invite the free account', async ({ page, firewall }) => {
    firewall.allow('manageWorkspace', 'manageMembership', 'createWorkspaceMember', 'updateWorkspaceMember');
    await consent(page);
    await page.goto('/team'); await settle(page);
    await ensureCreated(page, 'Workspace name', 'E2E Workspace', 'Create Workspace');
    await walkTabs(page, ['Overview', 'Members', 'Library', 'Reports', 'Analytics', 'Activity', 'Settings']);
    await walkTabs(page, ['Members']);
    await page.getByRole('button', { name: 'Invite by email' }).or(page.getByRole('radio', { name: 'Invite by email' })).first().click().catch(() => {});
    await page.getByLabel('Email', { exact: true }).fill(accounts.emails.free);
    await page.locator('main').getByRole('button', { name: 'Send invitation' }).first().click();
    await expect(page.getByText(/invit(e|ation) sent|invited/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('the free account sees the invite and joins', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('free') });
    const page = await ctx.newPage();
    await page.route(/cloudfunctions\.net\//, (r) => r.continue()); // accepting is the point of this step
    await consent(page);
    await page.goto('/team'); await settle(page);
    await page.getByRole('button', { name: 'Accept & Join' }).first().click();
    await expect(page.locator('main')).toContainText('E2E Workspace', { timeout: 30_000 });
    await ctx.close();
  });
});

test.describe('agency', () => {
  test.use(asRole('agency'));
  test.beforeEach(desktopOnly);

  test('create, walk every tab, add a client', async ({ page, firewall }) => {
    firewall.allow('manageAgency', 'manageClient', 'allocateTokens');
    await consent(page);
    await page.goto('/agency'); await settle(page);
    await ensureCreated(page, 'Agency name', 'E2E Agency', 'Create Agency');
    await walkTabs(page, ['Dashboard', 'Clients', 'Members', 'Analytics', 'Budgets', 'Settings']);
    await walkTabs(page, ['Clients']);
    if (!(await page.getByText('E2E Client').isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client name').fill('E2E Client');
      await page.getByRole('button', { name: 'Create Client' }).click();
    }
    await expect(page.getByText('E2E Client').first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('enterprise', () => {
  test.use(asRole('enterprise'));
  test.beforeEach(desktopOnly);

  test('create, walk every tab, generate one briefing', async ({ page, firewall }) => {
    test.setTimeout(6 * 60_000);
    firewall.allow('manageEnterprise', 'manageDepartment', 'manageBrand', 'runEnterpriseAggregation', 'generateExecutiveBriefing');
    await consent(page);
    await page.goto('/enterprise'); await settle(page);
    await ensureCreated(page, 'Organization name', 'E2E Enterprise', 'Create Enterprise');
    await walkTabs(page, ['Dashboard', 'Intelligence', 'Performance', 'Briefings', 'Structure', 'Members', 'Budgets', 'Settings']);
    await walkTabs(page, ['Briefings']);
    await page.getByRole('button', { name: 'Generate Briefing' }).click();
    await expect(page.getByRole('button', { name: 'Generating…' })).toHaveCount(0, { timeout: 5 * 60_000 });
    await expect(page.locator('main').getByText(/error|failed/i)).toHaveCount(0);
  });
});
