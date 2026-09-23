import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, googleProvider } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { PrimaryButton } from '../components/UI';
import AuthShell from '../components/auth/AuthShell';
import { AuthField, PasswordStrength, FormAlert, GoogleButton, OrDivider } from '../components/auth/AuthField';
import { SecurityEngine } from '../services/securityEngine';
import { readAttribution, track } from '../services/analytics';
import { useAuth } from '../context/AuthContext';
import { callRequestPasswordReset, callSendWelcomeEmail } from '../services/persistenceService';

type Mode = 'signin' | 'signup' | 'forgot';

// Per-mode copy. Kept in one place so the heading, CTA, and switcher never drift apart.
const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busy: string }> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to pick up where you left off.',
    cta: 'Sign in',
    busy: 'Signing in',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Start free with a token allowance to try every tool. No card required.',
    cta: 'Create account',
    busy: 'Creating account',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter your email and we will send you a link to set a new password.',
    cta: 'Send reset link',
    busy: 'Sending',
  },
};

// Tab titles by mode. The page has no <Seo> (it must not be indexed), so it sets its own <head>.
const TAB_TITLE: Record<Mode, string> = {
  signin: 'Sign in | MarketBrain OS',
  signup: 'Create account | MarketBrain OS',
  forgot: 'Reset password | MarketBrain OS',
};

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [waitTimer, setWaitTimer] = useState<number | null>(null);

  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  // Settings -> delete account signs the user out and lands here with ?deleted=1.
  const [params, setParams] = useSearchParams();
  const deleted = params.get('deleted') === '1';

  // Completes a Google sign-in that went through the redirect fallback below (in-app browsers
  // block popups, so the page navigated away and came back here).
  useEffect(() => {
    let active = true;
    getRedirectResult(auth).then(async (cred) => {
      if (!active || !cred) return;
      /*
       * THE IN-APP BROWSER PATH COUNTS TOO. LinkedIn, Instagram and Facebook block the
       * popup and land here — and those are the channels the go-to-market plan actually
       * runs on, so a signup that completes by redirect and fires nothing would make the
       * one channel we are betting on look like it converts nobody.
       */
      const redirectIsNew = getAdditionalUserInfo(cred)?.isNewUser === true;
      if (redirectIsNew) track('sign_up', { method: 'google', ...readAttribution() });
      else track('login', { method: 'google' });
      if (redirectIsNew) callSendWelcomeEmail();
      await refreshProfile();
      navigate('/');
    }).catch((err) => { if (active) setError(err?.message || 'Google sign-in did not complete. Please try again.'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: number;
    if (waitTimer !== null && waitTimer > 0) {
      timer = window.setInterval(() => {
        setWaitTimer((prev) => (prev && prev > 0 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [waitTimer]);

  // Reset transient form state when the user switches between sign in / sign up / reset.
  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    if (next === 'forgot') setPassword('');
    if (deleted) setParams({}, { replace: true }); // the deletion notice is for the landing only
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const velocity = await SecurityEngine.checkLoginVelocity(email);
    if (!velocity.allowed) {
      setError(velocity.error || 'Too many attempts. Please wait a moment and try again.');
      if (velocity.waitSeconds) setWaitTimer(velocity.waitSeconds);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        /*
         * GTM E01 — the channel cohort's key (part 03 §7.3 table B). `signup_source` is
         * first-touch and comes from the visit, not from this form, which is why it is
         * read here rather than reconstructed from the referrer of the /auth page: by the
         * time somebody reaches the form the referrer is our own landing page.
         */
        track('sign_up', { method: 'email', ...readAttribution() });
        callSendWelcomeEmail(); // fire-and-forget welcome + verification email
        await refreshProfile();
        navigate('/');
      } else if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        track('login', { method: 'email' });
        await refreshProfile();
        navigate('/');
      } else {
        await callRequestPasswordReset(email);
        setSuccessMsg('If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(SecurityEngine.sanitizeErrorMessage(err.message || 'Authentication failed.'));
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNew = getAdditionalUserInfo(cred)?.isNewUser === true;
      /* The provider tells us which this was; guessing from a profile read would race it. */
      if (isNew) track('sign_up', { method: 'google', ...readAttribution() });
      else track('login', { method: 'google' });
      if (isNew) callSendWelcomeEmail(); // welcome for brand-new Google accounts
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      // Surface specific, actionable provider errors instead of a generic failure.
      const code = err?.code || '';
      let message: string;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        message = 'The Google window closed before sign-in finished. Please try again.';
      } else if (code === 'auth/popup-blocked') {
        // In-app browsers (Instagram, Facebook, LinkedIn) block popups and cannot be told to allow
        // them. Fall back to the redirect flow; getRedirectResult above finishes the sign-in.
        try { await signInWithRedirect(auth, googleProvider); return; } catch { /* fall through to the message */ }
        message = 'Your browser blocked the Google popup. Allow popups for this site, then retry.';
      } else if (code === 'auth/account-exists-with-different-credential') {
        message = 'An account already exists for this email using a different sign-in method. Use that method instead.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Could not reach Google. Check your connection and try again.';
      } else if (code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized for Google sign-in. Please contact support.';
      } else {
        message = SecurityEngine.sanitizeErrorMessage(err?.message || 'Google sign-in failed.');
      }
      setError(message);
      setLoading(false);
    }
  };

  // Post-deletion landing: neutral heading, nothing "succeeded" from the person's point of view.
  const showDeleted = deleted && mode === 'signin';
  const copy = showDeleted
    ? { ...COPY.signin, title: 'Account deleted', subtitle: 'Everything tied to your account has been removed. You are welcome back any time.' }
    : COPY[mode];
  const throttled = waitTimer !== null && waitTimer > 0;
  const canSubmit =
    !loading && !throttled && email.trim().length > 0 && (mode === 'forgot' || password.length > 0);

  const footer =
    mode === 'forgot' ? (
      <p className="text-center text-sm text-gray-600">
        Remembered it?{' '}
        <button onClick={() => switchMode('signin')} className="font-bold text-[#FF0000] hover:opacity-70 transition-opacity">
          Back to sign in
        </button>
      </p>
    ) : mode === 'signin' ? (
      <p className="text-center text-sm text-gray-600">
        New to MarketBrain OS?{' '}
        <button onClick={() => switchMode('signup')} className="font-bold text-[#FF0000] hover:opacity-70 transition-opacity">
          Create an account
        </button>
      </p>
    ) : (
      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <button onClick={() => switchMode('signin')} className="font-bold text-[#FF0000] hover:opacity-70 transition-opacity">
          Sign in
        </button>
      </p>
    );

  return (
    <AuthShell title={copy.title} subtitle={copy.subtitle} footer={footer}>
      <Helmet>
        <title>{TAB_TITLE[mode]}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {showDeleted && (
        <div role="status" className="mb-5 rounded-2xl px-4 py-3.5 border bg-gray-50 border-gray-200 text-[13px] font-medium leading-relaxed text-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Deletion complete</p>
          Your profile, analyses, history, reports and workspace seats are gone and cannot be restored. Payment receipts and audit records are kept in anonymised form, as described in{' '}
          <Link to="/privacy#s6" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">Privacy policy §6</Link>.
        </div>
      )}

      {/* Provider sign-in leads on the two account modes; it is the fastest path for most people. */}
      {mode !== 'forgot' && (
        <>
          <GoogleButton onClick={handleGoogleAuth} disabled={loading} label="Continue with Google" />
          <OrDivider label="or use email" />
        </>
      )}

      <form onSubmit={handleEmailAuth} noValidate>
        {error && <FormAlert tone="error">{error}</FormAlert>}
        {successMsg && <FormAlert tone="success">{successMsg}</FormAlert>}

        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoComplete="email"
          disabled={loading}
        />

        {mode !== 'forgot' && (
          <>
            <AuthField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={loading}
              action={
                mode === 'signin' ? (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-bold text-gray-500 hover:text-[#FF0000] uppercase tracking-widest transition-colors"
                  >
                    Forgot?
                  </button>
                ) : undefined
              }
            />
            {mode === 'signup' && <PasswordStrength password={password} />}
          </>
        )}

        <PrimaryButton type="submit" className="w-full !px-6" disabled={!canSubmit}>
          {throttled ? `Try again in ${waitTimer}s` : loading ? `${copy.busy}...` : copy.cta}
        </PrimaryButton>

        {mode === 'signup' && (
          <p className="mt-5 text-[12px] text-gray-500 leading-relaxed text-center">
            By creating an account you agree to our{' '}
            {/* Router links in a new tab: a plain <a> reloaded the app and lost the typed form. */}
            <Link to="/terms" target="_blank" rel="noopener" className="text-gray-700 font-bold hover:text-[#FF0000] transition-colors">Terms</Link> and{' '}
            <Link to="/privacy" target="_blank" rel="noopener" className="text-gray-700 font-bold hover:text-[#FF0000] transition-colors">Privacy Policy</Link>.
          </p>
        )}
      </form>
    </AuthShell>
  );
};

export default AuthPage;
