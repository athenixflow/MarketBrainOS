# Technical SEO — marketbrainos.app

**Date:** 2026-09-10
**Method:** Puppeteer + curl + source inspection. The `claude-seo` CLI this skill expects is not
installed (`skills add` copies only Markdown, not the repo's `bin/`/`scripts/`), so
`sitemap_discovery.py`, `pagespeed_check.py` and `agent_ux_check.py` were substituted with equivalent
direct measurements. **All CWV figures are lab data**, not CrUX field data.

## Technical Score: 63 / 100

This revises the 72 given in the earlier full audit **downward**. That pass checked whether a canonical
tag was *present*; this one counted them, and found a conflict severe enough to change the picture.

| Category | Status | Score |
|---|---|---|
| Crawlability | pass | 90 |
| Indexability | **fail** | 35 |
| Security | warn | 60 |
| URL Structure | pass | 85 |
| Mobile | warn | 75 |
| Core Web Vitals | warn | 75 |
| Structured Data | pass | 90 |
| JavaScript Rendering | **fail** | 40 |
| IndexNow | fail | 0 |

---

## CRITICAL — every page canonicalises to the homepage

**All 57 pages ship two `<link rel="canonical">` tags.** The first, from `index.html:14`, is hardcoded
to the homepage and identical sitewide. The second, from react-helmet, is correct.

```
/features        → ['https://www.marketbrainos.app/', 'https://www.marketbrainos.app/features']
/pricing         → ['https://www.marketbrainos.app/', 'https://www.marketbrainos.app/pricing']
/documentation/tools/angle-miner
                 → ['https://www.marketbrainos.app/', 'https://www.marketbrainos.app/…/angle-miner']
```

This is precisely the failure mode Google's December 2025 JavaScript SEO update warns about: *when a
canonical in raw HTML differs from one injected by JavaScript, Google may use **either**.* If it takes
the first, **56 of your 57 pages declare themselves duplicates of the homepage** and drop out of the
index. `/features`, `/pricing` and all 49 documentation pages are exposed.

**Why it happens.** The comment at `index.html:8` reads "homepage defaults; per-route … injected at
runtime by react-helmet-async". The intent was replacement. But react-helmet-async only *replaces*
singleton elements such as `<title>` — which is why titles are correct and unique on every page. For
`<meta>` and `<link>` it **appends**, leaving the static tag in place ahead of its own.

**Fix:** delete `index.html:14`. Also `index.html:11` (the duplicate description, same mechanism, same
consequence for snippets). Verify after deploy that each page reports exactly one canonical.

This one change is the highest-value SEO action available on this site.

---

## Crawlability — 90 (pass)

- `robots.txt` valid, `Allow: /`, declares the sitemap, and explicitly welcomes AI answer engines.
- `sitemap.xml` valid, 57 URLs, `lastmod` current, **no private app routes** (all `/documentation/*`
  matches on an earlier grep were docs pages, not gated routes).
- **Page weight is far inside Googlebot's 2MB HTML fetch limit**: 23–60KB per route. No risk of
  content or JSON-LD being truncated out of the index.
- Crawl depth is shallow; every marketing page is one click from home.

**AI crawler posture:** the site allows every AI crawler, including `GPTBot`, `ClaudeBot`,
`PerplexityBot` and `Google-Extended`. Given the product is an AI marketing tool, being citable by
answer engines is almost certainly the right trade, and the `robots.txt` comment shows it is a
deliberate choice rather than an oversight. No change recommended.

---

## Indexability — 35 (fail)

1. **Conflicting canonicals on all 57 pages** — see Critical above.
2. **Duplicate meta description on all 57 pages.** Stale hardcoded tag at `index.html:11` precedes
   helmet's correct per-page one. Engines generally take the first, so the per-page descriptions in
   `config/seo.ts` are likely never used.
3. **Trailing-slash duplicates.** `/features` and `/features/` both return 200 with no redirect and
   byte-identical content (25,863 bytes each). The helmet canonical does point both at `/features`, so
   this resolves itself once the broken canonical is removed — but until then both variants are
   canonicalised to the homepage.
4. **Soft-404.** Unknown URLs return 200 with the app shell. Compounding this: Google does **not**
   render JavaScript on non-200 responses, so a correct 404 status would also stop it wasting render
   budget on shells.

`<meta name="robots">` is correct and consistent: `index, follow, max-image-preview:large,
max-snippet:-1, max-video-preview:-1`, present once, in the raw HTML. No accidental `noindex`.

---

## Security — 60 (warn)

**Passes:** HTTPS enforced, valid certificate, **zero mixed content**, HSTS present
(`max-age=63072000`), http→https and apex→www each a single hop.

**Back-button hijacking — PASS.** This became a Google spam-policy violation on 2026-04-13 with
enforcement live since 2026-06-15, so it is worth stating explicitly: instrumenting `history.pushState`
/ `replaceState` across a full page load and interaction sequence recorded **0 pushState calls and 1
replaceState**, with `history.length` of 2. The single `replaceState` is the legitimate HashRouter
back-compat redirect in `App.tsx`. The Back button is not defeated. No action.

**Missing headers:** `X-Content-Type-Options`, `X-Frame-Options` (or CSP `frame-ancestors`),
`Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`. HSTS lacks `includeSubDomains` and
`preload`.

Worth keeping in proportion: Google treats HTTPS as a confirmed but lightweight signal affecting under
about 1% of queries, and the standalone Page Experience report has been removed from Search Console.
These belong in the security backlog, not ahead of the canonical fix.

**These must go in `vercel.json`.** The live domain is served by Vercel (`Server: Vercel`), so the
`headers` block in `firebase.json` never reaches production.

---

## URL Structure — 85 (pass)

Clean, descriptive, hyphenated, logical hierarchy (`/documentation/tools/angle-miner`). No query
parameters for content. **No redirect chains** — every hop count measured was 0 or 1. Longest URL is
well under 100 characters. Only deduction is the unnormalised trailing slash noted above.

---

## Mobile — 75 (warn)

**Passes:** viewport meta present, no horizontal overflow at 390px, 16px base font (meets the minimum),
full desktop/mobile content parity — same titles, same robots directives, same structured data, primary
content not lazy-loaded behind interaction. No intrusive interstitials.

**22 touch targets below the 48×48px minimum.** Sample: a 32×32 mobile menu button, and multiple
342×16 links (nav/footer). Height is the failing dimension. Three text nodes render under 12px.

**Fix:** raise the tap area with padding rather than font size — `py-3` on the affected links and a
larger hit box on the menu button preserves the visual design.

---

## Core Web Vitals — 75 (warn)

| Metric | Desktop | Mobile | Target | Verdict |
|---|---|---|---|---|
| LCP | 3056 ms | 1264 ms | ≤2500 ms | desktop fails |
| **INP** | — | **64 ms** | ≤200 ms | **strong pass** |
| CLS | 0.000 | 0.000 | ≤0.1 | perfect |

INP measured across 19 real interaction events at 64ms is comfortably good — a genuinely well-behaved
React app. CLS of exactly 0 reflects explicit `width`/`height` on every image.

Desktop LCP is the single failure. The LCP element is the hero poster, rendered as a CSS
`background-image` in `HeroVideo.tsx:45`, so the preload scanner never discovers it, and there is no
`<link rel="preload">` anywhere. On desktop the ~1MB hero video competes for bandwidth; mobile skips
the video and is 2.4× faster.

**Fix:** preload the poster, or render it as an `<img>` with `fetchpriority="high"`.

Caveat: lab data, single machine, single connection, unthrottled. Confirm against CrUX before investing
further — the 1255ms TTFB in particular may be geography rather than a real regression.

---

## JavaScript Rendering — 40 (fail)

The foundation is right: **all 57 routes are prerendered**, so crawlers get complete HTML without
executing JavaScript. That is the hard part of SPA SEO and it is solved.

The score is low purely because of the canonical conflict, which is a raw-HTML-versus-JS divergence —
exactly what Google's December 2025 guidance singles out. Against that guidance:

| Guidance | Status |
|---|---|
| Canonical identical in raw HTML and JS output | **FAIL** — homepage vs per-page |
| Robots directives correct in initial HTML | PASS |
| Structured data in server-rendered HTML | PASS — JSON-LD is in the prerendered output |
| Non-200 pages not JS-rendered | Exposed by the soft-404 (200 on unknown URLs) |

Fix the canonical and this category goes straight to roughly 90.

---

## Structured Data — 90 (pass)

JSON-LD on every page: `Organization`, `SoftwareApplication`, `FAQPage` on `/faq`, publisher wired via
`@id`. Present in the prerendered HTML, so no delayed-processing risk. Opportunity: `TechArticle`/`HowTo`
on the 49 tool guides and `BreadcrumbList` across the docs tree.

---

## IndexNow — 0 (fail, optional)

No key file at `/indexnow.txt` (404) and no evidence of the protocol. IndexNow pushes instant
change notifications to Bing, Yandex and Naver — not Google. For a site that prerenders 57 pages on
every deploy, it is cheap to add and speeds up non-Google indexing. Low priority.

---

## Agent-Friendly / Agentic Browsing (opportunity, not a defect)

Measured on the accessibility surface rather than Lighthouse's Agentic Browsing category, which needs
the uninstalled CLI. The site scores well:

- **Zero `<div onclick>` widgets** — 10 real `<button>` elements and 31 real `<a href>`
- **Zero inputs without an accessible label**
- **All four landmarks present**: `main`, `nav`, `header`, `footer`
- Exactly **one H1 in the rendered DOM** (the duplicate exists only in raw HTML, inside `<noscript>`)
- `llms.txt` present and rich, which is one of the Lighthouse agentic-browsing buckets
- CLS of 0 — another bucket

The main agent-UX gap is the same 22 undersized touch targets, which affect agent click accuracy as
well as human thumbs. No WebMCP support, which is an opportunity rather than a defect.

---

## Priority

**Critical (today)**
1. Delete the hardcoded canonical, `index.html:14`. Up to 56 pages may currently be canonicalised away.
2. Delete the hardcoded description, `index.html:11`. Same mechanism.

**High (this week)**
3. Return real 404 status for unknown URLs (`vercel.json`).
4. Preload the hero poster — desktop LCP 3056ms.

**Medium (this month)**
5. Security headers in `vercel.json`, plus `includeSubDomains; preload` on HSTS.
6. Raise the 22 undersized touch targets to 48×48 via padding.
7. Normalise trailing slashes to a single form.
8. Remove the redundant `<noscript>` block (duplicate H1 in raw HTML).

**Low (backlog)**
9. IndexNow key file.
10. `TechArticle`/`BreadcrumbList` schema for the documentation.
11. Connect CrUX/Search Console to replace lab data with field data.
