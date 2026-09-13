// Enforces the Content-Security-Policy from vercel.json over every crawlable route and reports
// violations - BEFORE the production header is switched from Report-Only to enforcing.
//
// Production serves the policy as Content-Security-Policy-Report-Only, which blocks nothing. This
// script serves the built site locally, injects the same policy as an ENFORCING header on every
// document response, loads each prerendered route plus the app shell and the sign-in page, and
// collects the browser's "Refused to ..." console messages. Any violation here would be a broken
// page in production once the header is enforced.
//
// Stated limit: signed-in flows (Firestore reads, the Google sign-in popup) cannot be exercised
// without credentials, so their origins are allowlisted from the SDK's documented endpoints rather
// than observed. Check DevTools once while signed in before flipping the header.
//
// Run: `npm run test:csp` (needs `vite build` output in dist/).

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 4181;

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const POLICY: string | undefined = (vercel.headers || [])
  .flatMap((h: any) => h.headers)
  .find((x: any) => /^content-security-policy(-report-only)?$/i.test(x.key))?.value;
if (!POLICY) { console.error('FAIL — no Content-Security-Policy in vercel.json'); process.exit(1); }

const routes = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'assets') walk(full);
      else if (e.name === 'index.html') out.push('/' + path.relative(DIST, dir).split(path.sep).filter(Boolean).join('/'));
    }
  };
  walk(DIST);
  return [...new Set(out.map((r) => (r === '/' ? '/' : r)))];
};

const main = async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('FAIL — dist/ missing; run vite build first'); process.exit(1); }
  const sirv = (await import('sirv')).default;
  const puppeteer: any = (await import('puppeteer')).default;

  const serve = sirv(DIST, { single: true, dev: false });
  const server = http.createServer((req, res) => serve(req, res, () => { res.statusCode = 404; res.end('not found'); }));
  await new Promise<void>((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  const targets = [...routes(), '/app.html', '/auth'];
  const violations: string[] = [];
  let checked = 0;
  try {
    for (const route of targets) {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', async (req: any) => {
        // Only document responses carry the header in production; mirror that.
        if (req.resourceType() !== 'document') return req.continue();
        try {
          const upstream = await fetch(req.url());
          const body = Buffer.from(await upstream.arrayBuffer());
          const headers: Record<string, string> = {};
          upstream.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding)$/i.test(k)) headers[k] = v; });
          headers['content-security-policy'] = POLICY;           // ENFORCING, on purpose
          await req.respond({ status: upstream.status, headers, body });
        } catch (e) { await req.continue(); }
      });
      page.on('console', (m: any) => {
        const t = m.text();
        if (/Content Security Policy|Refused to/i.test(t)) violations.push(`${route}: ${t.slice(0, 220)}`);
      });
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 60_000 }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 800));
      checked++;
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`Checked ${checked} routes under an ENFORCED policy of ${POLICY.split('; ').length} directives.`);
  if (violations.length) {
    console.error(`\nFAIL — ${violations.length} CSP violation(s) would break these pages once enforced:\n`);
    for (const v of [...new Set(violations)].slice(0, 40)) console.error('  ' + v);
    process.exit(1);
  }
  console.log('\nPASS — no CSP violations on any crawlable route.\n');
};

main().catch((e) => { console.error(e); process.exit(1); });
