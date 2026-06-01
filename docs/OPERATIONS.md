# MarketBrain OS — Operations Runbook

> Deploy-time and operational procedures for the live platform. These steps run against the
> Firebase/GCP project from an operator's machine (or CI) — **they cannot be executed from the
> app build environment.** See [ROADMAP.md](./ROADMAP.md) Phase 5 for status and
> [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) for PRD section mapping.

Project: `marketbrainosweb` (region default `us-central1` unless overridden via
`FIREBASE_FUNCTIONS_REGION`).

---

## 1. Deploying Cloud Functions

```bash
cd MarketBrainOS/functions
npm install            # functions/ has its own deps (no node_modules in the build env)
npm run build          # tsc — compiles src/index.ts
firebase deploy --only functions
```

Functions in this codebase:
- `executeAnalysis` (HTTP) — the single analysis backend (auth, billing, rate-limit, audit).
- `manageUser`, `updateSystemSettings`, `confirmTopUp`, `changeSubscription` (callable).
- **`monthlyTokenRefresh` (scheduled, §64)** — see below.

> **Blaze plan required** for scheduled functions and outbound network (email/provider calls).

---

## 2. Monthly token refresh (§64)

`monthlyTokenRefresh` is a Pub/Sub scheduled function: `0 0 1 * *` UTC (00:00 on the 1st of
each month). On deploy, Firebase provisions a Cloud Scheduler job automatically.

- **Behavior:** resets every Pro user (`subscription_status` ∈ {active, cancelled, unset}) to
  `PRO_MONTHLY_TOKENS` (200), bumps `plan_renews_at` +30d, and writes an `action_logs` +
  `notifications` row per user. Token reset uses the same rule as the `renew` branch of
  `changeSubscription` (single source of truth for the monthly allowance).
- **Verify after deploy:** `firebase functions:log --only monthlyTokenRefresh`. Manual trigger
  for testing: Cloud Scheduler console → run the `firebase-schedule-monthlyTokenRefresh-*` job.
- **Idempotency note:** a reset (not increment) is intentional — re-running in the same window
  is safe and will not stack allowances.

---

## 3. Email automation (§67) — SEAM, not yet wired

The in-app notification center is live; the email channel is deferred. The integration point is
marked `// EMAIL SEAM` above `createNotification` in
[services/persistenceService.ts](../services/persistenceService.ts).

**To enable (future):**
1. Add an `onCreate` Firestore trigger on the `notifications` collection in `functions/src`.
2. Look up the user's email; map `category` → an email template.
3. Send via a provider (SendGrid/Resend/SES) using a key stored in functions config/secrets
   (`firebase functions:secrets:set`).
4. Honor a per-user opt-out / quiet-hours flag before sending.

No client code changes are needed — every notification already routes through `createNotification`.

---

## 4. Backup & disaster recovery (§76)

### 4.1 Data: scheduled Firestore exports to GCS
Firestore is the system of record. Schedule managed exports to a Cloud Storage bucket.

```bash
# One-time bucket (choose a region near the DB; enable lifecycle retention).
gsutil mb -l us-central1 gs://marketbrainosweb-backups

# Manual export (full DB).
gcloud firestore export gs://marketbrainosweb-backups/$(date +%Y-%m-%d)

# Recurring: create a Cloud Scheduler + Pub/Sub job that calls the Firestore export API,
# or add a scheduled function `scheduledFirestoreExport` that invokes
# admin.firestore() export via the @google-cloud/firestore admin client. Documented
# pattern (not enabled in this round).
```

- **Retention:** apply a GCS lifecycle rule (e.g. keep 30 daily, 12 monthly).
- **Restore:** `gcloud firestore import gs://marketbrainosweb-backups/<EXPORT_PREFIX>`.
  Test restores into a **staging** project quarterly — never rehearse against production.

### 4.2 Code & config
- Application + functions source is the recovery artifact — redeployable from the repo at any time
  (`firebase deploy`). Keep the repo and the `.env`/functions secrets backed up out-of-band.
- Auth users are managed by Firebase Auth; export via `firebase auth:export users.json` for
  off-platform retention if required.

### 4.3 RPO/RTO targets (recommended)
- **RPO:** ≤ 24h (daily export). Tighten to hourly if write volume warrants.
- **RTO:** ≤ 2h (import latest export into a clean project + redeploy functions/hosting).

---

## 5. OAuth / domain (carried over from Phase 2)
- Enable the Google provider, add authorized domains, and configure the OAuth consent screen in
  the Firebase console; verify sign-in on the deployed domain.

---

## 5b. Firestore Security Rules (Phase 6.0) — deploy-time, test first

Phase 6 introduced the **first** [firestore.rules](../firestore.rules) (previously the DB ran with no
rules / client-trust). They enforce membership-based multi-tenant isolation and lock the token/tier/role
economy to server (Admin SDK) writes only.

```bash
cd MarketBrainOS
firebase emulators:start --only firestore   # or run the rules unit tests in a staging project
firebase deploy --only firestore:rules      # ONLY after verifying nothing V1 breaks
```

- **⚠️ Verify before production deploy:** first-login profile creation, personal analysis save/read,
  history, notifications, and top-ups must all still work. Rules replace the prior open posture, so a
  mistake here can lock out the live app.
- **Membership doc-id convention:** membership docs MUST be keyed `${containerId}_${uid}` in
  `workspace_members` / `agency_members` / `enterprise_members` — the rules check membership via that id.
  Phase 6.1+ Cloud Functions write them this way.
- Indexes: `firestore.indexes.json` is currently empty — the scoped readers use equality-only filters
  (no composite index required). Add indexes here if later queries combine equality + range/orderBy.

## 6. Monitoring (§68)
- In-app: **Admin Dashboard → Monitoring** rolls up recent `action_logs` (success/failed/blocked
  counts, top error codes, recent issues).
- Platform-level: enable Cloud Functions error alerting in Google Cloud Monitoring; watch
  `executeAnalysis` invocation errors and `monthlyTokenRefresh` run status.
