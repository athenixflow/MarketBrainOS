// Build-time prerender: runs the real, built app in a headless browser and snapshots per-route HTML
// so crawlers and AI answer engines (which do NOT execute JS) receive full content + metadata +
// JSON-LD. Also generates the OG image, apple-touch-icon, sitemap.xml, and llms.txt.
// Runs after `vite build` (see package.json build script). Executed via `tsx`.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import sirv from 'sirv';
import { DOC_CATEGORIES, DOC_ARTICLES } from '../config/docs/registry';
import { SITE_URL } from '../config/seo';
import { COMPETITORS, isPublishable } from '../config/pseo/competitors';

// Launch headless Chrome. On Vercel/CI the build sandbox (Amazon Linux) has no usable Chromium, so
// use @sparticuz/chromium (a self-contained Linux binary) via puppeteer-core. Locally, use full
// puppeteer's bundled Chromium. Same launch shape both ways.
async function launchBrowser(): Promise<any> {
  if (process.env.VERCEL || process.env.CI) {
    const chromium: any = (await import('@sparticuz/chromium')).default;
    const pc: any = await import('puppeteer-core');
    return pc.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: { width: 1280, height: 800 },
    });
  }
  const puppeteer: any = (await import('puppeteer')).default;
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const PORT = 4178;
const ORIGIN = `http://localhost:${PORT}`;

// ---- Route list (single source of truth: marketing pages + the docs registry) -------------------
/*
 * The prerendered marketing set.
 *
 * `/tools/landing-page-score` is a landing page in its own right — the page every channel
 * points at (part 10). `/compare` is prerendered whatever its state, because the
 * comparison breadcrumbs point at it and it has to exist as HTML; it sets its own
 * noindex while nothing beneath it is verified. Individual comparisons appear only while
 * their figures are verified inside the window (part 10 §4.2), because a stale price in a
 * search result is a false claim with a date on it.
 *
 * COMMENTS STAY OUT OF THE ARRAY BELOW. scripts/routes.test.mjs reads this literal to know
 * what is served from the filesystem, and a comment inside it broke that parse — which
 * then reported the prerendered hub as a route that would 404 in production.
 */
const MARKETING = ['/', '/features', '/pricing', '/about', '/faq', '/privacy', '/terms',
  '/tools/landing-page-score', '/compare',
  ...COMPETITORS.filter((c) => isPublishable(c)).map((c) => `/compare/${c.slug}`)];
const DOCS = [
  '/documentation',
  ...DOC_CATEGORIES.map((c) => `/documentation/${c.id}`),
  ...DOC_ARTICLES.map((a) => `/documentation/${a.categoryId}/${a.id}`),
];
// Prerender sub-routes first and '/' last so the SPA fallback keeps serving the original empty shell
// while we crawl (we buffer HTML in memory and only write files at the end, so order is belt-and-braces).
const ROUTES = [...DOCS, ...MARKETING.slice(1), '/'];

const routeToFile = (route: string): string =>
  route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, route, 'index.html');

// ---- Asset templates ----------------------------------------------------------------------------
const OG_HTML = `<!doctype html><html><body style="margin:0">
  <div style="width:1200px;height:630px;background:#0B0B0B;display:flex;flex-direction:column;justify-content:center;padding:90px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif">
    <div style="display:flex;align-items:center;gap:22px;margin-bottom:44px">
      <div style="width:68px;height:68px;background:#FF0000;border-radius:16px;color:#fff;font-size:42px;font-weight:800;display:flex;align-items:center;justify-content:center">M</div>
      <div style="color:#fff;font-size:26px;font-weight:800;letter-spacing:5px">MARKETBRAIN OS</div>
    </div>
    <div style="color:#fff;font-size:62px;font-weight:800;line-height:1.08;max-width:960px">AI Marketing Intelligence &amp; Conversion Optimization</div>
    <div style="color:#9ca3af;font-size:29px;margin-top:30px;max-width:900px">Review the work before you spend: audit funnels, compare variants, pressure-test the plan.</div>
  </div>
</body></html>`;

const ICON_HTML = `<!doctype html><html><body style="margin:0">
  <div style="width:180px;height:180px;background:#FF0000;border-radius:40px;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif">
    <div style="color:#fff;font-size:120px;font-weight:800;line-height:1">M</div>
  </div>
</body></html>`;

// ---- Main ---------------------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/index.html not found — run `vite build` before prerendering.');
  }

  // app.html: the plain Vite shell, for the signed-in app routes. Every app route used to rewrite to
  // index.html, which is the prerendered HOMEPAGE - so opening /history on a phone painted the
  // marketing landing page, then blank while React replaced it, then the app. The rewrites in
  // vercel.json now target this file instead. Written before the loop below overwrites index.html
  // with the "/" snapshot. noindex in the raw HTML on purpose: nothing served through this shell
  // is a public page, and Google may honour a raw-HTML noindex even if JS later changes it.
  const shell = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  if (/<h1|<main/i.test(shell)) throw new Error('dist/index.html already contains rendered content; app.html must come from the clean Vite shell.');
  const appShell = shell.replace(/<meta name="robots"[^>]*>/i, '').replace('</head>', '  <meta name="robots" content="noindex, nofollow">\n</head>');
  fs.writeFileSync(path.join(DIST, 'app.html'), appShell, 'utf8');

  const serve = sirv(DIST, { single: true, dev: false });
  const server = http.createServer((req, res) => serve(req, res, () => { res.statusCode = 404; res.end('not found'); }));
  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  const browser = await launchBrowser();

  // Generate social/icon assets.
  const shot = async (html: string, width: number, height: number, out: string) => {
    const p = await browser.newPage();
    await p.setViewport({ width, height, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: 'load' });
    await p.screenshot({ path: out as `${string}.png`, type: 'png' });
    await p.close();
  };
  await shot(OG_HTML, 1200, 630, path.join(DIST, 'og-image.png'));
  await shot(ICON_HTML, 180, 180, path.join(DIST, 'apple-touch-icon.png'));
  console.log('generated og-image.png + apple-touch-icon.png');

  // Crawl each route and buffer the rendered HTML.
  const rendered: Record<string, string> = {};
  for (const route of ROUTES) {
    const page = await browser.newPage();
    try {
      // Components can read this flag to skip prerender-only chrome (the consent banner does), so a
      // snapshot never bakes in UI that only makes sense for a live visitor.
      await page.evaluateOnNewDocument(() => { (window as any).__MBOS_PRERENDER = true; });
      await page.goto(`${ORIGIN}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Wait until the app mounted and react-helmet-async applied per-route head tags.
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return !!root && root.children.length > 0 && !!document.title && !!document.querySelector('link[rel="canonical"]');
        },
        { timeout: 20000 },
      ).catch(() => { /* fall through and capture whatever rendered */ });
      // A tall viewport puts whole AnimatedSections "in view" at once, so the snapshot carries none of
      // framer-motion's opacity:0 start state (the write loop below fails the build if any remains).
      // The homepage is longer than 4000px, so sweep to the bottom as well: every section intersects
      // the viewport once, and `viewport.once` keeps it revealed after scrolling back to the top.
      await page.setViewport({ width: 1280, height: 4000 });
      await page.evaluate(async () => {
        for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
        window.scrollTo(0, 0);
      });
      // 1200ms, not 600: the last sections to enter view sit in their stagger delay (up to 0.32s) before the
      // 0.5s fade, and the guard below fails the build on any element still at exactly opacity:0.
      await new Promise((r) => setTimeout(r, 1200));
      rendered[route] = await page.content();
      console.log('prerendered', route);
    } catch (e) {
      console.error('FAILED', route, (e as Error).message);
      throw e;
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();

  // Write per-route HTML files. A snapshot that still carries framer-motion's `opacity:0` start state
  // means a section had not revealed when the page was captured - crawlers and no-JS readers would
  // get invisible content, and the QA audit saw exactly that on phones. Fail the build instead.
  for (const route of ROUTES) {
    // `(?<![a-z-])` keeps SVG `stop-opacity:0` / `fill-opacity:0` from tripping the guard.
    const hidden = (rendered[route].match(/(?<![a-z-])opacity:\s*0[;"]/g) || []).length;
    if (hidden > 0) throw new Error(`${route}: ${hidden} element(s) captured at opacity:0 - the prerender viewport must reveal every section before the snapshot.`);
    const file = routeToFile(route);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rendered[route], 'utf8');
  }

  // 404.html — served by Vercel with a real 404 status for anything outside the route allowlist in
  // vercel.json. Without this every typo returned 200 with the app shell, which Google treats as a
  // soft-404. The homepage snapshot is reused as the shell: React takes over on load and its own
  // catch-all route renders NotFound, so the visitor still gets the right page, but the STATUS is
  // now honest. The <title> is overridden so a crawler reading only raw HTML sees it too.
  const notFound = rendered['/']
    .replace(/<title>[^<]*<\/title>/i, '<title>Page not found | MarketBrain OS</title>')
    .replace(/(<meta name="robots" content=")[^"]*(")/i, '$1noindex, follow$2');
  fs.writeFileSync(path.join(DIST, '404.html'), notFound, 'utf8');

  // sitemap.xml (clean canonical URLs + real lastmod; no changefreq/priority — ignored by Google).
  const today = new Date().toISOString().slice(0, 10);
  /*
   * A NOINDEX PAGE DOES NOT BELONG IN THE SITEMAP. `/compare` is prerendered whatever its
   * state — the comparison breadcrumbs point at it, so the URL has to resolve — but while
   * nothing beneath it is verified the page sets its own noindex, and listing it here
   * would ask an engine to crawl a page that then tells it to go away. Contradictory
   * signals are worse than either signal alone.
   */
  const hubIsEmpty = COMPETITORS.every((c) => !isPublishable(c));
  const urls = [...MARKETING.filter((r) => !(r === '/compare' && hubIsEmpty)),
    ...DOCS.filter((r) => r !== '/')];
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((r) => `  <url><loc>${SITE_URL}${r === '/' ? '/' : r}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  // llms.txt — a curated Markdown index for AI/agent consumers.
  const lines: string[] = [
    '# MarketBrain OS',
    '',
    // The first sentence is what an engine quotes back. It names the JOB (a review before
    // spending) rather than a category phrase enterprise CDP vendors already own, and claims
    // no prediction: the tools score and explain, they do not forecast results.
    '> MarketBrain OS is a pre-spend review tool for marketers: it audits a landing page from its live URL, compares two to five ad or headline variants and says which is strongest and why, builds audience and competitor analyses, and pressure-tests a campaign plan — each returning a scored report with ranked fixes. It reviews work before the budget is spent; it does not predict results, buy media, schedule posts or write your content.',
    '',
    '## Core pages',
    `- [Home](${SITE_URL}/): What MarketBrain OS is and who it is for.`,
    `- [Features](${SITE_URL}/features): The 14 AI analysis tools across five suites.`,
    `- [Pricing](${SITE_URL}/pricing): Free, Pro, Team, Agency, Enterprise plans and token packs.`,
    `- [FAQ](${SITE_URL}/faq): Common questions on tokens, pricing, and data.`,
    /* The free scorer is the page an engine should send somebody to: it is the only
       surface that answers "can it actually do this" without an account. */
    `- [Free landing page score](${SITE_URL}/tools/landing-page-score): Paste a URL, get a 0-100 conversion score and the three biggest blockers. No account needed.`,
    `- [About](${SITE_URL}/about): Mission and story.`,
    '',
    '## Documentation',
  ];
  for (const cat of DOC_CATEGORIES) {
    lines.push('', `### ${cat.title}`, `${cat.summary}`, '');
    for (const a of DOC_ARTICLES.filter((x) => x.categoryId === cat.id)) {
      lines.push(`- [${a.title}](${SITE_URL}/documentation/${a.categoryId}/${a.id}): ${a.summary}`);
    }
  }
  fs.writeFileSync(path.join(DIST, 'llms.txt'), lines.join('\n') + '\n', 'utf8');

  // IndexNow - notifies Bing, Yandex and Naver that these URLs changed. No account and no third
  // party involved: the key is just a static file at /<key>.txt, echoed back in the payload.
  // Google does not participate. Best-effort by design - a failure here must never fail a build.
  if (process.env.INDEXNOW !== 'off') {
    const indexNowKey = '53cced001d074ecd864d9a166cff359d';
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(SITE_URL).host,
          key: indexNowKey,
          keyLocation: `${SITE_URL}/${indexNowKey}.txt`,
          urlList: urls.map((r) => `${SITE_URL}${r === '/' ? '/' : r}`),
        }),
      });
      console.log(`IndexNow: submitted ${urls.length} URLs (HTTP ${res.status})`);
    } catch (e) {
      console.warn('IndexNow: submission skipped -', (e as Error).message);
    }
  }

  console.log(`\nPrerender complete: ${ROUTES.length} routes, sitemap.xml (${urls.length} urls), llms.txt.`);
}

main().catch((e) => {
  console.error(e);
  // On Vercel/CI a prerender failure must NOT break the deploy — the SPA still ships (SEO degraded),
  // and we verify the live site with curl afterward. Locally, fail loudly so problems are caught.
  if (process.env.VERCEL || process.env.CI) {
    console.error('\n⚠️  PRERENDER FAILED — deploying CSR-only (SEO degraded). Build continues.\n');
    process.exit(0);
  }
  process.exit(1);
});
