# Action Plan — marketbrainos.app

Ordered by impact per unit of effort. The first three are one-line changes that unblock work already
written and paid for.

## Phase 1 — Quick wins (under an hour, all of them)

**1. Delete the hardcoded meta description.** `index.html:11`
Highest value on the list. Per-page descriptions already exist in `config/seo.ts` and are already
emitted by react-helmet; the stale hardcoded tag sits in front of them on all 57 pages and is the one
search engines take. Deleting one line makes the existing copy live.
*Effort: 1 line. Impact: High.*

**2. Preload the hero poster.** `index.html` (or `components/media/HeroVideo.tsx:45`)
The LCP element is a CSS background image, invisible to the preload scanner. Add
`<link rel="preload" as="image" href="/assets/hero-poster-*.webp">`, or render it as an `<img>` with
`fetchpriority="high"`. Targets desktop LCP of 3.06s against a 2.5s threshold.
*Effort: 1–2 lines. Impact: High.*

**3. Shorten the homepage title.** `config/seo.ts:23`
81 characters truncates in SERPs. `MarketBrain OS | AI Marketing Intelligence Platform` is 51.
*Effort: 1 line. Impact: Low but free.*

## Phase 2 — Structural (week 1)

**4. Return a real 404 for unknown URLs.**
Every unmatched path currently returns HTTP 200 with the app shell, so typos and crawler-invented URLs
become indexable soft-404s. Fix in `vercel.json` — and note this must be Vercel, not `firebase.json`,
because the live domain is served by Vercel.
*Effort: Small. Impact: High.*

**5. Remove the `<noscript>` fallback.** `index.html:96-…`
Redundant since prerendering shipped, and it stamps a duplicate H1 plus identical generic prose into
all 57 pages, `/privacy` and `/terms` included.
*Effort: Small. Impact: Medium.*

**6. Add security headers in `vercel.json`.**
`X-Content-Type-Options`, `X-Frame-Options` (or CSP `frame-ancestors`), `Referrer-Policy`,
`Permissions-Policy`, and `includeSubDomains; preload` on the existing HSTS. The rules in
`firebase.json` never reach the live domain.
*Effort: Small. Impact: Medium — and it closes a gap the earlier security review also flagged.*

## Phase 3 — Content and authority (month 2)

**7. Schema for the documentation.**
49 docs pages carry only sitewide schema. Add `TechArticle` or `HowTo` to the tool guides and
`BreadcrumbList` across the docs tree. Best remaining structured-data opportunity.
*Effort: Medium. Impact: Medium.*

**8. Keep `llms.txt` current.**
It is genuinely good. Its value decays if the product moves and it does not.
*Effort: Ongoing. Impact: Medium for AI search.*

## Phase 4 — Measurement (ongoing)

**9. Get real field data.**
Every performance number in this audit is lab data from one machine on one connection. Connect Search
Console and the CrUX API so decisions rest on what users actually experience. The 1.25s TTFB in
particular may be geography rather than a real problem — field data will say.

**10. Re-audit after Phase 1 and 2.**
Items 1, 2, 4 and 5 should move On-Page from 68 and Technical from 72. Re-run to confirm rather than
assume.

## Explicitly not recommended

- **Nothing for images.** All alt attributes present, dimensions set, lazy loading, responsive modern
  formats. CLS is 0.000. Leave it alone.
- **Nothing for AI search readiness** beyond keeping `llms.txt` fresh.
- **No prerendering work.** It already works across all 57 routes.
