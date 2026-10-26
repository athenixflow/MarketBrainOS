import { defineConfig, devices } from '@playwright/test';

/**
 * Launch-readiness suite. Runs the local dev server against the REAL Firebase backend (decided with
 * the founder: localhost:5173 is already on the server's CORS allowlist, and dev mode enables the
 * ?fixture=1 sample results and the App Check debug token). Side effects are held back by
 * fixtures/firewall.ts. `prod-public` is a separate read-only project against the live site.
 *
 * WebKit here is Playwright's WebKit build on Windows: the closest engine to iPhone Safari that can be
 * automated on this machine, but not a real iOS device.
 */
const local = 'http://localhost:5173';
const ignoreProd = /prod\//;

export default defineConfig({
  testDir: './specs',
  outputDir: './artifacts/test-results',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // The backend is shared and rate-limited (checkout 10/h per user, scorer 3/day per IP); a few
  // workers keep the sweep tolerable without hammering it.
  // This PC has 8 GB: four browsers + the dev server + the editor ran it out of memory. Two is the ceiling.
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: './artifacts/results.json' }], ['html', { outputFolder: './artifacts/html', open: 'never' }]],
  use: {
    baseURL: local,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    cwd: '..',
    // An hour of sweeping ran the dev server out of its default heap (MarkCompactCollector OOM).
    env: { NODE_OPTIONS: '--max-old-space-size=8192' },
    url: local,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chrome', testIgnore: ignoreProd, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'laptop-chrome', testIgnore: ignoreProd, use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'tablet-chrome', testIgnore: ignoreProd, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'iphone-xr-webkit', testIgnore: ignoreProd, use: { ...devices['iPhone XR'] } },
    { name: 'pixel-7-chrome', testIgnore: ignoreProd, use: { ...devices['Pixel 7'] } },
    { name: 'desktop-firefox', testIgnore: ignoreProd, use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 768 } } },
    { name: 'prod-public', testMatch: /prod\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'https://www.marketbrainos.app' } },
  ],
});
