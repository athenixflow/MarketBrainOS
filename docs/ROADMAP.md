# MarketBrain OS — Build Roadmap

> Sequenced plan to close the gaps in [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) against [PRD.md](./PRD.md).
> Phases are ordered by dependency: **Phase 0 gates everything.** Each phase lists the PRD sections it
> satisfies so progress stays traceable. This is a planning artifact — we execute one phase at a time,
> with your go-ahead, and plan each in detail when we reach it.

---

## Phase 0 — Reconcile contradictions ✅ COMPLETE (2026-05-31)

All 4 rulings implemented.

- **Token model:** per-tool costs (3/4/5/6) kept deliberately — revisit later.
- **Backend:** Firebase only. Removed: `scripts/test-supabase-*.cjs`, `MIGRATION_GUIDE.md`, the
  `@supabase/supabase-js` dependency (pruned from `package-lock.json` + `node_modules`), and the
  `SUPABASE_*` env type declarations in `vite.config.ts`. (No `supabase-schema.sql` / `api/analysis/`
  existed in the working tree — they were never committed here.)
- **Tool naming:** TestLab Pro + pipeline Workflow kept as product extras. 9 PRD tools queued.
- **Pro = 200 tokens/mo:** fixed in `functions/src/index.ts`, `pages/Dashboard.tsx`, `pages/LandingPage.tsx`.

**Satisfies:** §26–29 (Pro 200 ✅), §55–62 (single backend ✅).

## Phase 1 — Core loop integrity ✅ COMPLETE (2026-06-01)

Deferred backlog cleared in five sequenced tasks (build green after each):
1. **0–100 scoring bands** — [services/scoreBands.ts](../services/scoreBands.ts) on generic results +
   Conversion Doctor + History.
2. **Standalone Workflow Analyzer** — generic-engine tool (Operations Intelligence); legacy chain kept as
   "Workflow Pipeline" (Extras).
3. **Unified result actions** — Save (auto) · Export · Share · Rerun · Delete on generic tools
   (`savedId` + `deleteGenericAnalysis`).
4. **Analysis History page** — [pages/History.tsx](../pages/History.tsx) at `/history` (list/search/filter/
   view/reopen/delete).
5. **Angle Miner 8-angle taxonomy** — flat typed `angles[]`; both backends, export, and Workflow coupling
   updated; refine + hooks preserved.

Original Phase 1 intent (now satisfied):

- ✅ **Universal Result Framework (§23)** — done for the 9 generic tools (canonical Executive Summary + 8
  sections, enforced in both backends, rendered by `ToolPage`). **Remaining:** bring the 4 bespoke tools
  (Angle Miner, Conversion Doctor, Workflow, TestLab) into the same contract, and add the unified
  per-result actions (Save · Share · Rerun · Delete; Export ✅).
- ✅ **Connected ecosystem wiring** — generic tools accept a prior related analysis as injected context
  (`worksWith` + context picker). Remaining: wire bespoke tools as context sources.
- ✅ **Dashboard + Admin coverage** — dashboard renders all 13 tools grouped by suite (with cost badges)
  from `NAV_SUITES`; admin Module Availability toggles all 13 modules (server gate already wired).
- Align the 4 bespoke tools (Angle Miner taxonomy, standalone Workflow Analyzer) to PRD inputs/outputs.
- Apply the **0–100 scoring bands** (§24) consistently.
- Build a real **Analysis History page** (§25/§40): search, filter, sort, reopen, duplicate — replacing
  the current modals. (Generic results already persist to `tool_analysis_results`; `getUserToolAnalyses`
  is a ready reader.)

**Satisfies:** §11–13, §23–25, §40. **Depends on:** Phase 0.

## Phase 2 — Monetization & accounts ✅ COMPLETE (2026-06-01)

All four areas delivered (build green after each); billing is **simulated** per ruling.

1. **Onboarding (§5)** — dismissible 5-step overlay on first login ([components/OnboardingOverlay.tsx](../components/OnboardingOverlay.tsx)),
   `profile.onboarded` flag, "Replay Tour" on dashboard.
2. **Notifications (§39)** — in-app center ([components/NotificationCenter.tsx](../components/NotificationCenter.tsx)):
   header bell + unread badge + dropdown, 5 categories, read/mark-all; emits on analysis/top-up/subscription.
3. **Billing lifecycle (§30–32)** — server-authoritative `changeSubscription` callable (upgrade/cancel/
   renew/downgrade, status + renewal date + 200-token grant + payment/log records); in-app
   [components/SubscriptionPanel.tsx](../components/SubscriptionPanel.tsx) replaces every external upgrade
   redirect; billing history via `PaymentHistoryModal`.
4. **Google sign-in (§4)** — hardened error handling (specific provider codes).

**Deploy-time follow-ups (cannot run from build env):** `firebase deploy --only functions` for the new
callable; enable Google provider + authorized domains + OAuth consent in the Firebase console and verify on
the live domain; real Stripe + live email + Past Due/Expired automation are future swaps (seams marked).

**Satisfies:** §4, §5, §30–32, §39.

## Phase 3 — Public website ✅ MOSTLY COMPLETE (2026-06-01)

Public marketing surface for discovery → evaluation → signup.

- ✅ Shared public chrome: `PublicNav` + `PublicFooter` + `PublicLayout` (logged-in users get full-width
  public layout on marketing routes — no double chrome).
- ✅ Standalone pages: **Features** (all 13 tools by suite, from `NAV_SUITES`), **Pricing**
  (Free/Pro/Top-Ups), **About** (mission/vision/story/team), **FAQ** (shared accordion).
- ✅ Homepage: wrapped in `PublicLayout`, stale 3-tool/old-taxonomy copy fixed, **Testimonials**
  (illustrative samples) + **FAQ** sections added; routes `/features /pricing /about /faq` in `App.tsx`.
- ⛔ **Deferred:** Contact page + Terms + Privacy (next round) — footer omits them (no dead links).

**Satisfies:** §3 (Contact/legal pending).

## Phase 4 — Tool expansion ✅ COMPLETE (2026-05-31)

All **9** PRD tools (§14–22) built on a shared, config-driven engine:
- [config/toolConfigs.ts](../config/toolConfigs.ts) — per-tool inputs, costs, sections, module keys.
- [components/ToolPage.tsx](../components/ToolPage.tsx) — one generic page (inputs, token gating, honeypot,
  states, tabbed results, export) rendering every tool.
- `runToolAnalysis` + `ToolAnalysisResult` ([services/geminiService.ts](../services/geminiService.ts), [types.ts](../types.ts)).
- Server prompts in [api/execute-analysis.ts](../api/execute-analysis.ts); costs/mapping in [functions/src/index.ts](../functions/src/index.ts).
- Routes + "Analysis Suite" nav group in [App.tsx](../App.tsx). `npm run build` passes.

✅ **Transport unified (2026-05-31):** `executeAsyncJob` now POSTs once to the real Firebase
`executeAnalysis` HTTP function (via `functionsBaseUrl` in [services/firebase.ts](../services/firebase.ts))
instead of the dead `/api/analysis/*` poller. All 13 modules run through the one backend that owns
auth, billing, rate-limiting, and audit logging. Remaining for Phase 1: the §23 Universal Result
Framework (shared 9-section structure) and aligning the original 4 tools' result shapes.

> **Deploy note:** the tools run end-to-end once `functions/` is deployed (`firebase deploy --only
> functions`) so `executeAnalysis` is live. For a non-default region or the local emulator, set
> `FIREBASE_FUNCTIONS_URL` (or `FIREBASE_FUNCTIONS_REGION`) — defaults to `us-central1`.

### (original) Phase 4 plan — the 8+1 missing analyzers

Add the remaining PRD tools. **Reuse pattern:** each new tool plugs into the existing job pipeline
(`executeAsyncJob` in [services/geminiService.ts](../services/geminiService.ts), server-side
[functions/src/index.ts](../functions/src/index.ts)) and the Phase 1 Universal Result Framework — so
each is largely a new prompt + input form + result mapping, not new infrastructure.

- Strategy Lab (§14), Offer Analyzer (§15), Audience Intelligence (§16), Market Intelligence (§17),
  Competitor Analyzer (§18), Messaging Analyzer (§19), Content Strategy Tool (§20), Campaign Analyzer
  (§21), Growth Analyzer (§22).
- Update the Feature Directory (§9) with categories + per-tool metadata.

**Satisfies:** §9, §14–22. **Depends on:** Phase 1 (result framework), Phase 0 (token model).

## Phase 5 — Operational hardening ✅ MOSTLY COMPLETE (2026-06-01)

Productionize per the PRD's infra/security/automation sections. Built the three code-verifiable slices;
documented seams (no fake "done") for the two pure-infra items. **Build green after each slice.**

- ✅ **Reporting exports (§50)** — structured **CSV** + headed **print-PDF** on every analysis result
  ([components/ToolPage.tsx](../components/ToolPage.tsx), [pages/History.tsx](../pages/History.tsx)) and on
  billing history (`PaymentHistoryModal`). Helpers `downloadAsCSV`/`toolResultToCSV`/`paymentsToCSV`/
  `printToolResultPDF` in [services/exportService.ts](../services/exportService.ts). **No new deps** (CSV +
  print chosen; `.xlsx`/styled-PDF deferred).
- ✅ **Scheduled automation (§64/§68)** — `monthlyTokenRefresh` Pub/Sub cron (`0 0 1 * *` UTC) in
  [functions/src/index.ts](../functions/src/index.ts) (resets Pro→200, bumps renewal, emits log +
  notification); admin **System Monitoring** tab ([pages/AdminDashboard.tsx](../pages/AdminDashboard.tsx))
  via `computeSystemMetrics`/`getSystemMetrics` ([services/persistenceService.ts](../services/persistenceService.ts)).
- ✅ **Performance / code-split (§78)** — routes `React.lazy`-loaded ([App.tsx](../App.tsx)) + vendor
  `manualChunks` ([vite.config.ts](../vite.config.ts)). Single ~1 MB chunk → ~114 kB main + cached
  `vendor-*` chunks + per-route chunks (no >500 kB warning).
- 🟡 **Email (§67) & Backup/DR (§76)** — code seams + runbook only (by decision): `// EMAIL SEAM` at
  `createNotification`; DR procedures (Firestore→GCS export, retention, restore, RPO/RTO) in
  [docs/OPERATIONS.md](./OPERATIONS.md).
- ⛔ **Deferred:** Support ticket system (§48); revenue reporting depth (§46); explicit caching layer.

**Deploy-time follow-ups (cannot run from build env):** `firebase deploy --only functions` to activate
`monthlyTokenRefresh` (Blaze plan); wire an email provider to the notifications `onCreate` seam; enable the
scheduled Firestore export + bucket lifecycle.

**Satisfies:** §50, §64, §68, §78 ✅; §76 (documented); §46/§48/§67 deferred. **Depends on:** Phase 0.

## Phase 6 — Organizational layers (Team · Agency · Enterprise)

Implements the four supplied specs (Team Workspace, Agency Client Manager, Enterprise Analytics Suite,
Master Wiring) as **ONE platform with progressive unlocks** — not four products. Full master plan:
the planning artifact approved 2026-06-01. **Foundation-first** build order; **server-enforced** isolation;
**simulated** tier billing. Implemented sub-phase by sub-phase.

### Phase 6.0 — Unified Foundation (Master Wiring spine) ✅ COMPLETE (2026-06-01)

The shared spine every layer hangs on (build green after each task):
- **Tier ladder + types** — `UserTier` now `free|pro|team|agency|enterprise`; `VisibilityType`,
  `Scope`/`ScopeLevel`, `OwnershipStamp`, `UserMembership`, `Report`, role families (`WorkspaceRole`/
  `AgencyRole`/`EnterpriseRole`) ([types.ts](../types.ts)).
- **Ownership model + backward compat** — `saveGenericAnalysis` stamps `creator_user_id`+`visibility_type`
  +`*_id` from the active scope (`scopeToOwnership`); **legacy un-stamped records read as private** (no
  migration). Unified readers `getAnalysesForScope`/`getReportsForScope`/`getUserMemberships`
  ([persistenceService.ts](../services/persistenceService.ts)).
- **Scope/Context system** — `ScopeProvider`/`useScope` + header **ScopeSwitcher** (invisible until the
  user has memberships) ([context/ScopeContext.tsx](../context/ScopeContext.tsx),
  [components/ScopeSwitcher.tsx](../components/ScopeSwitcher.tsx)).
- **Centralized permission engine** — `can(action, membership)` over per-family matrices; components never
  hardcode roles ([services/permissionService.ts](../services/permissionService.ts)).
- **Spine wired end-to-end** — History reads `getAnalysesForScope(scope)`; ToolPage stamps the active
  scope onto new analyses; unified `reports` collection; notification categories extended (Member/Client/
  Report/Enterprise).
- **Server-enforcement substrate** — first-ever [firestore.rules](../firestore.rules) (membership-based
  isolation; economy fields locked to server; default-deny) + [firebase.json](../firebase.json) +
  `firestore.indexes.json`. Membership doc-id convention `${containerId}_${uid}`.

**Deliberately deferred to the layer sub-phases** (need the layer's collections/UI/scope-on-the-wire to be
real and testable): the privileged Cloud Functions (`manageWorkspace`/`manageMembership` → 6.1,
`manageClient` → 6.2, `manageEnterprise` → 6.3), the `changeSubscription` tier extension + per-layer
"Upgrade to …" flows, `executeAnalysis` scope-owner token deduction (6.1, once the client sends scope),
and the org-section nav/dashboards (ship with their pages).

**Deploy-time:** `firebase deploy --only firestore:rules` — **emulator/staging-test first** (see
[OPERATIONS.md](./OPERATIONS.md)); rules replace the prior no-rules posture.

### Phase 6.1 — Team Workspace ✅ COMPLETE (2026-06-01)

Collaborative workspaces on the 6.0 spine (build green after each task):
- **Data layer** — `Workspace`/`WorkspaceMember`/`WorkspaceInvitation`/`WorkspaceActivity`/
  `WorkspaceComment` types; readers + comment/activity helpers + callable wrappers
  ([services/persistenceService.ts](../services/persistenceService.ts), [types.ts](../types.ts)).
- **Cloud Functions (deploy-time)** — `manageWorkspace` (create/update/archive/transfer) and
  `manageMembership` (invite/accept/updateRole/remove/revoke), server role-checked, writing
  `workspace_activity` ([functions/src/index.ts](../functions/src/index.ts)). Creating a workspace
  **simulated-upgrades** Free/Pro → **Team** (+pooled token grant on the owner's wallet). `executeAnalysis`
  now does **scope-owner billing**: team-scoped runs deduct from the owner's wallet (membership-verified)
  and stamp `workspace_id`/`actor`/`billing_uid` on the action log. `firestore.rules` extended with
  `workspace_invitations` (invitee-readable) + member-gated activity writes.
- **UI** — [pages/TeamWorkspace.tsx](../pages/TeamWorkspace.tsx) container (create/upgrade pitch, pending-
  invite acceptance, multi-workspace selector, tabs) + panels under [components/team/](../components/team/):
  Overview (stats/activity/intelligence/quick-actions), Members (invite/role/remove via `can()`), Shared
  Analysis Library (search/filter/sort/view) with **threaded comments** (add/reply/edit/delete), Reports,
  Analytics, Activity feed, Settings (rename/archive/transfer). **Private↔Workspace toggle on ToolPage**
  when in team scope. "Team Workspace" sidebar entry + `/team` route.

**Deploy-time:** `firebase deploy --only functions,firestore:rules` to activate `manageWorkspace`/
`manageMembership` + the invitations rules. Email delivery of invites remains the §67 seam (invitees accept
in-app). (§79–80)

### Phase 6.2 — Agency Client Manager ✅ COMPLETE (2026-06-01)

Multi-client management on the 6.0 spine, reusing 6.1 patterns (build green after each task):
- **Data layer** — `Agency`/`AgencyClient`/`ClientAssignment`/`ClientNote`/`ClientActivity`/
  `AgencyInvitation` types + readers (access-aware client loading) + note/activity helpers + callable
  wrappers; `canAccessClient` in [services/permissionService.ts](../services/permissionService.ts).
- **Cloud Functions (deploy-time)** — `manageAgency` (create/update/archive/transfer), `manageClient`
  (create/update/archive/**assign/unassign**/tag), `manageAgencyMember` (invite/accept/role/remove)
  ([functions/src/index.ts](../functions/src/index.ts)). Creating an agency simulated-upgrades →
  **Agency** (+pooled tokens). `executeAnalysis` extended for **client-scope billing** (agency owner's
  wallet; verifies agency membership + client assignment). `firestore.rules` enforce **strict per-client
  isolation**: `canAccessClient(agency, client)` gates `agency_clients`/`client_*` reads and the `client`
  visibility branch of `canSeeStamped` — a member sees only assigned clients (owners/directors see all).
- **UI** — [pages/AgencyHub.tsx](../pages/AgencyHub.tsx) (create/upgrade, pending-invite accept, tabs:
  Dashboard/Clients/Members/Analytics/Settings) + [components/agency/](../components/agency/): Agency
  Dashboard (client-health/intelligence/quick-actions), Client Directory (search/filter/**add client**),
  **Client Workspace** (Overview/Analyses/Notes/Activity/**Team assignments**/Settings with tags + archive
  — sets `client` scope so analyses stay isolated), Agency Members (invite/role/remove), Agency Analytics.
  "Agency Hub" sidebar entry (team-tier+ / agency members) + `/agency` route.

**Deploy-time:** `firebase deploy --only functions,firestore:rules`. No cross-client data leakage
(server-enforced). (§81–82)

### Phase 6.3 — Enterprise Analytics Suite ✅ COMPLETE (2026-06-01)

The top, **read-only aggregation** layer (build green after each task):
- **Data layer** — `Enterprise`/`EnterpriseDepartment`/`EnterpriseBrand`/`EnterpriseHealthScore`/
  `EnterpriseAnalyticsSnapshot`/`EnterpriseForecast`/`EnterpriseBriefing`/`EnterpriseInvitation` types +
  readers (latest engine outputs) + callable wrappers ([services/persistenceService.ts](../services/persistenceService.ts)).
- **Cloud Functions (deploy-time)** — `manageEnterprise` (create/update/archive/transfer/**link**),
  `manageDepartment`, `manageBrand`, `manageEnterpriseMember`; **`runEnterpriseAggregation`** (the engine —
  rolls up `action_logs` across linked workspaces + enterprise-visibility analyses into a 0–100 **health
  score** + analytics snapshot + forecasts, never mutating source data); **`generateExecutiveBriefing`**
  (Gemini synthesizes aggregates into wins/risks/opportunities/recommendations) ([functions/src/index.ts](../functions/src/index.ts)).
  Creating an enterprise simulated-upgrades → **Enterprise** tier. `firestore.rules` member-gate all
  `enterprise_*` reads + invitations.
- **UI** — [pages/EnterpriseSuite.tsx](../pages/EnterpriseSuite.tsx) (create/upgrade, pending-invite accept,
  tabs) + [components/enterprise/](../components/enterprise/): **Dashboard** (health-score gauge + exec
  overview + Refresh Analytics), **Executive Intelligence Center** (opportunities/risks/recommendations +
  forecasts), **Performance** (tool usage + departments/brands), **Briefings Center** (generate + read AI
  briefings), **Structure** (departments/brands CRUD), **Members**, **Settings** (rename/archive/transfer +
  link teams/agencies into the aggregation scope). "Enterprise Suite" sidebar entry + `/enterprise` route.

**Deploy-time:** `firebase deploy --only functions,firestore:rules`. The analytics engine + AI briefings
run server-side, so dashboards show empty/"run aggregation" states until deployed.

**Satisfies:** §79–90. **Depends on:** Phases 0–5.

---

## Phase 6 — status: ✅ ALL LAYERS COMPLETE (foundation + Team + Agency + Enterprise)

The full master plan is delivered: one unified platform with progressive unlocks (Free→Pro→Team→Agency→
Enterprise), server-enforced isolation, simulated tier billing, and zero V1 regressions. Remaining PRD
expansion items (white-label §84-ish, marketplace §86, AI model expansion §87, BI layer §88) are future.

---

## Dependency graph (at a glance)

```
Phase 0 (decisions + alignment)
   ├── Phase 1 (core loop)
   │      └── Phase 4 (8 new tools)
   ├── Phase 2 (monetization & accounts)
   ├── Phase 3 (public website)
   └── Phase 5 (ops hardening)
              └── Phase 6+ (teams / agency / enterprise)
```

## How we'll work each phase

1. You pick the next phase (or a slice of one).
2. We re-enter planning, do a focused gap re-check on just that area, and write a detailed implementation
   plan.
3. Build with TDD/verification, confirm against the cited PRD sections, then update
   [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) statuses as items flip to ✅.
