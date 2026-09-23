// MarketBrain OS — the analytics wrapper (GTM plan E01, part 03 §7).
//
// WHY THIS FILE EXISTS. Until now the product emitted ZERO analytics events. GA4 was
// initialised (after consent) and logged nothing, so every threshold the go-to-market plan
// turns on — activation ≥30%, W4 ≥30%, free→paid ≥3%, "no paid spend until those are
// observed" — was unmeasurable, and the decision to spend money would have been taken on
// feel. A gate nobody can read is not a gate.
//
// THREE RULES GOVERN EVERYTHING BELOW.
//
// 1. CONSENT IS THE ENFORCEMENT POINT, NOT A FLAG WE CHECK WHEN WE REMEMBER. `track()` asks
//    `readStoredConsent()` on every call and drops the event when the answer is anything but
//    yes. Nothing is queued for later: a queue flushed after Accept would send the browsing
//    somebody did BEFORE they agreed, which is exactly what the consent banner was built to
//    stop. An event dropped is an event that never existed.
//
// 2. ANALYTICS MAY NEVER BREAK A SCREEN. Every call is wrapped; an ad-blocker, a failed
//    gtag load, a private window with storage denied, or an unsupported browser must cost a
//    dropped event and nothing else. This is a marketing measurement, not a product feature.
//
// 3. THE SERVER IS THE SOURCE OF TRUTH FOR THE GATES. Ad-blockers eat 10–40% of GA4 traffic,
//    so activation and retention are computed in `growth_daily` from `action_logs` and
//    `users` server-side (part 03 §7.5). GA4 answers acquisition and attribution — where
//    people came from and what they clicked — which the server cannot see. Where the two
//    disagree about a run happening, the server is right.
//
// Naming follows GA4: snake_case, ≤40 chars, ≤25 params, and the reserved names (`sign_up`,
// `login`, `purchase`) keep their standard meaning so GA4's own reports work.

import { logEvent as firebaseLogEvent } from 'firebase/analytics';
import {
  analytics, CONSENT_ANALYTICS_YES, CONSENT_STORAGE_KEY, readStoredConsent,
} from './firebase';

/* ------------------------------------------------------------------ the event vocabulary */

/**
 * The events this pass instruments — the funnel the plan's own gates are defined over
 * (part 03 §7.1). The spec lists ~35; the ones missing here (share, referral, docs, NPS,
 * experiment exposure) belong to features that do not exist yet, and an event fired by
 * nothing is how a dashboard comes to show a confident zero.
 */
export type AnalyticsEvent =
  // acquisition
  | 'landing_view'
  | 'sign_up'              // GA4 standard
  | 'login'                // GA4 standard
  // activation — the path to the "Second Decision"
  | 'tool_viewed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'result_saved'
  | 'export_clicked'
  // monetisation
  | 'token_wall_viewed'
  | 'token_wall_action'
  | 'pricing_viewed'
  | 'upgrade_clicked'
  // the share loop (part 03 §5) — created here, viewed on the server-rendered page
  | 'share_link_created'
  // the public scorer (part 10) — the only funnel step an anonymous visitor reaches
  | 'free_tool_run'
  | 'free_tool_unlock_clicked';

/** Params carried on every event, so any funnel can be cut by plan, scope and cohort. */
interface GlobalParams {
  plan_tier?: string;
  scope_type?: string;
  signup_source?: string;
  cohort_week?: string;
  is_activated?: boolean;
}

let globalParams: GlobalParams = {};

/**
 * Set the ambient context for subsequent events. Called from a provider as auth and scope
 * resolve; every field is optional because the early events (a landing view) legitimately
 * have none of it.
 */
export const setAnalyticsContext = (params: GlobalParams): void => {
  globalParams = { ...globalParams, ...params };
};

/* --------------------------------------------------------------------- first-touch source */

/**
 * WHERE SOMEBODY CAME FROM, captured on the first page of the visit and never overwritten.
 *
 * FIRST-TOUCH, deliberately: the plan attributes a signup to the channel that produced the
 * visitor, and last-touch would credit the direct visit somebody makes after thinking it
 * over — flattering every channel except the one that actually worked.
 *
 * IT LIVES IN MEMORY UNTIL CONSENT. A visitor who lands from LinkedIn and signs up in the
 * same session is attributed correctly with no storage write at all. Persisting across
 * sessions needs storage, and storing a marketing identifier before somebody has agreed to
 * analytics would take back with one hand what the consent banner gives with the other.
 * Consequence, stated: a visitor who declines analytics and returns days later reads as
 * `direct`. That is the honest cost of the promise, not an oversight.
 */
const ATTRIBUTION_KEY = 'mbos_attribution';

export interface Attribution {
  signup_source: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
}

let sessionAttribution: Attribution | null = null;

const attributionFromStorage = (): Attribution | null => {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? JSON.parse(raw) as Attribution : null;
  } catch { return null; }
};

/**
 * Derive the source from the URL and the referrer, once per session.
 *
 * `signup_source` is the one string the plan's channel cohort table is keyed on (part 03
 * §7.3 table B), so it is deliberately coarse and never null: utm_source when the link was
 * tagged, else the referring host, else 'direct'.
 */
export const captureAttribution = (): Attribution => {
  if (sessionAttribution) return sessionAttribution;

  const stored = attributionFromStorage();
  if (stored) { sessionAttribution = stored; return stored; }

  let params: URLSearchParams;
  try { params = new URLSearchParams(window.location.search); } catch { params = new URLSearchParams(); }

  const utmSource = params.get('utm_source') || undefined;
  const ref = params.get('ref') || undefined;

  let referrerHost = '';
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      // Our own pages are not a source; an internal navigation is not an arrival.
      if (host && host !== window.location.hostname.replace(/^www\./, '')) referrerHost = host;
    }
  } catch { /* a malformed referrer is no referrer */ }

  const attribution: Attribution = {
    signup_source: utmSource || ref || referrerHost || 'direct',
    utm_source: utmSource,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    ref,
  };

  sessionAttribution = attribution;
  persistAttribution();
  return attribution;
};

/** Write the captured source to storage — only ever with consent (see the note above). */
export const persistAttribution = (): void => {
  if (!sessionAttribution) return;
  if (readStoredConsent() !== CONSENT_ANALYTICS_YES) return;
  try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(sessionAttribution)); } catch { /* storage denied */ }
};

/** What the signup call sends to the server, so `users.signup_source` survives the session. */
export const readAttribution = (): Attribution =>
  sessionAttribution ?? attributionFromStorage() ?? { signup_source: 'direct' };

/* ------------------------------------------------------------------------------ the wrapper */

/** ISO week, as `2026-W38` — the cohort key every retention table in part 03 §7.3 uses. */
export const cohortWeek = (at: Date = new Date()): string => {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  // ISO-8601: week 1 is the week containing the first Thursday, so shift to that Thursday.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** GA4 rejects a param whose value is undefined/null; strip rather than send an empty key. */
const clean = (params: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    // Long strings are truncated by GA4 anyway; do it here so what we send is what we see.
    out[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  return out;
};

/**
 * Send one event, or drop it.
 *
 * Dropped — never queued — when consent is absent, when analytics never started, or when
 * anything at all throws. The return value says which happened, so a test can assert the
 * consent gate holds without reading GA4's network traffic.
 */
export const track = (
  event: AnalyticsEvent,
  params: Record<string, unknown> = {},
): 'sent' | 'no_consent' | 'unavailable' => {
  if (readStoredConsent() !== CONSENT_ANALYTICS_YES) return 'no_consent';
  if (!analytics) return 'unavailable';
  try {
    /*
     * The cast is for the SDK's typings, not to dodge them. Firebase puts GA4's reserved
     * names (`sign_up`, `login`, `purchase`) on their own overloads with fixed param
     * shapes, and excludes them from the generic one — so a wrapper that carries both
     * reserved and custom names in one union cannot satisfy either overload. We want the
     * reserved names spelled exactly as GA4 expects, which is what makes GA4's built-in
     * funnels work, so the union stays and the call goes through the generic form.
     */
    firebaseLogEvent(
      analytics,
      event as Parameters<typeof firebaseLogEvent>[1],
      clean({ ...globalParams, ...params }),
    );
    return 'sent';
  } catch {
    // An ad-blocker, an unsupported browser, a transport failure. Never the caller's problem.
    return 'unavailable';
  }
};

/** Exported for the browser harness, which asserts the key it watches is the one we read. */
export const ANALYTICS_CONSENT_KEY = CONSENT_STORAGE_KEY;
