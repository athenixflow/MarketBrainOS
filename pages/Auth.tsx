import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { PrimaryButton } from '../components/UI';
import AuthShell from '../components/auth/AuthShell';
import { AuthField, PasswordStrength, FormAlert, GoogleButton, OrDivider } from '../components/auth/AuthField';
import { SecurityEngine } from '../services/securityEngine';
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
    subtitle: 'Start free with a monthly token allowance. No card required.',
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
        callSendWelcomeEmail(); // fire-and-forget welcome + verification email
        await refreshProfile();
        navigate('/');
      } else if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
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
      if (getAdditionalUserInfo(cred)?.isNewUser) callSendWelcomeEmail(); // welcome for brand-new Google accounts
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

  const copy = COPY[mode];
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
            <a href="/terms" className="text-gray-700 font-bold hover:text-[#FF0000] transition-colors">Terms</a> and{' '}
            <a href="/privacy" className="text-gray-700 font-bold hover:text-[#FF0000] transition-colors">Privacy Policy</a>.
          </p>
        )}
      </form>
    </AuthShell>
  );
};

export default AuthPage;
