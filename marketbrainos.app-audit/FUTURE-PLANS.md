# Future plans — needs you or a third party

Everything codeable from today's three SEO passes has been implemented. What remains cannot be done
from the codebase alone. Ordered by consequence.

## 1. Revoke the exposed Google API key — do this first

A live Google API key ending `…XENzOw` was committed in `test-gemini-credentials.cjs` on **2026-02-13**
and the repository is **public**. The file has been deleted, but deletion is not remediation: the key
remains in git history, in every clone and fork, and in whatever scraped it during the seven months it
was exposed.

**Action:** revoke it in the Google Cloud console. Nothing else on this list matters as much.

Production already uses a different key (`functions/.env` holds an `AQ.`-format credential), so
revoking the old one will not break the app.

## 2. Restore the 20 tokens

Lost to the 60-second Cloud Function timeout, which debited tokens and was then killed before the
refund could run. Both halves are fixed and deployed, but the tokens already spent were never returned.

**Action:** credit them from the admin console's token management.

## 3. Connect Search Console and the CrUX API

**Every performance figure in these audits is lab data** from a single machine on a single connection.
That is enough to find structural problems — a CSS-background LCP element, a missing preload — but not
to know what your users actually experience.

Connecting these gives:

- **Real Core Web Vitals** at the 75th percentile, which is what Google actually ranks on. It would
  settle whether the 1255ms TTFB is a real problem or just distance from the edge.
- **Indexation status per URL.** This is the important one right now. Every page shipped a canonical
  pointing at the homepage until today's fix. Search Console is the only way to see whether Google
  acted on it and dropped pages from the index, and to watch them recover.

Both are free. This is the highest-value item after the key revocation.

## 4. Verify the fixes landed, ~1 week after deploy

The code is correct and verified locally, but only production tells you whether Google agreed:

- `site:marketbrainos.app` should show pages beyond the homepage
- Search Console → Pages: "Duplicate, Google chose a different canonical" should be falling
- Search Console → Core Web Vitals: desktop LCP should improve now that the hero poster is a real
  `<img>` with `fetchpriority="high"` (the mechanism is fixed; the timing gain is unmeasured because a
  local static server is not comparable to a CDN)
- Confirm an unknown URL returns 404 and every real route still returns 200

## 5. The comparison page

Spec, JSON-LD and keyword strategy are already written in `marketbrainos.app-audit/comparison/`.
Deferred deliberately, because it needs three things I cannot supply:

- **Your brand voice** for ~1,700 words of marketing copy published in your name
- **Your real data-training policy** — one FAQ answer is a marked placeholder and must not ship as-is
- **Verified ChatGPT pricing.** Their page renders no price figures to a datacenter client, and my
  training data does not contain their current plan lineup (there is now a "Go" plan I had never seen).
  Every price cell is marked "not publicly available" rather than guessed. A human with a browser can
  fill these in, dated.

## 6. Paid data, only if you want it

Four of the installed SEO skills are limited without credentials:

- **DataForSEO** — real SERP positions, backlink profiles, competitor intelligence. Unlocks
  `seo-dataforseo`, and the richer tiers of `seo-maps`, `seo-backlinks` and `seo-ecommerce`.
- **Moz or Bing Webmaster** (free tiers exist) — domain authority and backlink data for `seo-backlinks`.

Not required for anything above. Only worth it if you plan sustained competitive analysis.

## 7. Off-site — no code involved

- **Real reviews** before adding any `aggregateRating` schema. Inventing one violates Google's
  structured-data policy and risks a manual action. The schema file deliberately omits it.
- **G2 / Capterra listings**, link building, PR, and a blog cadence. These are the slow authority
  levers and none of them are engineering work.

---

## Already done, for reference

Implemented and verified today: removed the duplicate canonical and description that shipped on all 57
pages, removed the redundant `noscript` block, shortened the homepage title, made the LCP image a real
`<img>`, added security headers and trailing-slash normalisation, replaced the catch-all rewrite with a
route allowlist plus a build-time guard test, emitted a real `404.html`, cut undersized touch targets
from 22 to 5, added IndexNow, and added `CollectionPage` schema to the docs category pages.
