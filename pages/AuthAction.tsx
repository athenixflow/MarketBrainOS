// Branded Firebase auth-action handler (replaces Firebase's bare default page). Handles the links in
// our transactional emails: password reset, email verification, and email-change recovery.
//
// Link routing is handled in code (functions/src/index.ts brandActionLink rewrites the generated link
// host to /auth/action), so this page works without the Firebase Console "Customize action URL" setting.
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';
import { PrimaryButton } from '../components/UI';
import AuthShell from '../components/auth/AuthShell';
import { AuthField, PasswordStrength, FormAlert } from '../components/auth/AuthField';

type Phase = 'loading' | 'form' | 'success' | 'error';

const AuthAction: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') || '';
  const oobCode = params.get('oobCode') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!oobCode) {
        setPhase('error');
        setTitle('Invalid link');
        setMessage('This link is missing its security code. Please request a new one.');
        return;
      }
      try {
        if (mode === 'resetPassword') {
          const em = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) { setAccountEmail(em); setPhase('form'); }
        } else if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) {
            setTitle('Email verified');
            setMessage('Your email address is confirmed. You are all set to use everything MarketBrain OS has to offer.');
            setPhase('success');
          }
        } else if (mode === 'recoverEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) {
            setTitle('Email change reverted');
            setMessage('Your account email has been restored. If you did not request this change, reset your password to secure your account.');
            setPhase('success');
          }
        } else if (!cancelled) {
          setPhase('error');
          setTitle('Unsupported action');
          setMessage('This link type is not recognized. Please use the link from your most recent email.');
        }
      } catch {
        if (!cancelled) {
          setPhase('error');
          setTitle('Link expired or already used');
          setMessage('This link has expired or was already used. Request a new one and try again.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const strongEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!strongEnough) { setError('Use at least 8 characters.'); return; }
    if (!matches) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setTitle('Password updated');
      setMessage('Your new password is set. You can sign in with it now.');
      setPhase('success');
    } catch {
      setError('Could not reset the password. The link may have expired, so request a new one and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <AuthShell title="Checking your link" subtitle="One moment while we verify this request.">
        <div className="space-y-4" aria-busy="true">
          {/* Skeleton matching the form that is about to render. */}
          <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-[52px] w-full bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-[52px] w-full bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </AuthShell>
    );
  }

  if (phase === 'form') {
    return (
      <AuthShell
        title="Set a new password"
        subtitle={`Choose a new password for ${accountEmail}.`}
        footer={
          <p className="text-center text-sm text-gray-600">
            <Link to="/auth" className="font-bold text-[#FF0000] hover:opacity-70 transition-opacity">
              Back to sign in
            </Link>
          </p>
        }
      >
        <form onSubmit={submitReset} noValidate>
          {error && <FormAlert tone="error">{error}</FormAlert>}
          <AuthField
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={busy}
            autoFocus
          />
          <PasswordStrength password={password} />
          <AuthField
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            disabled={busy}
            error={confirm.length > 0 && !matches ? 'These passwords do not match.' : undefined}
          />
          <PrimaryButton type="submit" className="w-full !px-6" disabled={busy || !strongEnough || !matches}>
            {busy ? 'Saving...' : 'Save new password'}
          </PrimaryButton>
        </form>
      </AuthShell>
    );
  }

  // success / error share one confirmation layout.
  const ok = phase === 'success';
  return (
    <AuthShell title={title} subtitle={message}>
      <div
        className={`flex items-center gap-4 rounded-2xl border px-5 py-4 mb-8 ${
          ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5 h-5">
            {ok ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            )}
          </svg>
        </div>
        <p className={`text-[13px] font-bold ${ok ? 'text-green-800' : 'text-red-700'}`}>
          {ok ? 'All done' : 'We could not complete this'}
        </p>
      </div>

      <PrimaryButton onClick={() => navigate('/auth')} className="w-full !px-6">
        {ok ? 'Continue to sign in' : 'Back to sign in'}
      </PrimaryButton>
    </AuthShell>
  );
};

export default AuthAction;
