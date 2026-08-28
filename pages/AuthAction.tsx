// Branded Firebase auth-action handler (replaces Firebase's bare default page). Handles the links in
// our transactional emails: password reset, email verification, and email-change recovery.
// Firebase must be told to route action links here: Console → Authentication → Templates →
// "Customize action URL" → https://www.marketbrainos.app/auth/action
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';
import { Card, PrimaryButton, PageHeader, ErrorMessage } from '../components/UI';

type Phase = 'loading' | 'form' | 'success' | 'error';

// Password field styled to match the app's Input, with a show/hide toggle.
const PasswordField: React.FC<{
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; show: boolean; onToggle: () => void; name?: string;
}> = ({ label, value, onChange, placeholder, show, onToggle, name }) => (
  <div className="flex flex-col mb-8">
    <label className="text-xs font-bold text-gray-700 mb-5 tracking-widest uppercase">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'} name={name} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#FBFBFB] border border-gray-100 p-8 pr-16 rounded-[32px] focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 outline-none transition-all text-lg text-[#0B0B0B] placeholder:text-gray-400"
      />
      <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0B0B0B] transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
          {show
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
            : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>}
        </svg>
      </button>
    </div>
  </div>
);

const AuthAction: React.FC = () => {
  const [params] = useSearchParams();
  const mode = params.get('mode') || '';
  const oobCode = params.get('oobCode') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!oobCode) { setPhase('error'); setTitle('Invalid link'); setMessage('This link is missing its security code. Please request a new one.'); return; }
      try {
        if (mode === 'resetPassword') {
          const em = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) { setAccountEmail(em); setPhase('form'); }
        } else if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) { setTitle('Email verified'); setMessage('Your email address is confirmed — you’re all set to use everything MarketBrain OS has to offer.'); setPhase('success'); }
        } else if (mode === 'recoverEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) { setTitle('Email change reverted'); setMessage('Your account email has been restored. If you didn’t request this change, reset your password to secure your account.'); setPhase('success'); }
        } else {
          if (!cancelled) { setPhase('error'); setTitle('Unsupported action'); setMessage('This link type isn’t recognized. Please use the link from your most recent email.'); }
        }
      } catch {
        if (!cancelled) { setPhase('error'); setTitle('Link expired or already used'); setMessage('This link has expired or was already used. Request a new one and try again.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const strongEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;
  const strength = Math.min(4, (password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(password) ? 1 : 0) + (/[0-9]/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0));
  const strengthLabel = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][password.length < 8 ? 0 : strength];

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!strongEnough) { setError('Use at least 8 characters.'); return; }
    if (!matches) { setError('The two passwords don’t match.'); return; }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setTitle('Password updated'); setMessage('Your new password is set. You can sign in with it now.'); setPhase('success');
    } catch {
      setError('Couldn’t reset the password — the link may have expired. Request a new one and try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      <div className="max-w-xl mx-auto py-20 px-6 animate-in fade-in duration-1000">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-[#FF0000] rounded-xl flex items-center justify-center font-black text-white transform -rotate-6">M</div>
          <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">MarketBrain OS</span>
        </div>

        {phase === 'loading' && (
          <Card accent className="shadow-2xl">
            <div className="flex flex-col items-center py-10">
              <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mb-6 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.5em]">Verifying your link…</span>
            </div>
          </Card>
        )}

        {phase === 'form' && (
          <>
            <PageHeader title="Set a new password" subtitle={`Choose a new password for ${accountEmail}.`} />
            <Card accent className="shadow-2xl">
              <form onSubmit={submitReset}>
                <PasswordField label="New password" placeholder="At least 8 characters" value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} name="new-password" />
                {password.length > 0 && (
                  <div className="-mt-4 mb-8">
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength <= 1 ? 'bg-red-400' : strength === 2 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">{strengthLabel}</p>
                  </div>
                )}
                <PasswordField label="Confirm password" placeholder="Re-enter your new password" value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw((s) => !s)} name="confirm-password" />
                {error && <ErrorMessage message={error} />}
                <PrimaryButton type="submit" className="w-full mt-2" disabled={busy || !strongEnough || !matches}>{busy ? 'Saving…' : 'Save new password'}</PrimaryButton>
              </form>
            </Card>
            <p className="text-center text-[11px] font-bold text-gray-600 uppercase tracking-widest mt-8">
              <Link to="/auth" className="hover:text-white transition-colors">Back to sign in</Link>
            </p>
          </>
        )}

        {(phase === 'success' || phase === 'error') && (
          <>
            <PageHeader title={title} subtitle={message} />
            <Card accent className="shadow-2xl">
              <div className="flex flex-col items-center text-center py-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-8 ${phase === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    {phase === 'success'
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />}
                  </svg>
                </div>
                {phase === 'success'
                  ? <Link to="/auth"><PrimaryButton>Continue to sign in →</PrimaryButton></Link>
                  : <Link to="/auth"><PrimaryButton>Back to sign in</PrimaryButton></Link>}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthAction;
