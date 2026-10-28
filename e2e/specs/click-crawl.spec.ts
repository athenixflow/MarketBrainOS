/**
 * Layer 4: press every button. Each visible, enabled button on each page is clicked on a fresh load
 * of that page, with the firewall holding back anything that would spend, email or charge. A button
 * "works" if the click changed something a person could see: the URL, a dialog, a download, or the
 * page content. One that changes nothing is reported as dead; one that throws is reported as broken.
 *
 * Destructive labels are never pressed here (the flow specs cover those on purpose-made data).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, settle, asRole, type Role } from '../fixtures/test';
import { ALL_ROUTES, expectFor } from '../routes';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'findings');
const DENY = /sign ?out|log ?out|delete|remove|revoke|cancel (plan|subscription)|leave|suspend|disable|promote|demote|refund|reset (tokens|balance)|lockdown|emergency|bulk/i;
const ROLES: (Role | null)[] = [null, 'free', 'pro', 'team', 'agency', 'enterprise', 'admin'];
const MAX_BUTTONS = 40;

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search + location.hash,
    text: document.body.innerText.length,
    nodes: document.body.getElementsByTagName('*').length,
    dialogs: document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open]').length,
    // WHICH controls are on, not how many: picking another chip in a single-choice group moves
    // aria-pressed from one to the other and leaves the count unchanged.
    expanded: [...document.querySelectorAll('[aria-expanded="true"], [aria-pressed="true"], [aria-selected="true"]')]
      .map((e) => (e.getAttribute('aria-label') || (e as HTMLElement).innerText || e.tagName).trim().slice(0, 40)).join('|'),
    checked: [...document.querySelectorAll('input:checked')].length,
  }));
}

/* Lists the pressable buttons and tags each with data-crawl=<its index here>, so the click lands on
   exactly the button that was listed. Clicking by position in a broader locator (which kept the
   already-chosen options and off-screen drawer buttons this list drops) pressed the wrong button once
   the currency toggle and tabs gained aria-pressed/aria-selected. */
async function buttonLabels(page: Page) {
  return page.evaluate(() => {
    const vis = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none'; };
    document.querySelectorAll('[data-crawl]').forEach((b) => b.removeAttribute('data-crawl'));
    const list = [...document.querySelectorAll('button, [role="button"], [role="tab"]')]
      .filter((b) => vis(b) && !(b as HTMLButtonElement).disabled && b.getAttribute('aria-disabled') !== 'true' && !b.closest('[inert]'))
      // The option that is already chosen (current tab, active currency) rightly does nothing.
      .filter((b) => !['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current'].some((a) => ['true', 'page'].includes(b.getAttribute(a) || '')));
    list.forEach((b, i) => b.setAttribute('data-crawl', String(i)));
    return list.map((b) => ((b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60)));
  });
}

for (const role of ROLES) {
  test.describe(`crawl as ${role ?? 'signed-out'}`, () => {
    test.use(asRole(role));
    for (const route of ALL_ROUTES) {
      if (route.startsWith('/admin/') && role !== 'admin') continue;
      if (expectFor(route, role) !== 'render') continue;
      // Public pages are crawled signed-out only; signed-in roles crawl the app.
      if (role && /^\/(features|pricing|about|faq|privacy|terms|press|compare|documentation|research|status)/.test(route)) continue;
      if (!role && !/^\/($|features|pricing|about|faq|privacy|terms|press|compare|documentation|research|status|tools|auth)/.test(route)) continue;

      test(route, async ({ page, firewall, diag }, testInfo) => {
        test.skip(!['desktop-chrome', 'iphone-xr-webkit'].includes(testInfo.project.name), 'crawl: one desktop, one phone');
        test.setTimeout(10 * 60_000);
        firewall.tolerateBlocks = true;
        await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
        await page.goto(route);
        await settle(page);

        const labels = (await buttonLabels(page)).slice(0, MAX_BUTTONS);
        const dead: string[] = [], broken: string[] = [], pressed: string[] = [], skipped: string[] = [];
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          if (DENY.test(label)) { skipped.push(label); continue; }
          if (i > 0) { await page.goto(route); await settle(page); }
          const now = await buttonLabels(page);
          const idx = now.indexOf(label);
          if (idx < 0) continue; // the page changed between loads; nothing to compare
          const before = await snapshot(page);
          const errsBefore = diag.pageErrors.length;
          const blockedBefore = firewall.blocked.length;
          const download = page.waitForEvent('download', { timeout: 2_500 }).then(() => true).catch(() => false);
          const popup = page.context().waitForEvent('page', { timeout: 2_500 }).then((p) => { p.close().catch(() => {}); return true; }).catch(() => false);
          try {
            try { await page.locator(`[data-crawl="${idx}"]`).click({ timeout: 5_000 }); }
            catch {
              // A late re-render (the header remounts once the profile loads, slowest on WebKit) can
              // replace the tagged element between listing and clicking: list again and retry once.
              const again = (await buttonLabels(page)).indexOf(label);
              if (again < 0) continue;
              await page.locator(`[data-crawl="${again}"]`).click({ timeout: 5_000 });
            }
          } catch (e: any) { broken.push(`${label || '(no label)'}: click failed (${String(e.message).split('\n')[0].slice(0, 80)})`); continue; }
          await page.waitForTimeout(1_200);
          const after = await snapshot(page).catch(() => null);
          const responded = !after || await download || await popup || firewall.blocked.length > blockedBefore ||
            after.url !== before.url || after.dialogs !== before.dialogs || after.expanded !== before.expanded ||
            after.checked !== before.checked || Math.abs(after.text - before.text) > 3 || Math.abs(after.nodes - before.nodes) > 2;
          if (diag.pageErrors.length > errsBefore) broken.push(`${label}: threw ${diag.pageErrors.at(-1)!.split('\n')[0].slice(0, 120)}`);
          else if (!responded) dead.push(label || '(no label)');
          else pressed.push(label);
        }
        mkdirSync(out, { recursive: true });
        appendFileSync(path.join(out, 'crawl.jsonl'), JSON.stringify({
          project: testInfo.project.name, role: role ?? 'signed-out', route, pressed: pressed.length, dead, broken, skipped,
          blocked: [...new Set(firewall.blocked.map((b) => b.name))],
        }) + '\n');
        expect.soft(broken, 'buttons that threw or could not be clicked').toEqual([]);
        expect.soft(dead, 'buttons that visibly did nothing').toEqual([]);
      });
    }
  });
}
