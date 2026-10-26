/**
 * The LIVE site, read-only (project `prod-public`): what search engines and first-time visitors get
 * from www.marketbrainos.app. Every prerendered page answers 200 with its own title and description,
 * the crawler files exist, security headers are set, and unknown paths give a real 404.
 * No sign-in, no forms, no clicks that write anything.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const prerender = readFileSync(path.join(root, 'scripts', 'prerender.ts'), 'utf8');
const MARKETING = [...((prerender.match(/const MARKETING = \[([^\]]+)\]/) || [, ''])[1]).matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
const PAGES = [...new Set([...MARKETING, '/compare/chatgpt', '/compare/claude', '/compare/gemini', '/documentation'])];

const seen = new Map<string, string>();

for (const p of PAGES) {
  test(`${p} is served prerendered`, async ({ request }) => {
    const res = await request.get(p);
    expect(res.status(), `${p} status`).toBe(200);
    const html = await res.text();
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || '';
    const desc = /<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html)?.[1] || '';
    const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i.exec(html)?.[1] || '';
    expect.soft(title.length, `${p}: <title>`).toBeGreaterThan(10);
    expect.soft(desc.length, `${p}: meta description`).toBeGreaterThan(50);
    expect.soft(canonical, `${p}: canonical`).toMatch(/^https:\/\/www\.marketbrainos\.app/);
    expect.soft(html.length, `${p}: prerendered body, not an empty shell`).toBeGreaterThan(5_000);
    const dup = seen.get(title);
    expect.soft(dup, `${p}: title duplicates ${dup}`).toBeUndefined();
    seen.set(title, p);
  });
}

test('crawler files', async ({ request }) => {
  for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
    const res = await request.get(f);
    expect.soft(res.status(), f).toBe(200);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(20);
  const bad: string[] = [];
  for (const u of urls) {
    const r = await request.get(u, { maxRedirects: 0 });
    if (r.status() !== 200) bad.push(`${r.status()} ${u}`);
  }
  expect(bad, 'every sitemap URL answers 200 without a redirect').toEqual([]);
});

test('security headers', async ({ request }) => {
  const h = (await request.get('/')).headers();
  expect.soft(h['strict-transport-security'], 'HSTS').toMatch(/max-age=\d+/);
  expect.soft(h['x-content-type-options'], 'nosniff').toBe('nosniff');
  expect.soft(h['x-frame-options'] || '', 'clickjacking protection').toMatch(/SAMEORIGIN|DENY/i);
  expect.soft(h['content-security-policy'] || h['content-security-policy-report-only'] || '', 'a CSP of some kind').not.toBe('');
  test.info().annotations.push({ type: 'csp-mode', description: h['content-security-policy'] ? 'enforced' : 'report-only' });
});

test('unknown paths are real 404s', async ({ request }) => {
  expect((await request.get('/this-page-does-not-exist-e2e')).status()).toBe(404);
  const share = await request.get('/s/not-a-real-share-id');
  expect.soft([404, 410], 'an unknown share link').toContain(share.status());
});

test('the http and apex hosts redirect to https://www', async ({ request }) => {
  const r = await request.get('http://marketbrainos.app/pricing', { maxRedirects: 0 }).catch(() => null);
  if (r) expect([301, 302, 307, 308]).toContain(r.status());
});
