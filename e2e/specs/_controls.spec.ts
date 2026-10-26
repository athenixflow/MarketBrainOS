/**
 * Negative controls: the suite's own checks must FAIL on pages built to be broken, or a green run
 * proves nothing. Runs on a synthetic page (no app, no backend), so it is fast and always safe.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/test';
import { probeLayout } from '../fixtures/layout';

const BROKEN = `<!doctype html><html lang="en"><head><title>controls</title></head><body style="margin:0">
  <div style="width:2000px;height:10px"></div>
  <button style="position:absolute;top:40px;left:10px;width:120px">First</button>
  <button style="position:absolute;top:45px;left:40px;width:120px">Second</button>
  <a href="#x" style="position:absolute;top:100px;left:calc(100vw - 30px);display:inline-block;width:120px">Off edge</a>
  <div style="width:80px;overflow:hidden;white-space:nowrap"><span style="display:block;overflow:hidden">A label much too long for its box</span></div>
  <button style="position:absolute;top:200px;left:10px;width:12px;height:12px;padding:0"></button>
</body></html>`;

test('layout probe catches overflow, overlap, off-edge, clipping and tiny targets', async ({ page }) => {
  await page.setContent(BROKEN);
  const r = await probeLayout(page, { touch: true });
  expect(r.pageOverflowX).toBeGreaterThan(500);
  expect(r.overlaps.join('\n')).toContain("'First' overlaps button 'Second'");
  expect(r.offscreen.join('\n')).toContain('Off edge');
  expect(r.clipped.length).toBeGreaterThan(0);
  expect(r.smallTargets.length).toBeGreaterThan(0);
});

test('axe flags an unlabeled button', async ({ page }) => {
  await page.setContent(BROKEN);
  const res = await new AxeBuilder({ page }).analyze();
  expect(res.violations.map((v) => v.id)).toContain('button-name');
});

test('firewall blocks a Cloud Function the test did not allow', async ({ page, firewall }) => {
  firewall.tolerateBlocks = true; // this test is ABOUT the block, so it must not fail on it
  await page.goto('/privacy');
  const status = await page.evaluate(() =>
    fetch('https://us-central1-marketbrainosweb.cloudfunctions.net/executeAnalysis', { method: 'POST', body: '{}' }).then((r) => r.status).catch(() => -1));
  expect(status).toBe(403);
  expect(firewall.blocked.map((b) => b.name)).toEqual(['executeAnalysis']);
});
