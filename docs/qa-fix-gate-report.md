# QA fix gate report

Finish-gate review of the seven QA fixes against `dist/` (sirv, single mode, real-visitor mode) and the header harness (stubbed signed-in free-tier user). Evidence PNGs and raw measurements (`findings*.json`, `run.log`) are in `C:\Users\HP\AppData\Local\Temp\gate\`. Contrast = computed text colour vs the pixel sampled from the screenshot.

## Checks

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| H1 | Home pricing widget: "20 tokens, one-time" / "100 tokens / mo", no "Analysis Credits" (prerender 1 / 1 / 0) | PASS | `home-375-pricing-widget.png`, `home-1280-pricing-widget.png` |
| H2 | No placeholder testimonials: no `blockquote`, "Sample Persona" or TESTIMONIALS section in the prerender | PASS | `findings2.json` (`placeholderHits: []`) |
| H3 | PublicNav (dist) and AppHeader (harness): zero overlaps, wraps, clips or overflow at 375/640/768/1024/1280 | PASS | `harness-375..1280.png`, `home-768-banner.png`, `features-768-menu.png` |
| M2 | Both hamburgers carry `aria-label`, `aria-expanded`, `aria-controls` (targets exist); visible focus ring; PublicNav target 48×48 | PASS | `harness-768-hamburger-focus.png`, `features-768-menu.png` |
| M4 | Banner absent from prerender, present on first visit, `fixed z-45`, clear of the header; Accept removes it with 0px height change; choice persisted | PASS (defects 1-3) | `home-375-banner.png`, `home-1280-banner.png` |
| M5 | Signed-in PublicNav shows one "Open app" pill, no Sign In / Start Free, at 768/1024/1280 | PASS | `harness-768.png`, `harness-1024.png` |
| L1 | `/auth` tab title "Sign in \| MarketBrain OS" at 375 and 1280 | PASS | `auth-375.png`, `auth-1280.png` |
| L2 | Prose says "MarketBrain OS" (12×); only the nav wordmark is unspaced. But AuthShell reads "MARKETBRAIN OS", both headers "MARKETBRAINOS" | PARTIAL (defect 5) | `auth-deleted-375-noconsent.png` vs `harness-1024.png` |
| — | `/pricing` cards at 375: five stacked cards, no overflow, badge and prices intact | PASS | `pricing-375-cards.png`, `pricing-768-cards.png` |
| — | Deleted notice: body 10.3:1, eyebrow 4.8:1, link 19.7:1 on gray-50 | PASS | `auth-deleted-375-noconsent.png` |
| — | Deleted-notice link target | FAIL (defect 4) | `pages/Auth.tsx:213` |
| — | "Pro" pill: `#FF0000` on sampled `#0A0A0A` = 4.95:1, 10px bold, 28px tall, no `animate-pulse` | PASS | `harness-768.png` |
| — | Banner contrast: title 18.7:1, body 7.4:1, Accept 17.2:1, Decline 18.7:1; eyebrow and "Privacy policy §11" link 3.88:1 | FAIL for the link (defect 3) | `home-1280-banner.png` |
| — | "14 tools" in prerendered `/`; zero console or page errors across all captures | PASS | `findings.json`, `run.log` |

Acceptable spec deviations, keep them: PublicNav hides its link row until `lg` instead of a `gap-5` row; AppHeader drops the wordmark below `sm`. Both measured to fit.

Coverage gap: the harness stubs memberships to `[]`, so `ScopeSwitcher` never renders; the 768 worst case (140px label) is unproven, though by arithmetic it fits (~636 of 720px).

## Visible defects

1. **Banner is 344px tall at 375×667, 52% of the viewport (spec estimated ~190px).** It slices the hero H1 mid-line on the first screen (`home-375-banner.png`). Stacked full-width buttons plus a four-line body under `p-6`; tighten padding or put the buttons side by side.
2. **Bottom-right card hides the primary action.** `/auth` at 1280×800: covers 81% of the "Sign in" submit (`auth-1280.png`). `/` at 768: hides "Read Documentation" and clips "Initialize Free Account" (`home-768-banner.png`). Anchor bottom-left on `/auth` (form is the right column) or use a single-row bar from `sm`.
3. **"Privacy policy §11" link and "Privacy" eyebrow: gray-500 on `#121212` = 3.88:1**, below AA for an interactive element. `text-gray-400` (7.4:1) clears it.
4. **Dead anchor.** `pages/Auth.tsx:213` links to `/privacy#retention`; the Privacy page only defines `#s6` (every other §6 reference uses it). The link lands at the top of the policy.
5. **Brand mark spelled three ways in chrome** (L2 residual): AuthShell "MARKETBRAIN OS" / 36px `rounded-2xl`; AppHeader "MARKETBRAINOS" / 36px `rounded-[10px]`; PublicNav "MARKETBRAINOS" / 32px `rounded-lg`. Landing to sign-in is one click and the mark changes.
6. Minor, optional: Decline is 43px beside a 40px Accept; `/pricing` CTAs are `rounded-xl` against the system's `rounded-2xl`; the open mobile menu repeats "Start Free" at 768-1023.

## Verdict

**NOT READY.** All seven QA findings are closed on pixel evidence, but the consent banner ships with three visible defects (1-3) and the deletion notice has a dead link (4). Each is a one-line fix; re-run this gate on `/auth` at 1280×800 and `/` at 375 afterwards.

## Re-run (same day, after the fixes)

Measured against the rebuilt `dist/` (sirv, `app.html` fallback), fresh profile so the banner shows. Script: the lead's `gate_rerun.mjs` (same measurements as above, automated).

| Defect | Fix | Evidence |
|---|---|---|
| 1. 344px sheet at 375 | Slim full-width bar; body reserves its height while open | **132px (20% of viewport)** at 375×667; hero H1 bottom 516 < bar top 535. 80px at 768, 65px at 1280 |
| 2. Card hid the primary action | Bar spans the bottom edge; `AuthShell` shrinks by `--mbos-consent-h` so its bottom-anchored links stay above it | `/auth` 1280×800: "Sign in" bottom 565 < bar top 735; no in-viewport control under the bar on `/` (375, 768, 1280) or `/auth` (1280) |
| 3. Link contrast 3.88:1 | `text-gray-300` | **12.71:1** on `#121212` |
| 4. Dead `#retention` anchor | `/privacy#s6` | `#s6` present on the rendered policy |
| 5. Three brand marks | AuthShell → "MarketBrainOS", 36px `rounded-[10px]`; PublicNav tile 36px `rounded-[10px]` | Wordmark reads "MarketBrainOS" on `/` and `/auth` |
| 6. Accept 40 / Decline 43 | Both `h-10` | 40px / 40px at every width |

Verdict: **READY.** The seven QA findings stay closed (build, `test:copy`, `test:browser`, prerender guard and `test:csp` all pass on the same build), and the four blocking defects above are fixed with measurements.
