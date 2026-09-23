// Browser-level evidence for behaviour that Node cannot exercise: the click-to-file download path,
// under a desktop viewport and under iPhone emulation.
//
// Why this exists: "Export PDF" used to open the OS print dialog on a hidden iframe. On WebKit that
// printed the parent page, and no test could have caught it because nothing observable happened
// in automation. The replacement produces a file, so a real browser can click the button, the file
// can be captured, and its bytes parsed. This script does exactly that against the REAL modules the
// app ships (scripts/harness/pdf.html imports services/exportService.ts, not a copy).
//
// Stated limit: Puppeteer drives Chromium. It does not execute WebKit, so this is proof that the
// path contains no print dialog and produces a correct file, not proof of iOS Safari itself. The
// device independence comes from removing print() from the path; this run shows the replacement
// works in a browser and that mobile emulation changes nothing.
//
// Run: `npm run test:browser`. Not part of `npm run build` (it starts a dev server and a browser).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4179;

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const has = (h: string, n: string) => squash(h).includes(squash(n));

const pdfText = async (file: string): Promise<{ text: string; pages: number }> => {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    text += content.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return { text, pages: pdf.numPages };
};

/** Clicks `selector` and resolves with the downloaded file's path once Chromium reports it complete. */
const clickAndCapture = async (page: any, cdp: any, selector: string, downloadDir: string, timeoutMs = 30_000): Promise<string> => {
  const before = new Set(fs.readdirSync(downloadDir));
  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no download completed within ${timeoutMs}ms`)), timeoutMs);
    cdp.on('Browser.downloadProgress', (e: any) => {
      if (e.state === 'completed') { clearTimeout(timer); resolve(); }
      if (e.state === 'canceled') { clearTimeout(timer); reject(new Error('download canceled')); }
    });
  });
  await page.click(selector);
  await done;
  const added = fs.readdirSync(downloadDir).filter((f) => !before.has(f) && !f.endsWith('.crdownload'));
  if (added.length !== 1) throw new Error(`expected exactly one new file, got ${JSON.stringify(added)}`);
  return path.join(downloadDir, added[0]);
};

const main = async () => {
  const { createServer } = await import('vite');
  const puppeteer: any = (await import('puppeteer')).default;
  const { KnownDevices } = await import('puppeteer');

  const stub = (name: string) => path.join(ROOT, 'scripts', 'stubs', name);
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'silent',
    server: { port: PORT, strictPort: true },
    resolve: {
      alias: [
        // Only for this harness server: lets context/ScopeContext mount without initialising Firebase.
        { find: /^\.\.\/services\/persistenceService$/, replacement: stub('persistenceService.ts') },
        { find: /^\.\/AuthContext$/, replacement: stub('AuthContext.ts') },
        { find: /^\.\.\/context\/AuthContext$/, replacement: stub('AuthContext.ts') },
      ],
    },
  });
  await server.listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  try {
    const scenarios: Array<{ name: string; setup: (page: any) => Promise<void> }> = [
      { name: 'desktop 1280x800', setup: async (page) => { await page.setViewport({ width: 1280, height: 800 }); } },
      { name: 'iPhone 13 emulation (viewport, UA, touch)', setup: async (page) => { await page.emulate(KnownDevices['iPhone 13']); } },
    ];

    for (const scenario of scenarios) {
      console.log(`\n${scenario.name.toUpperCase()}:`);
      const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbos-pdf-'));
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (e: Error) => pageErrors.push(e.message));
      page.on('console', (m: any) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      await scenario.setup(page);

      const cdp = await page.createCDPSession();
      await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });

      await page.goto(`http://localhost:${PORT}/scripts/harness/pdf.html`, { waitUntil: 'networkidle0', timeout: 60_000 });
      await page.waitForFunction(() => (window as any).__harnessReady === true, { timeout: 30_000 });

      // Structured (History) path.
      let file = '';
      try { file = await clickAndCapture(page, cdp, '#export-result', downloadDir); } catch (e: any) { ok(false, 'structured export produced a download', e.message); }
      if (file) {
        ok(file.endsWith('.pdf'), `downloaded file is a .pdf (${path.basename(file)})`);
        ok(fs.readFileSync(file).subarray(0, 5).toString('latin1') === '%PDF-', 'file starts with a PDF header');
        const { text, pages } = await pdfText(file);
        ok(pages >= 1, `parsed ${pages} page(s)`);
        ok(has(text, 'Harness Conversion Doctor Report'), 'title present in the file');
        ok(has(text, 'Conversion blockers') && has(text, 'Recommended fixes') && has(text, 'Rewrites'), 'all three History sections present');
        ok(has(text, 'Headline names the category, not the outcome'), 'a real finding is present');
        ok(!has(text, 'Export structured PDF'), 'no page/button chrome in the file (the old symptom)');
      }

      // Text (bespoke pages) path.
      let file2 = '';
      try { file2 = await clickAndCapture(page, cdp, '#export-text', downloadDir); } catch (e: any) { ok(false, 'text export produced a download', e.message); }
      if (file2) {
        const { text } = await pdfText(file2);
        ok(has(text, 'KEY CONVERSION ISSUES'), 'text-path headings present');
      }

      const lastError = await page.evaluate(() => (window as any).__lastError);
      ok(!lastError, 'export functions threw nothing', String(lastError));
      ok(pageErrors.length === 0, 'no uncaught page errors', pageErrors.join(' | '));
      ok(consoleErrors.length === 0, 'no console errors', consoleErrors.join(' | '));
      await page.close();
    }

    // ---- Scope context: opening a client must not loop -----------------------------------------
    console.log('\nSCOPE CONTEXT (ClientWorkspace effect):');
    {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (e: Error) => pageErrors.push(e.message));
      // domcontentloaded, not networkidle: a looping page never goes idle, and the point is to
      // report that as a labelled failure rather than a navigation timeout.
      let renders = -1;
      let text: string | null | undefined = null;
      try {
        await page.goto(`http://localhost:${PORT}/scripts/harness/scope.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForFunction(() => (window as any).__harnessReady === true, { timeout: 15_000 });
        await new Promise((r) => setTimeout(r, 1500));   // long enough for a loop to run away
        renders = await page.evaluate(() => (window as any).__renders());
        text = await page.evaluate(() => document.getElementById('scope')?.textContent);
      } catch (e: any) {
        pageErrors.push(`harness page unresponsive: ${e.message}`);
      }
      ok(text === 'client:client-1', `consumer entered client scope (${text})`);
      ok(renders >= 0 && renders <= 10, `consumer rendered a bounded number of times (${renders})`);
      ok(!pageErrors.some((m) => /Maximum update depth|unresponsive/i.test(m)), 'no "Maximum update depth exceeded" and page stayed responsive', pageErrors.join(' | ').slice(0, 300));
      await page.close().catch(() => undefined);
    }

    // ---- Header layout: nothing overlaps or wraps at any width ------------------------------
    // The QA report found the logo running into "FEATURES" and "SIGN IN" wrapping at 768px.
    console.log('\nHEADER LAYOUT (app header + public nav):');
    {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (e: Error) => pageErrors.push(e.message));
      await page.goto(`http://localhost:${PORT}/scripts/harness/header.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => (window as any).__harnessReady === true, { timeout: 30_000 });
      for (const width of [640, 768, 1024, 1280]) {
        await page.setViewport({ width, height: 800 });
        await new Promise((r) => setTimeout(r, 400));
        const app = await page.evaluate(() => (window as any).__overlaps('#app-header header'));
        const pub = await page.evaluate(() => (window as any).__overlaps('#public-nav header'));
        ok(app.length === 0, `app header has no overlapping or wrapped elements at ${width}px`, JSON.stringify(app).slice(0, 300));
        ok(pub.length === 0, `public nav has no overlapping or wrapped elements at ${width}px`, JSON.stringify(pub).slice(0, 300));
      }
      ok(pageErrors.length === 0, 'header harness rendered without page errors', pageErrors.join(' | ').slice(0, 300));
      await page.close();
    }

    // ---- AnimatedSection: content must not stay invisible ----------------------------------
    console.log('\nANIMATED SECTION REVEAL (375x667):');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`http://localhost:${PORT}/scripts/harness/reveal.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => (window as any).__harnessReady === true, { timeout: 30_000 });
      await new Promise((r) => setTimeout(r, 1500));
      const tall = await page.evaluate(() => (window as any).__opacity('tall'));
      ok(tall === 1, `a section taller than five viewports is fully visible within 1.5s (opacity ${tall})`);
      await page.evaluate(() => (window as any).__mountLate());
      await new Promise((r) => setTimeout(r, 1000));
      const late = await page.evaluate(() => (window as any).__opacity('late'));
      ok(late === 1, `a section mounted after a click is fully visible within 1s (opacity ${late})`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  // ---- Full app (no stubs): analytics consent and the sign-in page title --------------------
  // A second dev server without the harness aliases, so the real AuthProvider and Firebase run.
  console.log('\nFULL APP (consent + titles):');
  {
    const appServer = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'silent', server: { port: PORT + 1, strictPort: true } });
    await appServer.listen();
    const browser2 = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
    try {
      const page = await browser2.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      const analyticsHits: string[] = [];
      /*
       * URL *AND* BODY. GA4 sends a single event as a GET with `en=` in the query, but
       * BATCHES several into one POST whose event names live only in the body — so a
       * check reading the URL alone sees the first page_view and concludes the rest of
       * the instrumentation is dead. Both are captured; the assertion below reads both.
       */
      page.on('request', (req: any) => {
        const u = req.url();
        if (!/google-analytics\.com|googletagmanager\.com|\/gtag\/|analytics\.google\.com/.test(u)) return;
        analyticsHits.push(u + (req.postData() ? `\n${req.postData()}` : ''));
      });
      await page.goto(`http://localhost:${PORT + 1}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await new Promise((r) => setTimeout(r, 4000));
      const before = analyticsHits.length;
      ok(before === 0, `no analytics request before consent (${before} seen)`, analyticsHits.slice(0, 2).join(' | '));
      const hasBanner = await page.$('#consent-accept');
      ok(!!hasBanner, 'consent banner is present on first visit');
      if (hasBanner) {
        await page.click('#consent-accept');
        await new Promise((r) => setTimeout(r, 4000));
        ok(analyticsHits.length > before, `analytics loads after Accept (${analyticsHits.length - before} requests)`);
        const persisted = await page.evaluate(() => { try { return localStorage.getItem('mbos_consent'); } catch { return null; } });
        ok(!!persisted, `consent choice is persisted (${persisted})`);

        /*
         * AND THE EVENTS ACTUALLY GO OUT (GTM E01).
         *
         * Everything up to here proves gtag LOADED. A wrapper that silently dropped every
         * call would pass all of it, and every static check in analytics.test.ts too —
         * and the go-to-market plan's gates would read zero forever with nothing looking
         * broken. GA4 names the event in the `en` parameter of its collect request, so
         * this reads the actual traffic rather than the code's intentions.
         */
        /*
         * AND THE EVENTS ACTUALLY GO OUT (GTM E01).
         *
         * Everything above proves gtag LOADED. A wrapper that silently dropped every call
         * would pass all of it, and every static check in analytics.test.ts too, while the
         * plan's gates read zero forever and nothing looked broken.
         *
         * THE EIGHT SECONDS ARE MEASURED, NOT GUESSED. GA4 sends the first page_view at
         * once and BATCHES everything after it — timed at ~6s from arrival in this flow —
         * and the event names then live only in the POST BODY, never the query string. A
         * check that waited three seconds and read request URLs called working
         * instrumentation dead twice before this was tracked down.
         *
         * Expect each event TWICE in dev: React StrictMode double-invokes effects. It
         * does not in a production build, so this is not double counting.
         */
        await page.goto(`http://localhost:${PORT + 1}/pricing`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await new Promise((r) => setTimeout(r, 8000));
        const named = analyticsHits
          .flatMap((u) => [...u.matchAll(/(?:[?&]|^)en=([a-z_]+)/gm)].map((m) => m[1]!));
        ok(named.includes('pricing_viewed') && named.includes('landing_view'),
          `real events reach GA4 after consent (saw: ${[...new Set(named)].join(', ') || 'none'})`);
      }
      await page.goto(`http://localhost:${PORT + 1}/auth`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await new Promise((r) => setTimeout(r, 2500));
      const title = await page.title();
      ok(/sign in/i.test(title), `sign-in page sets its own tab title ("${title}")`);

      await page.close();
    } finally {
      await browser2.close();
      await appServer.close();
    }
  }

  console.log(failures === 0 ? '\nPASS — a click produces a PDF file in a real browser, desktop and mobile alike.' : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
