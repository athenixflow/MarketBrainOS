/**
 * Creates and logs in the e2e test accounts through the real UI, and saves each session for the
 * suite (Firebase Auth keeps its session in IndexedDB, hence `indexedDB: true`).
 *
 *   npx tsx e2e/setup/accounts.ts init  <base-email>   writes e2e/.accounts.local.json (gitignored)
 *   npx tsx e2e/setup/accounts.ts signup [role...]     signs up (sends ONE welcome email per account)
 *   npx tsx e2e/setup/accounts.ts login  [role...]     signs in again and refreshes e2e/.auth/<role>.json
 *
 * Needs the dev server on localhost:5173. Accounts are +aliases of the founder's chosen address, so
 * every email they trigger lands in the founder's own inbox.
 */
import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLES = ['free', 'pro', 'team', 'agency', 'enterprise', 'admin', 'throwaway', 'probe'];
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const accountsFile = path.join(dir, '.accounts.local.json');
const authDir = path.join(dir, '.auth');
const BASE = 'http://localhost:5173';

interface Accounts { password: string; emails: Record<string, string> }
const load = (): Accounts => JSON.parse(readFileSync(accountsFile, 'utf8'));

async function fill(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
}

async function finishOnboarding(page: Page) {
  // New accounts open on the onboarding overlay; skipping it is what a real user would do first.
  const skip = page.getByRole('button', { name: /start from scratch|skip/i });
  if (await skip.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await skip.click();
    await page.getByText('What are you deciding?').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1_500); // let the onboarded flag reach Firestore before the session is saved
  }
}

async function session(role: string, mode: 'signup' | 'login') {
  const { emails, password } = load();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth`);
  if (mode === 'signup') await page.getByRole('button', { name: 'Create an account' }).click();
  await fill(page, emails[role], password);
  await page.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true }).click();
  try {
    await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 });
  } catch {
    const alert = await page.locator('[role="alert"]').first().innerText().catch(() => '(no alert)');
    throw new Error(`${role}: ${mode} did not reach the dashboard: ${alert}`);
  }
  await page.waitForTimeout(2_500);
  await finishOnboarding(page);
  mkdirSync(authDir, { recursive: true });
  await ctx.storageState({ path: path.join(authDir, `${role}.json`), indexedDB: true });
  console.log(`${role}: ${mode} ok`);
  await browser.close();
}

const [cmd, ...args] = process.argv.slice(2);
(async () => {
  if (cmd === 'init') {
    const base = args[0];
    if (!/^[^@+\s]+@[^@\s]+\.[a-z]+$/i.test(base || '')) throw new Error('usage: init <base-email> (no + in it)');
    if (existsSync(accountsFile)) throw new Error(`${accountsFile} exists; delete it first to re-init`);
    const [user, domain] = base.split('@');
    const emails = Object.fromEntries(ROLES.map((r) => [r, `${user}+e2e-${r}@${domain}`]));
    // A random password per run: it lives only in the gitignored file and dies with the accounts.
    const password = `E2e-${randomBytes(12).toString('base64url')}!`;
    writeFileSync(accountsFile, JSON.stringify({ password, emails }, null, 2));
    console.log(`wrote ${Object.keys(emails).length} accounts to ${accountsFile}`);
    return;
  }
  const roles = args.length ? args : ROLES;
  for (const r of roles) {
    if (!ROLES.includes(r)) throw new Error(`unknown role ${r}`);
    await session(r, cmd === 'signup' ? 'signup' : 'login');
  }
})().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
