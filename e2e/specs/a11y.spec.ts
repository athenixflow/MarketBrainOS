/**
 * Layer 5: accessibility. axe-core (WCAG 2.2 A/AA rules) on every route, plus two keyboard checks
 * that axe cannot make: a closed mobile drawer must not leave its links in the Tab order, and
 * focus must be visible on whatever Tab lands on. Runs at one desktop and one phone width.
 */
import AxeBuilder from '@axe-core/playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, settle, asRole, type Role } from '../fixtures/test';
import { ALL_ROUTES, expectFor } from '../routes';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'findings');
const ROLES: (Role | null)[] = [null, 'free', 'pro', 'admin'];

for (const role of ROLES) {
  test.describe(`a11y as ${role ?? 'signed-out'}`, () => {
    test.use(asRole(role));
    for (const route of ALL_ROUTES) {
      if (route.startsWith('/admin/') && role !== 'admin') continue;
      if (expectFor(route, role) !== 'render') continue; // a redirect is covered by its target route

      test(route, async ({ page, firewall }, testInfo) => {
        test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(testInfo.project.name), 'a11y: one desktop, one phone');
        firewall.tolerateBlocks = true;
        await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
        await page.goto(route);
        await settle(page);

        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const serious = res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

        // Tab through the page: every stop must be on screen (not inside a closed drawer) and show focus.
        const tabIssues: string[] = [];
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const info = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none';
            const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('href') || el.tagName).trim().slice(0, 40);
            return { name, off: r.right <= 0 || r.left >= innerWidth || r.width === 0, ring };
          });
          if (!info) continue;
          if (info.off) tabIssues.push(`Tab reaches '${info.name}' which is off screen (hidden drawer?)`);
          else if (!info.ring) tabIssues.push(`no visible focus on '${info.name}'`);
        }
        const uniqueTab = [...new Set(tabIssues)].slice(0, 15);

        mkdirSync(out, { recursive: true });
        appendFileSync(path.join(out, 'a11y.jsonl'), JSON.stringify({
          project: testInfo.project.name, role: role ?? 'signed-out', route,
          violations: serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })),
          tab: uniqueTab,
        }) + '\n');

        expect.soft(serious.map((v) => `${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`), 'serious/critical axe violations').toEqual([]);
        expect.soft(uniqueTab, 'keyboard focus problems').toEqual([]);
      });
    }
  });
}
