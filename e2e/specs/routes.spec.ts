/**
 * Layer 1: every route x role x viewport. Loads the page, checks the guard sent the visitor where
 * App.tsx says it should, that nothing threw, and runs the layout probes. A full-page screenshot of
 * each is kept for the visual review (artifacts/shots/<project>/<role>/<route>.png).
 *
 * Every finding is recorded with expect.soft, so one route reports ALL its defects at once, and is
 * also appended to artifacts/findings/<project>.jsonl for the launch report.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, settle, asRole, authFile, type Role } from '../fixtures/test';
import { probeLayout } from '../fixtures/layout';
import { ALL_ROUTES, expectFor, slugOf } from '../routes';
import { existsSync } from 'node:fs';

const artifacts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts');

/* Every viewport sweeps signed-out, free and pro; the org and admin roles are swept at one desktop
   and one phone width, where their extra screens differ, to keep the run under an hour. */
const FULL_ROLE_PROJECTS = new Set(['desktop-chrome', 'iphone-xr-webkit']);
const SWEEP: (Role | null)[] = [null, 'free', 'pro', 'team', 'agency', 'enterprise', 'admin'];

for (const role of SWEEP) {
  test.describe(`as ${role ?? 'signed-out'}`, () => {
    test.use(asRole(role));

    for (const route of ALL_ROUTES) {
      // Admin pages only for the admin role (others get one redirect check on /admin itself).
      if (route.startsWith('/admin/') && role !== 'admin') continue;

      test(`${route}`, async ({ page, firewall, diag }, testInfo) => {
        const project = testInfo.project.name;
        test.skip(!!role && !FULL_ROLE_PROJECTS.has(project) && !['free', 'pro'].includes(role), 'org/admin roles: desktop + iPhone only');
        test.skip(!!role && !existsSync(authFile(role!)), `no saved login for ${role}`);
        if (project === 'desktop-firefox') test.skip(role !== null && role !== 'pro', 'firefox: smoke roles only');

        await page.addInitScript(() => { try { localStorage.setItem('mbos_consent', 'analytics:no'); } catch {} });
        await page.goto(route);
        await settle(page);

        const want = expectFor(route, role);
        const at = new URL(page.url()).pathname;
        if (want === 'to-auth') expect.soft(at, 'guard should send a signed-out visitor to /auth').toBe('/auth');
        else if (want === 'to-home') expect.soft(at, 'guard should send this role to /').toBe('/');
        else expect.soft(at, 'route should render where it was opened').toBe(route);

        const title = await page.title();
        expect.soft(title.trim().length, 'document title').toBeGreaterThan(0);
        // A NotFound render on a declared route means the route table and the page disagree.
        if (want === 'render') {
          const notFound = await page.getByText(/page (you'?re looking for|not found)|404/i).first().isVisible().catch(() => false);
          expect.soft(notFound, 'declared route rendered the 404 page').toBe(false);
        }

        const touch = !!testInfo.project.use.hasTouch || !!testInfo.project.use.isMobile;
        const layout = await probeLayout(page, { touch });
        expect.soft(layout.pageOverflowX, 'page scrolls sideways by this many px').toBeLessThanOrEqual(1);
        expect.soft(layout.offscreen, 'controls past the viewport edge').toEqual([]);
        expect.soft(layout.overlaps, 'overlapping controls').toEqual([]);
        expect.soft(layout.clipped, 'clipped text').toEqual([]);
        if (touch) expect.soft(layout.smallTargets, 'tap targets under 24px').toEqual([]);

        expect.soft(diag.pageErrors, 'uncaught page errors').toEqual([]);
        expect.soft(diag.consoleErrors, 'console errors').toEqual([]);
        expect.soft(diag.failedRequests, 'failed local requests').toEqual([]);

        const shotDir = path.join(artifacts, 'shots', project, role ?? 'signed-out');
        mkdirSync(shotDir, { recursive: true });
        // Both: the first screen is what a visitor actually sees (fixed chrome in place); the full page
        // shows everything below the fold.
        await page.screenshot({ path: path.join(shotDir, `${slugOf(route)}.view.png`), animations: 'disabled' }).catch(() => {});
        await page.screenshot({ path: path.join(shotDir, `${slugOf(route)}.png`), fullPage: true, animations: 'disabled' }).catch(() => {});

        mkdirSync(path.join(artifacts, 'findings'), { recursive: true });
        appendFileSync(path.join(artifacts, 'findings', `${project}.jsonl`), JSON.stringify({
          project, role: role ?? 'signed-out', route, landed: at, want, title, layout,
          errors: diag, blocked: firewall.blocked.map((b) => b.name),
        }) + '\n');
      });
    }
  });
}
