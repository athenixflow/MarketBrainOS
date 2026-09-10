# SEO Audit — marketbrainos.app

**Date:** 2026-09-10
**Scope:** the 57 public, prerendered routes (8 marketing + 49 documentation). The signed-in app is
correctly excluded from the sitemap and is out of scope.
**Business type:** B2B SaaS (AI marketing intelligence), self-serve with tiered plans.

## SEO Health Score: 78 / 100

> **REVISED 2026-09-10 after the deeper `/seo-technical` pass.** That pass found a **critical** defect
> this report originally missed: every page carries two canonical tags, the first pointing at the
> homepage. Technical SEO drops 72 → 63. Full detail in [`findings/technical.md`](findings/technical.md).
>
> **The composite score understates this risk.** A weighted average moves barely a point, but the
> canonical issue is binary — pages either stay indexed or they do not. Read the Critical item below
> before the scores.

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 63 ↓ |
| Content Quality | 23% | 85 |
| On-Page SEO | 20% | 68 |
| Schema / Structured Data | 10% | 90 |
| Performance (CWV) | 10% | 75 ↑ |
| AI Search Readiness | 10% | 95 |
| Images | 5% | 95 |

This is a well-built site — prerendering, structured data and image discipline are all present and
working, and INP measured a strong 64ms. But one line in `index.html` is putting most of the site's
indexation at risk.

## CRITICAL — every page canonicalises to the homepage

All 57 pages ship two `<link rel="canonical">` tags. The first, hardcoded at `index.html:14`, points at
the homepage on every page; the second, from react-helmet, is correct.

Google's December 2025 JavaScript SEO guidance is explicit that when a raw-HTML canonical differs from
a JS-injected one, it may use **either**. If it takes the first, 56 of 57 pages declare themselves
duplicates of the homepage.

The cause is a reasonable misunderstanding: react-helmet-async *replaces* singleton elements like
`<title>` (which is why titles are correct everywhere) but *appends* `<meta>` and `<link>`, leaving the
static tag ahead of its own. The same mechanism causes the duplicate description below.

**Fix: delete `index.html:14` and `index.html:11`.** Two lines, and it is the highest-value SEO action
available on this site.

## A note on method

The `claude-seo` skill expects a `claude-seo` CLI (`render_page.py`, `google_auth.py`, and so on). That
CLI is **not installed** — `skills add` copies only the skill's Markdown, not the repository's `bin/`
and `scripts/`. This audit was run with Puppeteer, curl and the project source instead.

The practical consequence: **all performance numbers here are lab data**, measured from one machine on
one connection. They are not CrUX field data and should not be treated as what your real users
experience. Field data needs Google API credentials, which are not configured.

---

## What already works

Worth stating plainly, because it is most of the site:

- **Prerendering works.** All 57 routes serve real HTML with per-route titles, H1s and content. This is
  the single biggest SEO risk for a React SPA and it is solved.
- **robots.txt** allows everything, names the sitemap, and explicitly welcomes AI crawlers.
- **sitemap.xml** is valid, complete at 57 URLs, `lastmod` current, and correctly contains **no**
  private app routes.
- **llms.txt** is present and genuinely well written — a structured summary with per-page links.
- **Canonicals** on every page. Apex correctly 308-redirects to `www`.
- **JSON-LD** on every page (Organization + SoftwareApplication; FAQPage on `/faq`).
- **Open Graph** complete, 15 properties per page.
- **Images** are exemplary: every `<img>` has an `alt` attribute, all carry explicit `width`/`height`,
  7 of 8 lazy-load, and they ship as responsive AVIF/WebP/JPG. Measured CLS is **0.000** with zero
  layout shifts, which is a direct result of that discipline.
- **Payload is lean:** 338KB across 15 requests for the homepage.

---

## Technical SEO — 72

### Unknown URLs return HTTP 200 (soft-404) — High

`https://www.marketbrainos.app/no-such-page-xyz` returns **200 OK**, not 404. The SPA rewrite sends
every unmatched path to `index.html`, so any typo, stale link or crawler-invented URL becomes an
indexable page that renders the NotFound view under a success status.

Google treats these as soft-404s. They waste crawl budget and can dilute the index with near-duplicate
shells.

**Fix:** the app already has a `NotFound` route. Have Vercel serve genuine 404 status for paths outside
the known route list, or add a prerender-time 404 for unmatched routes. On Vercel this is a
`vercel.json` routes/headers change rather than app code.

### Missing security headers — Medium

Only `Strict-Transport-Security` is present. Absent: `X-Content-Type-Options`, `X-Frame-Options` (or a
CSP `frame-ancestors`), `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`.

These are a light ranking/trust signal but a real security posture gap, and they were flagged in the
earlier security review too. HSTS is also missing `includeSubDomains` and `preload`.

**Fix:** add them in `vercel.json` headers. Note the site is served by **Vercel**, not the Firebase
Hosting config in `firebase.json` — see the deployment note below.

### Deployment note (not an SEO finding, but material)

`www.marketbrainos.app` is served by **Vercel** (`Server: Vercel`, `X-Vercel-Cache: HIT`). Production
deploys therefore come from pushing to `main`, not from `firebase deploy --only hosting` — that
publishes to `marketbrainosweb.web.app`, a secondary URL. The header rules in `firebase.json` do **not**
apply to the live domain, which is part of why the security headers above are missing in production.

---

## On-Page SEO — 68

This is the weakest category, and all three findings share one cause: `index.html` carries static SEO
markup that was correct before prerendering existed, and now duplicates what react-helmet emits.

### Duplicate meta description on all 57 pages — High

Every page ships **two** `<meta name="description">` tags:

1. `index.html:11` — a single hardcoded description, identical sitewide
2. react-helmet's correct per-page description from `config/seo.ts`

The stale one comes **first**, and search engines generally take the first. So the excellent per-page
descriptions written in `config/seo.ts` — "Explore MarketBrain OS's 13 AI marketing tools…",
"Simple, transparent pricing…" — are very likely never used, and all 57 pages present the same snippet.

**Fix:** delete the hardcoded `<meta name="description">` from `index.html:11`. Helmet already supplies
it on every route. One line, and it unlocks work that is already written.

### Duplicate H1 on all 57 pages — Medium

`index.html:100` places `<h1>MarketBrain OS: Predictive Marketing Intelligence Platform</h1>` inside a
`<noscript>` semantic fallback. It appears in the raw HTML of every page, ahead of the real per-page
H1, so each page has two H1s and the first is identical sitewide.

The fallback was a sound idea before prerendering. Now it is redundant: the prerender already gives
crawlers full per-route content without JavaScript, and instead this stamps the same generic homepage
boilerplate into all 57 pages — including `/privacy` and `/terms`.

**Fix:** remove the `<noscript>` block, or reduce it to a short pointer. The prerender supersedes it.

### Homepage title is 81 characters — Low

`MarketBrain OS | AI Marketing Intelligence & Conversion Optimization Platform` truncates in SERPs
(~60 chars). Every other page is well within range (22–43).

**Fix:** shorten to roughly `MarketBrain OS | AI Marketing Intelligence Platform` (51).

---

## Performance — 70

Lab measurements, headless Chrome, unthrottled:

| Metric | Desktop | Mobile | Target |
|---|---|---|---|
| LCP | **3056 ms** | 1264 ms | < 2500 ms |
| CLS | 0.000 | 0.000 | < 0.1 |
| TTFB | 1255 ms | — | < 800 ms |
| Transfer | 338 KB / 15 requests | — | — |

CLS is perfect. Mobile LCP is comfortably good. **Desktop LCP is the one real problem.**

### The LCP image cannot be preload-scanned — High (perf)

The LCP element on both viewports is the hero poster (`hero-poster-*.webp`), rendered by
`components/media/HeroVideo.tsx:45` as a CSS `background-image` on a `<div>`.

A CSS background is discovered only after CSS parses and the element lays out, so the browser's preload
scanner never sees it. There is also no `<link rel="preload">` anywhere in `index.html`. On desktop the
~1MB hero video downloads concurrently and competes for bandwidth, which is why desktop (3.06s) is
almost 3× slower than mobile (1.26s) — mobile shows the poster only and skips the video.

**Fix, in order of impact:**
1. Add `<link rel="preload" as="image" href="/assets/hero-poster-*.webp">` to `index.html`, or render
   the poster as a real `<img>` with `fetchpriority="high"` instead of a CSS background.
2. Delay the video until after LCP (it is already `preload="metadata"`, which is right).

TTFB of 1.25s is worth watching but may be geography or a cold edge; confirm against field data before
acting.

---

## Schema — 90

JSON-LD present on all pages: `Organization`, `SoftwareApplication`, and `FAQPage` on `/faq` (two
blocks). Publisher references are wired with `@id`.

**Correction (2026-09-10):** an earlier draft of this report claimed the 49 documentation pages carry
only sitewide schema. That was wrong - it tested the docs hub, not an article. Articles already ship 3
JSON-LD blocks including `TechArticle` and `BreadcrumbList` (`DocArticle.tsx:59`). Only the hub and
category pages lacked page-level schema, and `CollectionPage` has since been added to the category
pages.

---

## Content Quality — 85

49 documentation pages is real topical depth for a product this size, and the marketing copy is
specific rather than generic. `llms.txt` is unusually good.

The one deduction is the duplicated `<noscript>` boilerplate described above, which puts identical
generic prose into the raw HTML of all 57 pages.

---

## AI Search Readiness — 95

The strongest category. `llms.txt` is present, rich and correctly structured; `robots.txt` names AI
crawlers explicitly and allows them; content is prerendered so answer engines that do not execute
JavaScript still get the full page; headings are semantic.

Nothing to fix. Keeping `llms.txt` in step with the product as it changes is the only ongoing work.

---

## Images — 95

Nothing to fix. Alt attributes on all 8 homepage images (4 intentionally empty for decorative art,
which is correct), explicit dimensions everywhere, lazy loading on 7 of 8, responsive AVIF/WebP/JPG
from the media pipeline. This is why CLS is 0.
