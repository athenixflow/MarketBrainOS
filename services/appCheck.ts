/**
 * APP CHECK (GTM DO-NOW #9, growth-engine §3 item 7).
 *
 * App Check attests that a request came from OUR app, not from somebody holding our public
 * Firebase config — which every visitor holds, because it ships in the bundle. It is a
 * defence against a scripted client replaying `executeAnalysis` against stolen accounts or
 * burning our Gemini budget, and it is not a defence against a user misbehaving in the real
 * app. That distinction decides where it belongs.
 *
 * WHERE IT IS NOT: the public scorer. `publicPageScore` answers any origin on purpose —
 * that CORS header is what lets a score be embedded in somebody else's page, which is the
 * whole of the badge loop. Attestation would mean the scorer runs on marketbrainos.app and
 * nowhere else, killing the loop to stop abuse the IP cap, the daily ceiling, the 24-hour
 * cache and the kill switch already bound. The playbook asks for both in different parts
 * and never reconciles them; this is the reconciliation.
 *
 * IT FAILS OPEN, HERE AND ON THE SERVER. No key configured, reCAPTCHA blocked by an
 * extension, a network that eats the attestation call — none of those are reasons to stop
 * somebody running an analysis they paid for. The server logs what it saw and only refuses
 * when enforcement is switched on deliberately, after the logs show real traffic passing.
 */

import { getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, AppCheck } from 'firebase/app-check';

/* Public by design, like the rest of firebaseConfig: a site key is readable in any page
   that uses it. Empty until one is configured, which is the no-op case. */
const SITE_KEY = (process.env.RECAPTCHA_SITE_KEY as string | undefined) || '';

let appCheck: AppCheck | null = null;
let started = false;

export const appCheckConfigured = (): boolean => Boolean(SITE_KEY);

/**
 * Start attestation. Safe to call more than once; safe to call with no key.
 *
 * Called from `firebase.ts` right after the app initialises, because a token has to be
 * obtainable before the first request that wants one — and the first analysis can be
 * seconds after load.
 */
export const startAppCheck = (): void => {
  if (started || !SITE_KEY || typeof window === 'undefined') return;
  started = true;
  try {
    /*
     * THE DEBUG PROVIDER, FOR LOCALHOST AND THE HARNESS. Without this every local run and
     * every Puppeteer check fails attestation against a key registered to the production
     * domain — so the first thing the guard rails would break is the guard rails. The flag
     * is read by the SDK before init and is dead code in a production build, since
     * `import.meta.env.DEV` is replaced with `false` and the branch is dropped.
     */
    if (import.meta.env.DEV) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(getApp(), {
      provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    /* A failed start must never take the app down with it. */
    console.warn('[appcheck] could not start:', e);
    appCheck = null;
  }
};

/**
 * The header for an `onRequest` function.
 *
 * Callables attach this themselves; `executeAnalysis` is a plain HTTP function, so it has
 * to be attached by hand — and verified by hand on the other side. Returns an empty object
 * on every failure path, which is what makes the whole thing fail open.
 */
export const appCheckHeader = async (): Promise<Record<string, string>> => {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, /* forceRefresh */ false);
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    return {};
  }
};
