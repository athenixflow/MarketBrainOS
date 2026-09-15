# Account deletion — end-to-end flow spec

Owner: ArchitectUX. Status: ready for implementation. Fulfils Privacy §8 (delete account and associated data) within §6 (transaction and security logs retained for legal, accounting and fraud-prevention purposes).

Nothing here exists yet: no `deleteAccount` callable, no query-param handling on `/auth`, and `firestore.rules` denies every relevant client delete. All destructive work runs in one callable on the Admin SDK.

## 1. Entry point

`Settings → Account` tab, a new `Card title="Delete account"` rendered last. Copy: "Permanently delete your MarketBrain OS account and the data it holds. This cannot be undone." A `SecondaryButton` **Delete account…** opens a `Modal` with four steps: Check → Verify → Confirm → Done. Closing it before "Deleting…" discards everything.

## 2. Step 1 — Check (dry run)

On open, call `deleteAccount({ confirm: 'DELETE', dryRun: true })`. Show "Checking your account…" with `aria-busy="true"`. The response decides which of three states renders.

**Refusal — owns an active container.** The `refusal.containers[]` list names every workspace, agency or enterprise whose `owner_id` is the caller and whose `status` is not `archived`. Archived containers do not block. Copy, heading first:

> **You still own {n} team(s).** Before you can delete your account, archive **{Name}** ({kind}) or hand it to another member.
> Archive: Team Workspace → Settings → Archive workspace (`manageWorkspace` `delete`), Agency Hub → Settings → Archive agency (`manageAgency` `archive`), Enterprise → Settings → Archive enterprise (`manageEnterprise` `archive`).
> Transfer: Members → ⋯ → Make owner (`{manageWorkspace|manageAgency|manageEnterprise}` `transfer`, `payload.targetUid` must already be a member). You stay on as admin / director / executive admin, then come back here.

Each container row links to its settings page. The only button is **Close**.

**Warning — active paid subscription** (`tier !== 'free'` and `subscription_status !== 'cancelled'`). Not a refusal. Copy:

> Your **{Tier}** plan ends immediately. **{monthly_tokens}** monthly and **{purchased_tokens}** purchased tokens are forfeited — they are not refunded and cannot move to another account. If you want to spend them first, close this and come back later.

**Warning — pending invitations.** Counts come from `deleted` in the dry-run response. Copy: "{n} invitation(s) you sent will be withdrawn." and, if any address the caller's email, "{n} invitation(s) waiting for you will be declined."

When there is no refusal, the primary button reads **Continue**.

## 3. Step 2 — Verify (re-authentication)

Both proofs are required: a fresh Firebase credential on the client and a fresh `auth_time` on the server.

- Password users (`providerData` contains `password`): one `Input type="password"` labelled "Your password", `autoComplete="current-password"`, hint "Enter your password to continue." → `reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pwd))`.
- Google users: `GoogleButton` labelled **Continue with Google to verify** → `reauthenticateWithPopup(user, googleProvider)`. On `auth/popup-blocked` fall back to `reauthenticateWithRedirect`, persisting `sessionStorage.pendingDelete = '1'` so Settings reopens the modal at step 3 after the round trip.
- After either succeeds, call `user.getIdToken(true)` so the callable carries the new `auth_time`. The server rejects any non-dry-run request where `now − context.auth.token.auth_time > 300 s` with `failed-precondition` / `reauth-required`.

## 4. Step 3 — Confirm

Heading: "Delete your account?" Then the plain-language ledger (section 5), then an `Input` labelled **Type DELETE to confirm**, `autoComplete="off"`, case-sensitive exact match; paste is allowed. Primary button **Delete my account** (danger tone) is `aria-disabled` until the text matches; while running it reads **Deleting…**, Escape and backdrop are inert, and the Account tab beneath is replaced by a full-panel "Deleting your account…" state so the `profileError` retry card never flashes.

## 5. What is deleted vs retained

| Deleted (hard delete) | Retained (anonymised) |
|---|---|
| `users/{uid}`; Firebase Auth user (last) | `payments` — keep amount, reference, tokens, date; `uid` → `deleted_<sha256(uid)[:12]>`, drop email/name |
| `tool_analysis_results`, `reports` where `creator_user_id` or `user_id` — **including team-, client- and enterprise-visible records** | `action_logs`, `security_audit_logs` — same uid substitution, strip `email`. **`admin_audit_logs` is left untouched**: it is hash-chained (`logAdminAudit`), so scrubbing a field would break every later hash; entries naming the user (`target` uid, `metadata.email` on `CREATE_USER`) keep those values. Admin-only; Privacy §6 states the exception |
| `angleminer_results`, `testlab_results`, `conversion_doctor_results`, `workflow_runs`, `notifications`, `rate_limits` | `workspace_activity`, `client_activity`, `workspace_comments`, `client_notes` — name → "Deleted user", uid substituted (other people's threads) |
| `workspace_members`, `agency_members`, `enterprise_members`, `client_assignments`; decrement `member_count` | Archived containers still owned — stamp `owner_deleted_at`; admin reassigns via `adminManageOrg` `transfer` |
| Invitations `invited_by === uid` → `revoked`; invitations to caller's email → `declined` | |

User-facing phrasing on the Confirm step:

> **Deleted now:** your profile, sign-in, every analysis and report you created — including ones shared with your team — your history, notifications, memberships and open invitations.
> **Kept:** payment records and security logs, because the law and our accountants require them (Privacy Policy §6). Your name and email are removed from them; only a scrambled reference remains.

Server order: refusal re-check → subscription cancel (provider first, once a real provider exists) → anonymise retained → delete owned records in batches of 400 → memberships and counters → Auth user → email.

## 6. Callable contract

`deleteAccount` (`functions.https.onCall`, memory 512 MB, timeout 300 s)

| Request field | Type | Rule |
|---|---|---|
| `confirm` | `'DELETE'` | Required literal in both modes; anything else → `invalid-argument`. The client supplies it on dry run; user intent is proven by re-auth, not this string. |
| `dryRun` | `boolean?` | `true` = compute counts and refusal, write nothing, skip the `auth_time` check. |

| Response field | Type | Notes |
|---|---|---|
| `ok` | `boolean` | `false` whenever `refusal` is present. |
| `deleted` | `Record<collection, number>` | Counts that were (or on dry run, would be) removed, e.g. `{ tool_analysis_results: 42, workspace_invitations: 3 }`. |
| `retained` | `string[]` | Collections kept and anonymised, e.g. `['payments','action_logs','security_audit_logs']`. |
| `refusal?` | `{ reason: 'owns_containers' \| 'suspended', containers: { kind, id, name }[] }` | `suspended` covers `is_suspended` accounts, which must go through support. |

Errors: `unauthenticated`, `invalid-argument`, `failed-precondition` (`reauth-required`), `internal` (partial failure — the function writes `deletion_jobs/{uid}` with progress and retrying from Settings finishes it (the run is idempotent; there is no scheduled retry)).

## 7. Done: email, sign-out, landing

Send `accountDeleted` (new template in `functions/src/email/templates.ts`) to the address captured from `context.auth.token.email` before the Auth user is removed; fire-and-forget. Subject "Your MarketBrain OS account has been deleted". Body: what was deleted, what was kept and why, "If you did not do this, contact {support} immediately."

Client on `ok: true`: `signOut(auth)` to clear local state, then `navigate('/auth?deleted=1', { replace: true })`. `Auth.tsx` reads `deleted` via `useSearchParams` and renders `FormAlert tone="success"` above the form: "Your account has been deleted. Thanks for using MarketBrain OS — you can create a new account any time." The alert takes focus on mount; the param is dropped on the next mode switch.

## 8. Error states (all render in the modal's live region; nothing is deleted unless stated)

| Condition | Copy | Next |
|---|---|---|
| Network / `unavailable` / `internal` on dry run | "We couldn't check your account. Check your connection and try again." | **Retry** |
| Wrong password / `auth/invalid-credential` | "That password doesn't match. Nothing was deleted." | stay on Verify |
| Google popup closed / blocked | reuse `Auth.tsx` copy | stay on Verify |
| `reauth-required` (user idled past 5 min) | "Your verification expired. Verify again to continue." | back to Verify |
| Refusal at run time (ownership changed mid-flow) | render the Step 1 refusal state | **Close** |
| `internal` mid-purge | "Deletion did not finish. You do not need to do anything — sign in and retry from Settings; every retry picks up where the last one stopped. Contact {support} if you can still sign in after 24 hours." | sign out anyway |

## 9. Accessibility

`Modal` is `role="dialog" aria-modal="true" aria-labelledby={stepHeadingId}`; focus moves to the step heading on open and on each step change, then Tab order is fields → secondary → primary. Escape and backdrop close on Check/Verify/Confirm, never during Deleting. Errors render in `ErrorMessage` inside a `role="alert"` container directly above the primary button. The DELETE input has `aria-describedby` on its hint and the ledger; the primary uses `aria-disabled` so it stays reachable. Focus returns to **Delete account…** on dismiss.

## 10. Edge cases

- Member (not owner) of a workspace, agency or enterprise: membership rows and `client_assignments` are removed and `member_count` decremented; the team is untouched.
- Shared analyses and reports the user created inside a team, client or enterprise library: **deleted**, not reassigned. The Confirm ledger says so plainly; a warning line lists the count from `deleted`.
- Owns only archived containers: allowed; containers stay archived with `owner_deleted_at` for admin transfer.
- Platform admins (`super_admin`, `ops_admin`): the callable refuses with `permission-denied`; copy "Admin accounts are deleted from the admin console." They are demoted to `user` there first, then delete themselves normally.
- Google users in in-app browsers: redirect fallback restores the modal at Confirm via `sessionStorage.pendingDelete`.
- Same email signs up again later: a brand-new uid, free tier, starter tokens; nothing is restored.
- Two tabs open: the second tab's next callable fails `unauthenticated` and `onAuthStateChanged` routes it to `/auth` without the banner.
