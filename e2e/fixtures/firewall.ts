/**
 * The e2e firewall. Every test runs against the REAL Firebase backend, so a careless click can spend
 * Gemini money and user tokens, send email, open a live checkout or write admin config. Every Cloud
 * Function request is therefore BLOCKED unless it is a known read, or the test opts in with
 * `firewall.allow('name')`. A blocked call answers like a refused callable, so the UI shows its
 * error path instead of hanging, and is recorded: a test fails on a block it did not expect.
 *
 * Firestore traffic (firestore.googleapis.com) is not routed through here; the click crawl avoids
 * destructive Firestore writes by its button denylist instead.
 */
import type { Page, Route } from '@playwright/test';

/** Reads with no side effect. Everything else on cloudfunctions.net is blocked by default. */
export const READ_ONLY = new Set(['billingStatus', 'listShareLinks']);

export interface Blocked { name: string; url: string; at: number }

export class Firewall {
  readonly blocked: Blocked[] = [];
  readonly passed: string[] = [];
  private allowed = new Set<string>();
  /** The click crawl presses every button, so blocks are its expected outcome, not a failure. */
  tolerateBlocks = false;

  allow(...names: string[]) { names.forEach((n) => this.allowed.add(n)); }
  revoke(...names: string[]) { names.forEach((n) => this.allowed.delete(n)); }

  async install(page: Page) {
    await page.route(/cloudfunctions\.net\/|\/__\/functions\//, (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').filter(Boolean).pop() || '';
    if (route.request().method() === 'OPTIONS' || READ_ONLY.has(name) || this.allowed.has(name)) {
      this.passed.push(name);
      return route.continue();
    }
    this.blocked.push({ name, url: url.toString(), at: Date.now() });
    // The callable protocol's error envelope, so httpsCallable rejects with a readable error.
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: `e2e firewall blocked ${name}` } }),
    });
  }
}
