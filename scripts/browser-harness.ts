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

  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'silent', server: { port: PORT, strictPort: true } });
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
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(failures === 0 ? '\nPASS — a click produces a PDF file in a real browser, desktop and mobile alike.' : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
