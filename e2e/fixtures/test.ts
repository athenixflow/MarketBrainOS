/**
 * The shared `test`: every page gets the firewall installed and its errors collected, and every test
 * fails if the page threw, logged an unexpected console error, or hit a firewall block it did not
 * declare. Signed-in tests pick a role with `test.use(asRole('pro'))`.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firewall } from './firewall';

export const ROLES = ['free', 'pro', 'team', 'agency', 'enterprise', 'admin', 'throwaway'] as const;
export type Role = (typeof ROLES)[number];

export const authFile = (role: Role) => path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.auth', `${role}.json`);

/** Signed-out unless a role is given. Skips (not fails) when that role's login was never saved. */
export const asRole = (role: Role | null) =>
  role ? { storageState: existsSync(authFile(role)) ? authFile(role) : undefined } : { storageState: { cookies: [], origins: [] } };

/* Console noise that is not a defect of the app: third-party SDK chatter and the dev server. */
const CONSOLE_ALLOW = [
  /\[vite\]/i,
  /Download the React DevTools/i,
  /AppCheck/i, /app-check/i, /recaptcha/i,
  /firebase.*analytics/i, /googletagmanager/i,
  /e2e firewall blocked/i,               // the firewall's own refusals, surfaced by the UI
  /Failed to load resource: the server responded with a status of 403/i, // same, as the browser logs it
  /WebChannelConnection|Listen\/channel/i, // Firestore long-poll reconnects
  /ERR_ABORTED/i,
];

export interface Diagnostics { pageErrors: string[]; consoleErrors: string[]; failedRequests: string[] }

export const test = base.extend<{ firewall: Firewall; diag: Diagnostics }>({
  firewall: async ({ page }, use, testInfo) => {
    const fw = new Firewall();
    await fw.install(page);
    await use(fw);
    if (fw.blocked.length) {
      await testInfo.attach('firewall-blocks', { body: JSON.stringify(fw.blocked, null, 2), contentType: 'application/json' });
    }
    if (!fw.tolerateBlocks) {
      expect(fw.blocked.map((b) => b.name), 'Cloud Function calls the test did not opt into').toEqual([]);
    }
  },
  diag: async ({ page }, use, testInfo) => {
    const d: Diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', (e) => d.pageErrors.push(String(e?.stack || e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!CONSOLE_ALLOW.some((re) => re.test(t))) d.consoleErrors.push(t.slice(0, 400));
    });
    page.on('requestfailed', (r) => {
      const u = r.url();
      const f = r.failure()?.errorText || '';
      if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(f)) return; // navigation cancelling its own fetches
      if (u.startsWith('http://localhost')) d.failedRequests.push(`${f} ${u}`);
    });
    await use(d);
    if (d.pageErrors.length || d.consoleErrors.length || d.failedRequests.length) {
      await testInfo.attach('diagnostics', { body: JSON.stringify(d, null, 2), contentType: 'application/json' });
    }
  },
});

/** Wait for the SPA to settle: Firebase session restored, lazy route chunk loaded, no spinner. */
export async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const t = document.body?.innerText || '';
    return !/Loading your workspace|Verifying Security Clearance|^Loading\.\.\.$/m.test(t) && t.trim().length > 0;
  }, undefined, { timeout: 30_000 }).catch(() => {});
  // Firestore holds a long-poll open, so "networkidle" can never arrive on a signed-in page: cap it.
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
}

export { expect };
