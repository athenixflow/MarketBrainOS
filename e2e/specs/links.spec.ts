/**
 * Layer 2: every link on every page goes somewhere real. Internal links are opened and must not land
 * on the 404 page; external links get one GET (sites that refuse robots are reported as warnings,
 * not failures); mailto: links must be well formed. Plus the two redirects the app promises:
 * legacy #/hash URLs and unknown /documentation paths.
 */
import { test, expect, settle, asRole, type Role } from '../fixtures/test';
import { ALL_ROUTES, expectFor } from '../routes';

const NOT_FOUND = /page (you'?re looking for|not found)|doesn.t exist|404/i;

for (const role of [null, 'free'] as (Role | null)[]) {
  test.describe(`links as ${role ?? 'signed-out'}`, () => {
    test.use(asRole(role));

    test('every link resolves', async ({ page, request, firewall }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chrome', 'links: desktop only');
      test.setTimeout(20 * 60_000);
      firewall.tolerateBlocks = true;
      await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });

      const found = new Map<string, string>(); // href -> first page it was seen on
      for (const route of ALL_ROUTES.filter((r) => !r.startsWith('/admin') && expectFor(r, role) === 'render')) {
        await page.goto(route);
        await settle(page);
        const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''));
        hrefs.forEach((h) => { if (h && !found.has(h)) found.set(h, route); });
      }

      const broken: string[] = [], warnings: string[] = [];
      for (const [href, from] of found) {
        if (href.startsWith('mailto:')) {
          if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}(\?.*)?$/i.test(href)) broken.push(`${from}: malformed ${href}`);
          continue;
        }
        if (href.startsWith('tel:') || href.startsWith('javascript:')) continue;
        if (href.startsWith('#')) continue; // in-page anchor; docs.spec checks its targets
        const url = new URL(href, page.url());
        if (url.origin === new URL(page.url()).origin) {
          // A link to a file (press kit, PDF) starts a download instead of loading a page: that is a working link.
          const went = await page.goto(url.pathname + url.search + url.hash).then(() => true).catch((e: Error) => /Download is starting/.test(e.message) ? 'download' : Promise.reject(e));
          if (went === 'download') continue;
          await settle(page);
          const body = await page.locator('main, body').first().innerText().catch(() => '');
          if (NOT_FOUND.test(body.slice(0, 600)) && !/^\/compare/.test(url.pathname)) broken.push(`${from} -> ${url.pathname}: 404 page`);
        } else {
          const res = await request.get(url.toString(), { timeout: 20_000, maxRedirects: 5, failOnStatusCode: false }).catch((e) => e as Error);
          if (res instanceof Error) warnings.push(`${from} -> ${url}: ${res.message.split('\n')[0]}`);
          else if (res.status() === 404 || res.status() === 410 || res.status() >= 500) broken.push(`${from} -> ${url}: HTTP ${res.status()}`);
          else if (res.status() >= 400) warnings.push(`${from} -> ${url}: HTTP ${res.status()} (may refuse robots)`);
        }
      }
      await testInfo.attach('links', { body: JSON.stringify({ checked: found.size, broken, warnings }, null, 2), contentType: 'application/json' });
      console.log(`links as ${role ?? 'signed-out'}: ${found.size} checked, ${broken.length} broken, ${warnings.length} warnings`);
      warnings.forEach((w) => console.log(`  warn ${w}`));
      expect(broken).toEqual([]);
    });
  });
}

test.describe('redirects', () => {
  test.use(asRole(null));
  test('legacy #/ URLs and unknown docs paths', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop only');
    await page.goto('/#/pricing');
    await settle(page);
    expect(new URL(page.url()).pathname).toBe('/pricing');
    await page.goto('/documentation/no-such-category/nothing');
    await settle(page);
    expect(new URL(page.url()).pathname).toBe('/documentation');
  });
});
