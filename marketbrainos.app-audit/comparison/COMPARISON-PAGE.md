# Comparison Page Spec — MarketBrain OS vs ChatGPT

**Target URL:** `/compare/chatgpt` (or `/marketbrainos-vs-chatgpt`)
**Primary keyword:** `marketbrain os vs chatgpt` / the broader objection `can chatgpt do marketing analysis`
**Data verified:** 2026-09-10
**Word count target:** 1,600–1,900

---

## Data verification status — read before publishing

Everything in this spec is either verified live today or explicitly marked unverified. Nothing about
ChatGPT is written from memory.

**Verified from `chatgpt.com/pricing` on 2026-09-10** (rendered in a real browser):

- Plan lineup is **Free, Go, Plus, Pro**
- Models referenced on that page: **GPT-5.6 Luna** and **GPT-6 Astra**
- Per-plan capability claims, quoted below verbatim from that page
- The Go plan carries the note "This plan may include ads"

**NOT verified — do not fill in from memory:**

- **ChatGPT's prices.** The page renders plan names and "/ month" but **no figures at all** to a
  datacenter client; the amounts are gated. Every price cell for ChatGPT must read
  *"Not publicly available — see chatgpt.com/pricing"* and link out. Do not substitute a remembered
  number. The lineup itself has changed recently enough that a stale figure is very likely wrong.

**Verified from your own source** (`config/pricingConfig.ts`, authoritative):

| Plan | Price/mo | Included tokens/mo |
|---|---|---|
| Free | $0 | 20 |
| Pro | $7 | 100 |
| Team | $49 | 400 |
| Agency | $199 | 2,000 |
| Enterprise | $999 | 10,000 |

Token packs: 100/$5, 500/$20, 1,500/$50, 5,000/$150, 10,000/$250.

**Re-verify quarterly**, and immediately if OpenAI changes its plan lineup.

---

## Why this comparison, and the honest framing

This page should not argue that MarketBrain OS is a better ChatGPT. It isn't, and readers will know it.
ChatGPT is a general reasoning system; MarketBrain OS is a narrow instrument. The page wins by
reframing the question from *which is smarter* to *which gives you a decision you can act on twice.*

Your own positioning already says this: "Unlike generative writing tools that simply produce text,
MarketBrain OS is built to audit, score, and refine." The page is that sentence, evidenced.

**Acknowledge plainly, in the page itself:** for open-ended thinking, drafting, and one-off questions,
ChatGPT is excellent and cheaper than adding another subscription. Say so. A comparison page that
concedes nothing converts worse and ages badly.

---

## Page structure

### 1. Hero (above fold)

- **H1:** `MarketBrain OS vs ChatGPT: Structured Marketing Analysis vs Open-Ended Chat`
  (66 characters, inside the 70 limit)
- One-sentence verdict: ChatGPT answers a question; MarketBrain OS returns the same scored, structured
  analysis every time, saved and comparable.
- Primary CTA: **Start free** (20 tokens, no card) — links to `/auth`
- Affiliation disclosure in plain sight: *"MarketBrain OS is our product. Everything we say about
  ChatGPT is sourced and dated below."*

### 2. The short answer (~150 words)

For readers who bounce. Three bullets:

- **Use ChatGPT when** you want to think out loud, draft copy, or ask something once.
- **Use MarketBrain OS when** you need the same analysis run repeatedly, scored the same way, saved,
  and shared with a team.
- **Most teams use both.** Say this. It is true and it defuses the false-choice objection.

### 3. Feature matrix

Cells for MarketBrain OS are verifiable from your product. Cells for ChatGPT are either quoted from
their pricing page or marked unverified. Never guess a cell.

| | MarketBrain OS | ChatGPT |
|---|:---:|:---:|
| Fixed output schema per analysis | ✅ 13 tools, defined result shape | ❌ Free-form prose |
| Numeric 0–100 scoring with bands | ✅ | ❌ |
| Same input → comparable output | ✅ Structured, versioned | ⚠️ Varies between runs |
| Saved analysis history | ✅ Searchable, re-openable | ⚠️ Chat history, not structured records |
| Export to CSV / PDF | ✅ | ⚠️ Copy or manual export |
| Team-scoped shared library | ✅ Workspace / agency / enterprise | ⚠️ Projects and custom GPTs on paid plans¹ |
| Per-run cost known in advance | ✅ Token cost shown on the button | ❌ Message limits, not per-task cost |
| Pooled team budget with per-member caps | ✅ | ❌ |
| General reasoning and open conversation | ❌ Not what it does | ✅ Its core strength |
| Drafting long-form copy | ❌ | ✅ |
| Deep research across the web | ❌ | ✅ Per their plan pages¹ |
| Image generation, voice, code | ❌ | ✅¹ |
| **Entry price** | **$0, then $7/mo** | **Not publicly available²** |

¹ Quoted from chatgpt.com/pricing, retrieved 2026-09-10. Capabilities vary by plan (Free, Go, Plus, Pro).
² OpenAI's pricing page did not render figures to us on 2026-09-10. See chatgpt.com/pricing for current
pricing.

### 4. Where ChatGPT is the better tool (~200 words)

A real section, not a strawman. Cover: open-ended exploration, drafting, breadth across every domain,
deep research, and the fact that if someone already pays for it, adding a tool needs justifying.

This section is what makes the rest credible.

### 5. Where a purpose-built instrument wins (~350 words)

Three concrete arguments, each tied to something your product actually does:

**Repeatability.** Ask ChatGPT to audit a landing page twice and you get two differently-shaped answers.
Conversion Doctor returns the same fields every time — score, blockers with severity, prescriptions with
priority — so this month's audit is comparable to last month's.

**Evidence structure.** Results come back as `{insight, evidence, action}`, not paragraphs. A team can
act on a list of prioritised actions; it cannot act on an essay.

**Institutional memory.** Analyses persist per workspace with visibility scoping, so an agency running
the same audit across twelve clients builds a comparable record. Chat history is not that.

**Predictable cost.** The run button states its token cost before you click. Message caps do not tell
you what a specific task will cost.

### 6. Cost comparison (~200 words)

Lead with the honest framing: this is not a like-for-like price comparison and should not pretend to be.
State your own numbers precisely ($0 free with 20 tokens; $7 Pro with 100). For ChatGPT, state that
pricing is on their page and link out, rather than printing a number you have not verified.

Compare **cost per completed analysis**, which you can state truthfully, against "a general subscription
plus your own time structuring the output" — without inventing their figure.

### 7. Migration / "how teams actually combine them" (~200 words)

Realistic workflow: explore in ChatGPT, validate in MarketBrain OS, act on the scored output. This is
more persuasive than an either/or and matches how buyers behave.

### 8. FAQ (~250 words, 5 questions)

Marked up as `FAQPage` — you already ship FAQ schema on `/faq`, so reuse the pattern:

1. Can't I just ask ChatGPT to audit my landing page?
2. Do I need both?
3. What exactly does a token buy?
4. How is scoring calculated?
5. Is my data used to train models?

### 9. Closing CTA

Final recommendation, restated verdict, **Start free** CTA. No aggressive CTAs inside the ChatGPT
sections — it reads as bait and depresses trust.

---

## Conversion notes

- CTA placement: hero, immediately after the matrix, and at the close. Three, not more.
- Trust signals: "Last verified 2026-09-10" timestamp, methodology note ("we rendered their public
  pricing page; figures we could not verify are marked"), and the affiliation disclosure up top.
- Do not add fabricated testimonials or a G2 rating you do not have. Leave the social-proof slot empty
  until there is something real to put in it.

## Internal linking

- Out to `/features` (the 13 tools), `/pricing`, and the relevant `/documentation/tools/*` guides
- Breadcrumb: Home → Compare → MarketBrain OS vs ChatGPT
- From `/features` and `/pricing`, link in to this page
- Related-comparisons block at the bottom, ready for the next page in the set

## Technical requirements

Follow the existing `Seo` component pattern (`components/Seo.tsx`) so the page gets its own title,
description, canonical and JSON-LD, and add the route to `config/seo.ts` and the prerender list so it
ships as static HTML.

**Blocking prerequisite:** fix the duplicate canonical at `index.html:14` first. Publishing a new page
while every page canonicalises to the homepage means this one may never be indexed on its own URL.
