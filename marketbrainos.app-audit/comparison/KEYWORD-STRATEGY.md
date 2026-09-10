# Comparison Page Strategy — keywords, gaps, next pages

**Date:** 2026-09-10
**Current state:** zero comparison or alternatives pages exist. The only near-match in the sitemap is
`/documentation/billing/plans-compared`, which compares your own tiers, not competitors.

No search-volume data is included below. That needs DataForSEO or Search Console, neither of which is
connected, and inventing volume figures would be worse than omitting them. The patterns are ranked by
intent quality and how well they match what you can honestly claim.

---

## Page 1 (build first): MarketBrain OS vs ChatGPT

**Primary:** `marketbrain os vs chatgpt`

Brand-plus-competitor terms are low volume while the brand is young, so the real value is the
**objection**, not the brand pairing. Target the question buyers actually type:

**Secondary / long-tail — the objection cluster:**

- `can chatgpt audit a landing page`
- `chatgpt for marketing analysis`
- `chatgpt vs marketing analysis tool`
- `is chatgpt good for conversion optimization`
- `why use a marketing tool instead of chatgpt`
- `structured marketing analysis vs chatgpt`

This cluster is where a small brand can genuinely rank, because the answer requires a specific,
demonstrable capability difference rather than domain authority.

**Title tag:** `MarketBrain OS vs ChatGPT: Structured Analysis vs Open-Ended Chat (2026)` — 71
characters, trim to ~60 if you want the whole thing visible.

**H1:** `MarketBrain OS vs ChatGPT: Structured Marketing Analysis vs Open-Ended Chat` (66 chars).

---

## The content gap worth exploiting

The generic "AI marketing tool vs ChatGPT" pages that rank today are mostly written by content teams
with no product to demonstrate, so they argue in generalities. You can do the thing they cannot: show a
real, structured output — the same 0–100 score, the same `{insight, evidence, action}` fields, twice —
next to a screenshot of prose. That is a genuine differentiator and it is native to your product.

You already have the dev-fixture screenshots used on the landing page. Reuse that mechanism to capture
a real Conversion Doctor result for this page rather than describing one.

---

## Next pages, in priority order

**2. `/compare` hub.** A parent page listing every comparison. Needed as a breadcrumb target before the
set grows, and it ranks for `marketbrain os comparison`.

**3. "Best AI marketing analysis tools 2026" roundup.** Broader head terms than any head-to-head, and
lower risk than naming a single rival. Requires disclosed affiliation and honest treatment of the
others. `ItemList` schema.

**4. Head-to-head against a category tool** — a CRO or landing-page-analysis product rather than a
writing tool. Your positioning line ("Unlike generative writing tools that simply produce text") tells
me writing tools are the wrong frame: you would be arguing you are better at something you do not do.

**Explicitly not recommended right now:** "Jasper alternatives" or "Copy.ai alternatives" pages. Those
searchers want copy generation. You do not generate marketing copy as a primary function, so the traffic
would bounce and the page would train Google that your site is a poor result for that intent.

---

## Rules to hold to across all comparison pages

These come from the skill's fairness guidelines, and the ChatGPT page already tests them:

1. **Never print an unverified competitor price.** OpenAI's figures did not render to us on 2026-09-10;
   the correct cell is "Not publicly available" with a link, not a remembered number. My own training
   data does not even contain their current plan lineup — the "Go" plan is new to me — which is a
   concrete demonstration of why remembered figures are unsafe.
2. **Date-stamp every competitor claim** and re-verify quarterly.
3. **Concede real strengths.** The ChatGPT page has a whole section on where ChatGPT is the better tool.
   Without it the page is marketing; with it, it is useful.
4. **Disclose affiliation above the fold.**
5. **No invented ratings.** No `aggregateRating` in schema until real reviews exist — fabricating one
   is a structured-data policy violation.
6. **Link to sources** for every competitor data point.

---

## Blocking prerequisite

Fix the duplicate canonical at `index.html:14` before publishing any of these. Every page currently
ships a homepage canonical ahead of its own, so a new comparison page may be canonicalised away as a
duplicate of the homepage and never rank on its own URL. Building comparison pages on top of that is
pouring water into a leaking bucket.
