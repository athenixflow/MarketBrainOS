# QA fix design spec

Implementation spec for the seven QA findings. Every class string below is final; copy it as written. Nothing here introduces a new colour, radius or type size: it reuses the recipes in `components/UI.tsx` and the scale in `tailwind.config.js`.

## 0. Read first

| Token | Value | Where it comes from |
| --- | --- | --- |
| Shell | `bg-[#0B0B0B]`; raised dark surface `bg-[#121212] border-gray-800` | `Card dark`, `ExportControls dark` |
| Paper | `bg-white text-[#0B0B0B] border-gray-100` | `Card` |
| Accent | `#FF0000`, hover `#D40000` | `PrimaryButton` |
| Destructive | `#B91C1C`, hover `#991B1B` | `ErrorMessage` rationale ("never reads as a primary CTA"; white on it is 6.0:1) |
| Eyebrow | `text-[10px] font-bold uppercase tracking-widest` | `Stat`, `SectionLabel` |
| Nav link | `text-[11px] font-bold uppercase tracking-widest` | app header, `PublicNav`, `DocsLayout` |
| Field label | `text-[11px] font-bold tracking-widest uppercase text-gray-500 mb-2` | `FieldLabel` |
| z-layers | header `z-20`, desktop sidebar `z-10`, lockdown banner / PublicNav `z-40`, mobile sidebar / `Modal` `z-50` | `App.tsx`, `UI.tsx` |

New layer: consent banner `z-[45]` (above every header, below `Modal`).

---

## 1. App header (`App.tsx:249-289`)

### Why it broke at 768

The right cluster is `flex` with no `whitespace-nowrap`, so "Sign In" (two words) is the first thing the browser breaks. At 768 with `px-6` the row has 720px; brand (hamburger + logo + full wordmark) is ~257px and the right cluster with ScopeSwitcher (`max-w-[140px]` label + chrome, up to ~200px) is ~530px. Two fixes: the brand is the only thing allowed to shrink, and the ScopeSwitcher waits until `md`.

### Visibility per breakpoint

| Element | < 640 | 640-767 (`sm`) | 768-1023 (`md`) | >= 1024 (`lg`) | >= 1280 (`xl`) |
| --- | --- | --- | --- | --- | --- |
| Hamburger | yes | yes | yes | hidden | hidden |
| Wordmark | `MBOS` | `MBOS` | `MBOS` | `MARKETBRAINOS` | same |
| Upgrade (free tier) | pill `Pro` | pill | pill | text `Upgrade to Pro` | same |
| Docs | `?` | `Docs` | `Docs` | `Docs` | same |
| Sign out / Sign in | text | text | text | text | same |
| ScopeSwitcher | in sidebar drawer | in sidebar drawer | header | header | header |
| NotificationCenter, status dot | yes | yes | yes | yes | yes |
| Group gap / link gap | `gap-3` / `gap-4` | `gap-4` / `gap-4` | `gap-4` / `gap-4` | `gap-8` / `gap-6` | `gap-10` / `gap-6` |

Width budget after the change, worst case (long scope label, free tier): 390px -> ~350 of 358; 640 -> ~390 of 592; 768 -> ~606 of 720; 1024 -> ~809 of 928.

### Rules

- Brand cluster: `min-w-0 overflow-hidden`, wordmark `whitespace-nowrap truncate`. This is the only element that may shrink.
- Right cluster: `shrink-0`, and every child `shrink-0 whitespace-nowrap`. Do **not** put `overflow-hidden` on it: `ScopeSwitcher` and `NotificationCenter` render absolutely-positioned popovers inside it and would be clipped.
- Remove `animate-pulse` from the upgrade link. It was the only perpetually animating element in the chrome; red already carries the emphasis.
- Sidebar drawer fallback for the scope switcher (`App.tsx:172`) changes `sm:hidden` -> `md:hidden` to match the header's `hidden md:block`.

### Final JSX

```tsx
<header className="h-16 bg-[#0B0B0B] bg-opacity-95 backdrop-blur-2xl flex items-center gap-4 px-4 sm:px-6 lg:px-12 fixed top-0 left-0 right-0 border-b border-gray-900/30 z-20">
  {/* Brand cluster: the only part allowed to shrink, so it owns min-w-0 / overflow-hidden. */}
  <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
    {user && (
      <button type="button" onClick={onToggleSidebar} aria-label="Open navigation" className="lg:hidden shrink-0 text-gray-400 hover:text-white p-1">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    )}
    <Link to="/" className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 shrink-0 bg-[#FF0000] rounded-[10px] flex items-center justify-center font-bold text-white text-xs shadow-2xl shadow-[#FF0000]/20 transform -rotate-6 transition-transform hover:rotate-0">M</div>
      <h1 className="text-sm font-bold tracking-[0.2em] text-white uppercase whitespace-nowrap truncate">
        <span className="lg:hidden">{isAdminPath ? 'MBOS Admin' : 'MBOS'}</span>
        <span className="hidden lg:inline">{isAdminPath ? 'MarketBrainOS Admin' : 'MarketBrainOS'}</span>
      </h1>
    </Link>
  </div>

  {/* Right cluster: fixed-width children, never clipped (popovers live here). */}
  <div className="ml-auto flex items-center shrink-0 gap-3 sm:gap-4 lg:gap-8 xl:gap-10">
    <nav aria-label="Account" className="flex items-center gap-4 lg:gap-6 text-[11px] font-bold tracking-widest text-gray-500 uppercase">
      {!isAdminPath && profile?.tier === 'free' && (
        <>
          <Link
            to="/pricing"
            aria-label="Upgrade to Pro"
            className="lg:hidden shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[#FF0000]/40 text-[#FF0000] text-[10px] whitespace-nowrap hover:bg-[#FF0000] hover:text-white transition-colors"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
            </svg>
            Pro
          </Link>
          <Link to="/pricing" className="hidden lg:inline shrink-0 whitespace-nowrap text-[#FF0000] hover:text-white transition-colors">Upgrade to Pro</Link>
        </>
      )}
      <Link to="/documentation" className="hidden sm:inline shrink-0 whitespace-nowrap hover:text-white transition-colors">Docs</Link>
      <Link to="/documentation" aria-label="Documentation" className="sm:hidden shrink-0 hover:text-white transition-colors">?</Link>
      {user ? (
        <button type="button" onClick={signOut} className="shrink-0 whitespace-nowrap hover:text-white transition-colors uppercase tracking-widest font-bold">Sign out</button>
      ) : (
        <Link to="/auth" className="shrink-0 whitespace-nowrap hover:text-white transition-colors">Sign in</Link>
      )}
    </nav>
    {user && !isAdminPath && <div className="hidden md:block shrink-0"><ScopeSwitcher /></div>}
    {user && !isAdminPath && <div className="shrink-0"><NotificationCenter /></div>}
    <div aria-hidden="true" className={`w-1.5 h-1.5 shrink-0 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.3)] ${isEmergency ? 'bg-red-500' : 'bg-green-500/80'}`} />
  </div>
</header>
```

---

## 2. Consent banner (`components/ConsentBanner.tsx`, new)

### Behaviour

- Storage key `mbos.consent.v1` -> `{ analytics: 'granted' | 'denied', at: ISO }`. Rendered only when no decision is stored. Every storage read/write is wrapped in `try/catch`; if storage is blocked the decision lives in component state for the session.
- Mount once, at the end of `AppContainer` in `App.tsx` (after `OnboardingOverlay`), so it is last in tab order and appears on marketing, docs, auth and app routes alike. Skip it while onboarding is open: `{!(user && profile && !profile.onboarded) && <ConsentBanner />}`.
- `navigator.webdriver` guard keeps it out of the Puppeteer prerender snapshot (`scripts/prerender.ts` sets no flag of its own).
- Not modal: no focus trap, no backdrop, no body lock. `role="region"` with a labelled heading.
- No layout shift: `position: fixed`, no body padding. Height is ~190px on a phone; it sits over content and disappears on the first tap.
- Motion: `motion-safe:` prefixes on the enter animation; `index.css` also collapses all animation under `prefers-reduced-motion`.
- Analytics loader reads `readAnalyticsConsent() === 'granted'` at boot and listens for the `mbos:consent` window event to start late.

### Copy

- Eyebrow: **Privacy**
- Title: **Can we measure how the product is used?**
- Body: *With your permission we collect anonymous usage analytics to see which tools get used and where they break; the essential cookies that keep you signed in are always on.*
- Buttons: **Accept analytics** (primary) / **Decline** (secondary, equal size)
- Link: **Privacy policy §11** -> `/privacy#cookies`

### Full component

```tsx
import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from './UI';

const KEY = 'mbos.consent.v1';
type Decision = 'granted' | 'denied';

export const readAnalyticsConsent = (): Decision | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { analytics } = JSON.parse(raw) as { analytics?: Decision };
    return analytics === 'granted' || analytics === 'denied' ? analytics : null;
  } catch { return null; }
};

const writeConsent = (analytics: Decision) => {
  try { localStorage.setItem(KEY, JSON.stringify({ analytics, at: new Date().toISOString() })); } catch { /* blocked storage: session-only */ }
  window.dispatchEvent(new CustomEvent('mbos:consent', { detail: { analytics } }));
};

const ConsentBanner: React.FC = () => {
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (navigator.webdriver) return; // build-time prerender and bots: keep the banner out of the snapshot
    if (readAnalyticsConsent() === null) setOpen(true);
  }, []);

  if (!open) return null;
  const decide = (d: Decision) => { writeConsent(d); setOpen(false); };

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed z-[45] inset-x-0 bottom-0 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[calc(100vw-3rem)] sm:max-w-[420px] bg-[#121212] text-white border-t border-gray-800 sm:border sm:rounded-2xl shadow-2xl shadow-black/50 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Privacy</p>
      <h2 id={titleId} className="text-base font-bold tracking-tight text-white mb-2">Can we measure how the product is used?</h2>
      <p id={descId} className="text-sm text-gray-400 leading-relaxed">
        With your permission we collect anonymous usage analytics to see which tools get used and where they break; the essential cookies that keep you signed in are always on.
      </p>
      <Link to="/privacy#cookies" className="mt-3 inline-block text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-white underline-offset-4 hover:underline transition-colors">
        Privacy policy §11
      </Link>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <PrimaryButton size="sm" onClick={() => decide('granted')} className="w-full sm:w-auto">Accept analytics</PrimaryButton>
        {/* !py-3 matches the 40px height of PrimaryButton sm so the pair sits on one baseline. */}
        <SecondaryButton size="sm" tone="dark" onClick={() => decide('denied')} className="w-full sm:w-auto !py-3">Decline</SecondaryButton>
      </div>
    </section>
  );
};

export default ConsentBanner;
```

### Dependencies

- `LegalSection` (`components/LegalPage.tsx`) needs an `id?: string` prop passed to its `<section>`; Privacy §11 gets `id="cookies"`, §6 gets `id="retention"` (used in sections 4 and 7).
- `LegalPage` must scroll to the hash on client-side navigation (BrowserRouter does not): `useEffect(() => { const el = location.hash && document.getElementById(location.hash.slice(1)); el?.scrollIntoView({ block: 'start' }); }, [location.hash])`.
- Privacy §11 currently says only essential cookies are used. It must mention optional analytics and that consent can be withdrawn before this banner ships.

---

## 3. Token store disabled state (`components/TokenStore.tsx:57-75`)

### PrimaryButton recipe (`UI.tsx:54`)

Replace `disabled:opacity-30` with a real greyed state and gate hover/active on `enabled:` (Tailwind 3.4), because a disabled button still matches `:hover` and was turning darker red:

```
bg-[#FF0000] text-white ${PRIMARY_SIZE[size]} font-bold rounded-2xl shadow-sm tracking-widest uppercase transition-all duration-300 enabled:hover:bg-[#D40000] enabled:hover:shadow-xl enabled:hover:shadow-[#FF0000]/10 enabled:active:scale-[0.99] disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-gray-200 disabled:cursor-not-allowed
```

Values on paper: fill `#F3F4F6` (gray-100), text `#6B7280` (gray-500, 4.4:1 so "Processing…" stays readable; inactive controls are exempt from 1.4.3 regardless), edge `ring-gray-200` (`#E5E7EB`, inset so the box does not grow by 1px when it disables). This changes every disabled `PrimaryButton` in the app (auth submit, "Saving…" buttons); that is intended.

Add an optional `danger?: boolean` prop used in section 4: when set, swap `bg-[#FF0000] enabled:hover:bg-[#D40000] enabled:hover:shadow-[#FF0000]/10` for `bg-[#B91C1C] enabled:hover:bg-[#991B1B] enabled:hover:shadow-[#B91C1C]/10`.

### TokenStore JSX

Import `Link` from `react-router-dom`. Each card gets an inline reason under the button on the Free tier; the "Paid plans only" block below the grid stays as it is.

```tsx
<Card key={p.id} className="flex flex-col">
  <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{p.label}</p>
    {p.id === BEST_VALUE_ID && <Badge tone="red">Best value</Badge>}
  </div>
  <p className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums leading-none text-[#0B0B0B]">{p.tokens.toLocaleString()}</p>
  <p className="mt-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">tokens</p>
  <p className="mt-4 text-lg font-black tabular-nums text-[#0B0B0B]">${p.price}</p>
  <div className="mt-3 mb-6"><Badge tone="green">Never expires</Badge></div>
  <div className="mt-auto">
    <PrimaryButton size="sm" onClick={() => buy(p.id, p.tokens)} disabled={busy !== null || isFree} className="w-full">
      {busy === p.id ? 'Processing…' : 'Buy'}
    </PrimaryButton>
    {isFree && (
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
        <Link to="/pricing" className="text-[#FF0000] hover:text-[#D40000] underline-offset-4 hover:underline transition-colors">
          Upgrade to Pro to buy tokens →
        </Link>
      </p>
    )}
  </div>
</Card>
```

Then the existing block, unchanged:

```tsx
{isFree && (
  <div className="mt-6 flex flex-wrap items-center gap-3">
    <Badge tone="neutral">Paid plans only</Badge>
    <p className="text-sm text-gray-500 font-medium">
      Token packs are available on Pro and higher. Your Free allowance is a one-time balance and does not refill; upgrade to Pro for a monthly allowance and the ability to top up.
    </p>
  </div>
)}
```

---

## 4. Settings -> Account danger zone (`pages/Settings.tsx`, Account tab)

### SecondaryButton danger tone (`UI.tsx:62-83`)

`tone?: Tone | 'danger'`; the danger branch is `text-[#B91C1C] border-red-200 hover:bg-red-50 hover:border-red-300`.

### State and flow

```ts
const [confirming, setConfirming] = useState(false);
const [confirmText, setConfirmText] = useState('');
const [reauthPwd, setReauthPwd] = useState('');
const [reauthed, setReauthed] = useState(false);          // Google users, after reauthenticateWithPopup
const [deleting, setDeleting] = useState(false);
const [deleteError, setDeleteError] = useState('');
const canDelete = confirmText === 'DELETE' && (isPasswordUser ? reauthPwd.length > 0 : reauthed) && !deleting;
```

1. Password users: `reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, reauthPwd))` inside `deleteAccount`. Google users: the "Continue with Google" button calls `reauthenticateWithPopup(user, googleProvider)` and sets `reauthed`.
2. `await callDeleteAccount()` — new callable `deleteAccount`: deletes profile, analyses, history, reports, notifications, memberships; rewrites `payments` and audit rows with an anonymous id; deletes the Auth user with the Admin SDK.
3. `await signOut(); navigate('/auth?deleted=1', { replace: true })`. Sign out first, or the `/auth` route's `user ? <Navigate to="/" />` fires.
4. Error copy: `auth/wrong-password` / `auth/invalid-credential` -> "That password is not correct."; `auth/popup-closed-by-user` -> "The Google window closed before we could verify you."; `auth/requires-recent-login` -> "Please sign out, sign in again, and retry."; anything else -> the sanitised message.

### JSX (appended after the Account `<Card>`)

```tsx
<Card className="mt-6 !border-red-200">
  <p className="text-[10px] font-bold uppercase tracking-widest text-[#B91C1C] mb-3">Danger zone</p>
  <h3 className="text-lg font-bold tracking-tight text-[#0B0B0B] mb-3">Delete your account</h3>
  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-3">
    This permanently deletes your profile, saved analyses, history, reports, notifications and your seats in any workspace. Unused tokens are forfeited and cannot be refunded.
  </p>
  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
    Payment receipts and audit records are kept for as long as the law requires, with your name and email replaced by an anonymous id (<Link to="/privacy#retention" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">Privacy policy §6</Link>).
  </p>

  {!confirming ? (
    <SecondaryButton tone="danger" onClick={() => setConfirming(true)}>Delete account</SecondaryButton>
  ) : (
    <div role="group" aria-label="Confirm account deletion" className="p-5 sm:p-6 rounded-2xl bg-red-50 border border-red-100 animate-in fade-in duration-300">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#B91C1C] mb-5">Confirm deletion</p>

      <Input
        label="Type DELETE to confirm"
        placeholder="DELETE"
        autoComplete="off"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        disabled={deleting}
        hint="Upper case, exactly as shown."
      />

      {isPasswordUser ? (
        <Input
          label="Your password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password to continue"
          value={reauthPwd}
          onChange={(e) => setReauthPwd(e.target.value)}
          disabled={deleting}
          hint="We check it is really you before deleting anything."
        />
      ) : (
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-widest uppercase text-gray-500 mb-2">Confirm it is you</p>
          <GoogleButton onClick={reauthWithGoogle} disabled={deleting || reauthed} label={reauthed ? 'Verified with Google' : 'Continue with Google'} />
        </div>
      )}

      {deleteError && <ErrorMessage message={deleteError} className="mb-6" />}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton danger onClick={deleteAccount} disabled={!canDelete} className="w-full sm:w-auto">
          {deleting ? 'Deleting…' : 'Delete my account permanently'}
        </PrimaryButton>
        <SecondaryButton onClick={() => { setConfirming(false); setConfirmText(''); setReauthPwd(''); setDeleteError(''); }} disabled={deleting}>
          Keep my account
        </SecondaryButton>
      </div>
    </div>
  )}
</Card>
```

`GoogleButton` is imported from `components/auth/AuthField`; `reauthenticateWithPopup` from `firebase/auth`; `googleProvider` from `services/firebase`.

---

## 5. PublicNav signed-in state (`components/PublicNav.tsx`)

`PublicLayout` renders inside `AuthProvider`, so `const { user } = useAuth()` is available. Mirror `DocsLayout.tsx:58-65` exactly: one "Open app" pill replaces both auth CTAs. Keep `rounded-xl` here so it matches the adjacent "Start Free" pill and the docs nav; the nav pills are the one place the system uses that radius.

This is also where the QA "logo running into FEATURES" comes from: at 768 the wordmark (~166px), five links at `gap-8` (~296px) and both CTAs (~210px) need ~720px of a 672px row. Fixes: `whitespace-nowrap shrink-0` on every link, `gap-5 lg:gap-8` on the link row, and "Sign In" `hidden lg:inline` (the `/auth` page it leads to already opens in sign-in mode, so "Start Free" covers both at `md`).

### Desktop

```tsx
const { user } = useAuth();
const close = () => setOpen(false);
...
<Link to="/" className="flex items-center gap-3 lg:gap-4 py-2 -my-2 shrink-0" onClick={close}>
  <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center font-bold text-white text-xs transform -rotate-6 transition-transform hover:rotate-0">M</div>
  <span className="text-sm font-bold tracking-[0.2em] text-white uppercase whitespace-nowrap">MarketBrainOS</span>
</Link>

<nav className="hidden md:flex items-center gap-5 lg:gap-8">
  {LINKS.map((l) => (
    <Link key={l.to} to={l.to} className={`whitespace-nowrap shrink-0 text-[11px] font-bold uppercase tracking-widest transition-colors ${location.pathname === l.to ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
      {l.label}
    </Link>
  ))}
</nav>

<div className="hidden md:flex items-center gap-4 lg:gap-6 shrink-0">
  {user ? (
    <Link to="/" className="whitespace-nowrap text-[11px] font-bold uppercase tracking-widest bg-white/5 border border-gray-800 text-gray-200 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">Open app</Link>
  ) : (
    <>
      <Link to="/auth" className="hidden lg:inline whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors py-4 -my-4">Sign In</Link>
      <Link to="/auth" className="whitespace-nowrap text-[11px] font-bold uppercase tracking-widest bg-[#FF0000] text-white px-5 py-2.5 rounded-xl hover:bg-[#D40000] transition-colors">Start Free</Link>
    </>
  )}
</div>
```

### Mobile menu

```tsx
<div className="pt-4 flex items-center gap-4 border-t border-gray-900/50">
  {user ? (
    <Link to="/" onClick={close} className="text-xs font-bold uppercase tracking-widest bg-white/5 border border-gray-800 text-gray-200 px-4 py-2 rounded-xl">Open app</Link>
  ) : (
    <>
      <Link to="/auth" onClick={close} className="text-xs font-bold uppercase tracking-widest text-gray-400 py-3.5 -my-1">Sign In</Link>
      <Link to="/auth" onClick={close} className="text-xs font-bold uppercase tracking-widest bg-[#FF0000] text-white px-4 py-2 rounded-xl">Start Free</Link>
    </>
  )}
</div>
```

---

## 6. Members form two-mode control (`components/team/TeamMembers.tsx:84-93`, `agency/AgencyMembers.tsx`, `enterprise/EnterpriseMembers.tsx`)

### SegmentedControl primitive (add to `UI.tsx` after Tabs)

A form-level mode switch, not navigation (that is `Tabs`). Radio semantics so a screen reader announces "1 of 2, checked". Pill geometry follows `ScopeSwitcher`. On a 390px phone the Card interior is 294px, so below `sm` the control is full-width with `flex-1` segments and 10px labels.

```tsx
export const SegmentedControl = <T extends string>({ options, value, onChange, label, className = '' }: {
  options: Array<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  /** Accessible group name, e.g. "How to add this member". */
  label: string;
  className?: string;
}) => (
  <div role="radiogroup" aria-label={label} className={`flex w-full sm:inline-flex sm:w-auto p-1 rounded-full bg-gray-100 ${className}`}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/40 ${
            active ? 'bg-white text-[#0B0B0B] shadow-sm' : 'text-gray-500 hover:text-[#0B0B0B]'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);
```

### Form

State: `const [mode, setMode] = useState<'invite' | 'create'>('invite');` — `reset()` leaves `mode` alone. The control is hidden while editing. Tool allowlist and budget apply in both modes.

```tsx
<Card title={editingUid ? 'Edit member' : 'Add a team member'}>
  {/* Stat row unchanged */}

  {!editingUid && (
    <div className="mb-8">
      <SegmentedControl
        label="How to add this member"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'invite', label: 'Invite by email' },
          { value: 'create', label: <><span className="sm:hidden">Create account</span><span className="hidden sm:inline">Create account for them</span></> },
        ]}
      />
      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        {mode === 'invite'
          ? 'They receive an email with a link, sign in with their own password, and appear here once they accept.'
          : 'You set a temporary password and pass it on yourself. They are active immediately and can change it after first sign-in.'}
      </p>
    </div>
  )}

  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
    <Input compact label="Email" placeholder={EMAIL_PLACEHOLDER} value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingUid} />
    <Select compact label="Role" value={role} onChange={(v) => setRole(v as WorkspaceRole)} options={ASSIGNABLE.map(r => ({ value: r, label: ROLE_LABELS[r] || r }))} className="md:w-52" />
    <Input compact label="Monthly token budget" type="number" placeholder="0" value={String(budget)} onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value, 10) || 0))} className="md:w-44" />
  </div>
  <p className="mt-2 text-xs text-gray-500">{BUDGET_HINT}</p>

  {!editingUid && mode === 'create' && (
    <div className="mt-6">
      <Input compact label="Temporary password" type="password" autoComplete="new-password" placeholder="They can change it after first login" value={password} onChange={(e) => setPassword(e.target.value)} />
    </div>
  )}

  {/* Tools allowlist unchanged */}

  <div className="flex flex-wrap items-center gap-3 mt-8">
    <PrimaryButton size="sm" onClick={submit} disabled={busy || (!editingUid && (!email || (mode === 'create' && !password)))}>
      {busy ? (mode === 'invite' && !editingUid ? 'Sending…' : 'Saving…') : editingUid ? 'Save changes' : mode === 'invite' ? 'Send invitation' : 'Create account'}
    </PrimaryButton>
    {editingUid && <SecondaryButton size="sm" onClick={reset}>Cancel</SecondaryButton>}
  </div>
  {msg && <SuccessMessage message={msg} className="mt-4" />}
</Card>
```

`submit` in invite mode: `callManageMembership('invite', { workspaceId: workspace.id, email, role, allowed_tools, token_budget: budget })` then `flash(\`Invitation sent to ${email}.\`)`. Twins use `callManageAgencyMember('invite', …)` (`persistenceService.ts:1087`) and `callManageEnterpriseMember('invite', …)` (`:1266`); confirm each callable accepts `allowed_tools` / `token_budget` on invite. Create mode is the existing `callCreateWorkspaceMember` path.

---

## 7. Post-deletion landing (`pages/Auth.tsx`, `/auth?deleted=1`)

`const [params, setParams] = useSearchParams(); const deleted = params.get('deleted') === '1';`. `switchMode` clears it: `setParams({}, { replace: true })`.

Copy override while `deleted && mode === 'signin'`:

- Title: **Account deleted**
- Subtitle: *Everything tied to your account has been removed. You are welcome back any time.*

Notice, rendered as the first child of `AuthShell` (above `GoogleButton`). Neutral, not green: nothing was "successful" from the user's point of view. Geometry matches `FormAlert`.

```tsx
{deleted && (
  <div role="status" className="mb-5 rounded-2xl px-4 py-3.5 border bg-gray-50 border-gray-200 text-[13px] font-medium leading-relaxed text-gray-700">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Deletion complete</p>
    Your profile, analyses, history, reports and workspace seats are gone and cannot be restored. Payment receipts and audit records are kept in anonymised form, as described in{' '}
    <Link to="/privacy#retention" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">Privacy policy §6</Link>.
  </div>
)}
```

The rest of the sign-in form stays below it so a returning person can create a fresh account without another click.
