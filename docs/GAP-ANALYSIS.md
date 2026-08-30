# MarketBrain OS — Gap Analysis (PRD vs. Current Code)

> Snapshot of what's built against [PRD.md](./PRD.md), as of this review. **No code has been changed** —
> this is a reference document. Status legend:
> **✅ Built** · **🟡 Partial** · **⛔ Missing** · **❗ Contradicts PRD**
>
> Evidence paths are relative to `MarketBrainOS/`. See [ROADMAP.md](./ROADMAP.md) for how the gaps get
> closed and in what order.

## Stack reality (context for everything below)

- **Frontend:** React 18 + Vite, Tailwind via CDN, `react-router-dom` HashRouter ([App.tsx](../App.tsx)).
- **Backend (live):** Firebase Auth + Firestore — [services/firebase.ts](../services/firebase.ts),
  [services/persistenceService.ts](../services/persistenceService.ts),
  [context/AuthContext.tsx](../context/AuthContext.tsx), Firebase Functions
  [functions/src/index.ts](../functions/src/index.ts).
- **Serverless API:** [api/](../api/) holds Firebase-admin + Gemini endpoints (`execute-analysis.ts`,
  `users.js`, `utils.ts`) — no Supabase. The earlier staged Supabase migration (test scripts,
  `MIGRATION_GUIDE.md`, dep, and vite env type decls) was **removed in Phase 0**; Firebase is the sole backend.

---

## Section-by-section status

| PRD § | System | Status | Evidence / Notes |
|------|--------|--------|------------------|
| §1–2 | Product overview, customer journey | ✅ (concept) | Reflected in product; nothing to "build". |
| §3 | Public website | ✅ (mostly) | Shared public chrome (`PublicNav`/`PublicFooter`/`PublicLayout`) + standalone **Features, Pricing, About, FAQ** pages ([pages/Features.tsx](../pages/Features.tsx), [Pricing.tsx](../pages/Pricing.tsx), [About.tsx](../pages/About.tsx), [FAQ.tsx](../pages/FAQ.tsx)), routed in [App.tsx](../App.tsx). Homepage refreshed (full-suite framing, fixed Angle-Miner taxonomy copy) with **Testimonials** (illustrative samples) + **FAQ** sections. Features pulls all 13 tools from `NAV_SUITES` (no drift); shared FAQ/testimonial data in [config/marketingContent.ts](../config/marketingContent.ts). **⛔ Deferred:** Contact, Terms, Privacy pages. |
| §4 | Authentication | ✅ (client) | [pages/Auth.tsx](../pages/Auth.tsx): email signup/login, password reset, email-verify view, Google popup. Google `handleGoogleAuth` now surfaces specific provider errors (popup-closed/blocked, account-exists, network, unauthorized-domain). **Manual, deploy-time:** enable Google provider + authorized domains + OAuth consent in Firebase console; verify on the deployed domain (can't be done from the build env). |
| §5 | Onboarding | ✅ | Dismissible 5-step overlay ([components/OnboardingOverlay.tsx](../components/OnboardingOverlay.tsx)) shown on first login until finished/skipped, gated by `profile.onboarded` ([App.tsx](../App.tsx); `setOnboarded`/`replayOnboarding` in [services/persistenceService.ts](../services/persistenceService.ts)); "Replay Tour" on the dashboard. Final step routes to Strategy Lab. |
| §6, §33–37 | Dashboard + widgets | 🟡 | [pages/Dashboard.tsx](../pages/Dashboard.tsx): token balance, tier, **subscription panel**, top-up, suite module grid, history/receipts modals, **notification bell** (header, global). **Partial/⛔:** dedicated Recent-Analysis widget + Quick-Actions panel as specified. |
| §7, §26–29 | Token economy | 🟡 | Per-tool costs (3/4/5/6) kept deliberately — revisit later. **Settled 2026-08-31:** Pro = **100 tokens/mo**; all user-facing copy now interpolates from `DEFAULT_PRICING_CONFIG` rather than hardcoding (it had drifted to an advertised 200 while the config granted 100). Top-up $5=100 ✅. **⛔ Open:** free allowance is specified as **one-time, no replenishment**, but the config models it as `free.monthlyTokens: 20` and the monthly refresh job does not exclude free accounts — behaviour change still to be scoped. Free amount (PRD said 5, config says 20) unsettled. |
| §8, §30–32 | Subscription & billing | ✅ (simulated) | Full lifecycle: `subscription_status` (free/active/past_due/cancelled/expired) + `plan_renews_at` on the profile; server-authoritative `changeSubscription` callable ([functions/src/index.ts](../functions/src/index.ts)) handles upgrade/cancel/renew/downgrade, grants the configured Pro monthly allowance (100), writes `payments` + action log. In-app [components/SubscriptionPanel.tsx](../components/SubscriptionPanel.tsx) (status badge, renewal date, manage actions) replaces all external "Upgrade" redirects; billing history via existing `PaymentHistoryModal`. **Real Stripe + Past Due/Expired automation = future deploy-time work** (the verification seam is marked in the callable). |
| §9 | Feature directory | ✅ (in-app) | Both the sidebar ([App.tsx](../App.tsx)) and the **dashboard module grid** ([pages/Dashboard.tsx](../pages/Dashboard.tsx)) now render every tool grouped into the four V1 suites + Extras from one `NAV_SUITES` registry ([config/toolConfigs.ts](../config/toolConfigs.ts)), each card showing its token cost. Still **⛔** only a standalone public Feature *page* (marketing site, Phase 3). |
| §10, §22, §54 | Core analysis engine + job states | ✅ | **Transport unified.** `executeAsyncJob` ([services/geminiService.ts](../services/geminiService.ts)) now issues one authenticated POST to the real Firebase `executeAnalysis` HTTP function ([functions/src/index.ts](../functions/src/index.ts)) via `functionsBaseUrl` ([services/firebase.ts](../services/firebase.ts)) — which owns auth, admin/maintenance gating, rate-limiting, token deduct+auto-refund billing, Gemini execution, and audit logging. Dead `/api/analysis/*` poller removed. Server errors surface verbatim so the UI classifiers (rate-limit/maintenance/network) still work. All 13 modules (4 original + 9 new) share this path. |
| §11 | Angle Miner | ✅ | [pages/AngleMinerX.tsx](../pages/AngleMinerX.tsx) now uses the V1 8-angle taxonomy (Emotional · Fear · Aspiration · Curiosity · Authority · Differentiation · Story · Contrarian) — flat `angles[]` with `type` ([types.ts](../types.ts) `ANGLE_TYPES`), tabbed by type; inputs include Product Name + Market. Inline "Refine Angle" + platform hooks preserved. Both backends + `formatAngleMinerExport` updated; Workflow pipeline coupling fixed. |
| §12 | Conversion Doctor | 🟡 | [pages/ConversionDoctor.tsx](../pages/ConversionDoctor.tsx). Has score + issues/fixes; align to PRD result sections (Impact Ranking, Optimization Roadmap). |
| §13 | Workflow Analyzer | ✅ | Standalone **Workflow Analyzer** now exists (generic engine, Operations Intelligence suite, module `Workflow_Analyze`; inputs Workflow Description/Process Steps/Team/Objectives; outputs Bottlenecks · Inefficiencies · Redundancies · Automation Opportunities). The legacy multi-tool chain is kept as **"Workflow Pipeline"** under Extras (prior ruling). |
| §14–21 | Strategy Lab, Offer, Audience, Market, Competitor, Messaging, Content, Campaign | ✅ (built) | Implemented via config-driven [components/ToolPage.tsx](../components/ToolPage.tsx) + [config/toolConfigs.ts](../config/toolConfigs.ts); routed/nav in [App.tsx](../App.tsx); service `runToolAnalysis` ([services/geminiService.ts](../services/geminiService.ts)); server prompts + costs in [functions/src/index.ts](../functions/src/index.ts) (`executeAnalysis`). Execution path is now unified (see §10/§54 row). |
| §22 (tool) | Growth Analyzer | ✅ (built) | Same generic pipeline as §14–21. |
| §23 | Universal result framework | ✅ (generic) | The 9 generic tools emit the canonical Executive Summary + 8 sections (enforced in both backends, rendered by [components/ToolPage.tsx](../components/ToolPage.tsx)), now with unified per-result actions **Save (auto) · Export · Share · Rerun · Delete** (`deleteGenericAnalysis` + `savedId`). Bespoke tools keep specialized shapes. |
| §24 | Scoring system | ✅ | 0–100 banding (Critical→Excellent) centralized in [services/scoreBands.ts](../services/scoreBands.ts) and shown on scored generic results ([components/ToolPage.tsx](../components/ToolPage.tsx)), Conversion Doctor, and History. |
| §25, §40 | Analysis history | ✅ (generic) | Dedicated [pages/History.tsx](../pages/History.tsx) at `/history`: lists all saved generic analyses (`getUserToolAnalyses`), search + per-tool filter, expand/view, reopen tool, delete. Bespoke-tool artifacts not yet surfaced here. Token/receipt modals remain on the dashboard. |
| §28, §41–50 | Admin suite | ✅ (mostly) | [pages/AdminDashboard.tsx](../pages/AdminDashboard.tsx): user mgmt, token mgmt, platform stats, hash-chained audit ledger, system lockdown, diagnostics ([services/diagnosisService.ts](../services/diagnosisService.ts)), **System Monitoring tab** (§68 — status counts, top error codes, recent issues from `action_logs` via `computeSystemMetrics`). **Module Availability covers all 13 tools.** **Reporting exports (§50):** ✅ structured **CSV** + headed **print-PDF** on every result (ToolPage + History) and billing history (`PaymentHistoryModal`) — helpers in [services/exportService.ts](../services/exportService.ts). **⛔ remaining:** Support ticket system (§48), `.xlsx`/styled-PDF (deferred — CSV+print chosen), revenue reporting depth (§46). |
| §38 | User profile | 🟡 | Profile basics via auth; **⛔** business info (company/industry/type), login-activity view, explicit session management UI. |
| §39, §61 | Notifications | ✅ (in-app) | In-app notification center ([components/NotificationCenter.tsx](../components/NotificationCenter.tsx)) — header bell + unread badge + dropdown, 5 categories (Analysis/Subscription/Token/Payment/System), read/mark-all-read; CRUD on a `notifications` collection ([services/persistenceService.ts](../services/persistenceService.ts)). Emits on analysis completion, top-up, and subscription changes. **⛔ Email channel** (live send) is deploy-time — seam marked (`// EMAIL SEAM` at `createNotification`) + enablement steps in [docs/OPERATIONS.md](./OPERATIONS.md). |
| §31–32 | Payments & billing history | ✅ (simulated) | Top-up + subscription payment records ([types.ts](../types.ts) `PaymentRecord`, `getUserPaymentHistory`); subscription changes write `payments` rows (type `subscription`) viewable via `PaymentHistoryModal`. **⛔** formal invoice/receipt PDFs (Phase 5 reporting). |
| §51–53 | AI infra / prompt / response processing | ✅ | Gemini integration + system instruction + JSON cleaning + contracts ([functions/src/index.ts](../functions/src/index.ts), [services/geminiService.ts](../services/geminiService.ts) `SystemContracts`). |
| §55–62 | Database architecture | ✅ | Firebase only. Supabase schema + migration files deleted (Phase 0 decision: Firebase is the backend). |
| §63–68 | Automation engine | 🟡 | Top-up + analysis-completion handled server-side. **§64 monthly token refresh:** 🟡 `monthlyTokenRefresh` scheduled Pub/Sub function in [functions/src/index.ts](../functions/src/index.ts) runs **daily** (`0 0 * * *` UTC) and processes any account whose `plan_renews_at` has passed, resetting the monthly balance to that tier's configured `monthlyTokens` (Pro = 100), bumping renewal, emitting log + notification (**deploy-time:** activates on `firebase deploy`, Blaze plan). **⛔ Conflicts with §27:** it currently renews **free** accounts too (only `expired` is excluded), so the free allowance replenishes despite being specified as one-time. Fix = skip free-tier accounts in this job. **§68 monitoring:** ✅ admin System Monitoring tab (see §41–50 row). **⛔ §67 email automation:** seam documented (`// EMAIL SEAM` at `createNotification`; runbook in [docs/OPERATIONS.md](./OPERATIONS.md)) — needs a provider, deferred. |
| §69–75 | Security framework | ✅ (strong) | [services/securityEngine.ts](../services/securityEngine.ts): rate limiting, bot/anomaly detection, hash-chained audit logs, step-up admin auth. Exceeds typical MVP. |
| §76 | Backup & recovery | 🟡 (documented) | DR runbook in [docs/OPERATIONS.md](./OPERATIONS.md): scheduled Firestore→GCS exports, retention, restore steps, RPO/RTO targets, and a `scheduledFirestoreExport` pattern. **Deploy-time/ops:** enabling the scheduled export + bucket lifecycle is an operator task (not code). |
| §77–78 | Scaling & performance | ✅ (mostly) | Serverless job queue is horizontally scalable. **Bundle code-split (§78):** routes lazy-loaded via `React.lazy` ([App.tsx](../App.tsx)) + vendor `manualChunks` ([vite.config.ts](../vite.config.ts)) — the single ~1 MB chunk is now a ~114 kB main entry + cached `vendor-firebase/react/motion/ai` chunks + per-route chunks (no >500 kB warning). **⛔ remaining:** explicit caching layer / formal perf budget. |
| §79–90 | Phases 2–4, vision | ✅ (6.0–6.3 done) | **Phase 6 fully delivered as ONE platform.** Spine (6.0): tier ladder, ownership/visibility model with V1 back-compat, scope-context + switcher, centralized `can()`, unified scope-aware history/reports, server-enforced [firestore.rules](../firestore.rules). **§79–80 Team** (6.1), **§81–82 Agency** (6.2, strict per-client isolation), **§83–85 Enterprise** (6.3): read-only aggregation suite — health score, executive intelligence (opportunities/risks/recommendations), department/brand performance, AI executive **briefings** (`generateExecutiveBriefing`), forecasts, and the `runEnterpriseAggregation` engine; create→upgrade across the Free→Pro→Team→Agency→Enterprise ladder with no data loss ([pages/EnterpriseSuite.tsx](../pages/EnterpriseSuite.tsx), [components/enterprise/](../components/enterprise/), [functions/src/index.ts](../functions/src/index.ts)). **⛔ future:** white-label, marketplace (§86), AI-model expansion (§87), BI layer (§88). See [ROADMAP.md](./ROADMAP.md). |

---

## Rulings (Phase 0 — locked 2026-05-31)

All 4 Open Questions resolved. No further blockers before building.

| # | Question | Ruling |
|---|----------|--------|
| 1 | Token model | **Keep per-tool costs (3/4/5/6) as-is** — deliberate cost-control. Revisit later. |
| 2 | Backend | **Firebase only** — Supabase schema + migration files deleted. |
| 3 | Tool naming | **Keep TestLab Pro + pipeline Workflow as extras.** Build the 9 missing PRD tools. |
| 4 | Pro token amount | **100 tokens/mo** (settled 2026-08-31, supersedes an earlier 200). Set in `config/pricingConfig.ts` + the server `DEFAULT_PRICING_CONFIG`; all UI copy interpolates from the config rather than hardcoding it. |
| 5 | Free token model | **One-time allowance, no replenishment.** Spec'd in §27; **not yet implemented** (the daily refresh job still renews free accounts). Amount unsettled: PRD previously said 5, config says 20. |

---

## V1 Tool Architecture conformance (2026-06-01)

Audited the build against [TOOL-ARCHITECTURE-V1.md](./TOOL-ARCHITECTURE-V1.md). Closed this round:

- **Universal result contract** — all 9 generic tools emit Executive Summary + the 8 canonical sections,
  enforced server-side in both prompt builders and rendered by `ToolPage`.
- **Connected ecosystem (cross-tool wiring)** — each generic tool declares `worksWith` (module keys of
  related tools); `ToolPage` offers a picker of the user's prior saved analyses from those tools and
  injects the selected one as `_context` into the prompt (`getUserToolAnalyses` →
  [services/persistenceService.ts](../services/persistenceService.ts); `runToolAnalysis` 4th arg). Covers
  the generic-tool relationships (e.g. Audience/Market/Competitor → Strategy, Growth, Content, Campaign,
  Offer, Messaging). Bespoke tools (Angle Miner, Conversion Doctor) are not yet wired as context sources.
- **Sidebar suite grouping** — Marketing / Sales / Business Strategy / Operations Intelligence + Extras.

Deferred (not selected this round): realigning the bespoke tools (Angle Miner taxonomy, standalone
Workflow Analyzer), and unified Save/Share/Rerun/Delete result actions.

**Follow-up round (2026-06-01):** closed the two remaining "every tool connects to Dashboard + Admin
Monitoring" gaps — the dashboard now shows all 13 tools grouped by suite with cost badges, and admin
Module Availability toggles all 13 modules (server enforcement already wired via `MODULE_MAPPING`).

## Summary scorecard

- **Strong / done:** Analysis engine & unified transport, AI infrastructure, security framework, admin
  core (+ System Monitoring), database (Firebase), all 13 tools (universal results + cross-tool context +
  history + actions), suite grouping, onboarding, notifications, subscription lifecycle (simulated),
  **reporting exports (CSV + print-PDF), code-split bundle, monthly-refresh cron (deploy-time)**.
- **Half-there:** the bespoke tools' result-shape alignment, dashboard recent/quick-action widgets,
  backup/DR (documented runbook; operator-enabled).
- **Not started:** Real payment provider + live email (seam documented), support tickets (§48),
  Phase 6+ work.
- **Deploy-time (not code):** `firebase deploy --only functions` (incl. `monthlyTokenRefresh`); Google
  OAuth console verification; enable scheduled Firestore exports; wire an email provider.
