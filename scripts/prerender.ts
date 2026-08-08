// Build-time prerender: runs the real, built app in a headless browser and snapshots per-route HTML
// so crawlers and AI answer engines (which do NOT execute JS) receive full content + metadata +
// JSON-LD. Also generates the OG image, apple-touch-icon, sitemap.xml, and llms.txt.
// Runs after `vite build` (see package.json build script). Executed via `tsx`.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import sirv from 'sirv';
import puppeteer from 'puppeteer';
import { DOC_CATEGORIES, DOC_ARTICLES } from '../config/docs/registry';
import { SITE_URL } from '../config/seo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const PORT = 4178;
const ORIGIN = `http://localhost:${PORT}`;

// ---- Route list (single source of truth: marketing pages + the docs registry) -------------------
const MARKETING = ['/', '/features', '/pricing', '/about', '/faq'];
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
    <div style="color:#9ca3af;font-size:29px;margin-top:30px;max-width:900px">Validate strategy, audit funnels, and simulate performance before you spend.</div>
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

  const serve = sirv(DIST, { single: true, dev: false });
  const server = http.createServer((req, res) => serve(req, res, () => { res.statusCode = 404; res.end('not found'); }));
  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

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
      await page.goto(`${ORIGIN}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Wait until the app mounted and react-helmet-async applied per-route head tags.
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return !!root && root.children.length > 0 && !!document.title && !!document.querySelector('link[rel="canonical"]');
        },
        { timeout: 20000 },
      ).catch(() => { /* fall through and capture whatever rendered */ });
      await new Promise((r) => setTimeout(r, 500)); // settle helmet + lazy chunks
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

  // Write per-route HTML files.
  for (const route of ROUTES) {
    const file = routeToFile(route);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rendered[route], 'utf8');
  }

  // sitemap.xml (clean canonical URLs + real lastmod; no changefreq/priority — ignored by Google).
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...MARKETING, ...DOCS.filter((r) => r !== '/')];
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
    '> AI marketing intelligence platform: validate strategy, audit landing pages, simulate ad performance, and generate high-converting angles before you spend. Not an ad manager, scheduler, or content writer — a decision-support intelligence layer.',
    '',
    '## Core pages',
    `- [Home](${SITE_URL}/): What MarketBrain OS is and who it is for.`,
    `- [Features](${SITE_URL}/features): The 13 AI analysis tools across five suites.`,
    `- [Pricing](${SITE_URL}/pricing): Free, Pro, Team, Agency, Enterprise plans and token packs.`,
    `- [FAQ](${SITE_URL}/faq): Common questions on tokens, pricing, and data.`,
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

  console.log(`\nPrerender complete: ${ROUTES.length} routes, sitemap.xml (${urls.length} urls), llms.txt.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
