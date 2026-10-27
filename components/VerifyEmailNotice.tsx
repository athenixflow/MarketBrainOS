/**
 * Invitations (team, agency, enterprise) can only be read once the email address is verified: the
 * Firestore rules require it, so an unverified invitee used to see an empty page with no reason.
 * This says why, sends a fresh link, and re-checks once they have clicked it (the ID token only
 * carries the new email_verified after a reload and refresh).
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { callResendVerification } from '../services/persistenceService';
import { Card, PrimaryButton, SecondaryButton, ErrorMessage, SuccessMessage } from './UI';

const VerifyEmailNotice: React.FC<{ onVerified: () => void }> = ({ onVerified }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setBusy('send'); setMsg(null);
    try {
      const r = await callResendVerification();
      setMsg(r.alreadyVerified ? { ok: true, text: 'Your email is already verified. Press "I\'ve verified".' }
        : { ok: true, text: `Sent. Check ${user.email} (and spam) for "Confirm your email address".` });
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Could not send the email.' }); }
    setBusy(null);
  };

  const recheck = async () => {
    setBusy('check'); setMsg(null);
    try {
      await user.reload();
      await user.getIdToken(true);
      if (user.emailVerified) onVerified();
      else setMsg({ ok: false, text: 'Not verified yet. Open the link in the email, then try again.' });
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Could not check right now.' }); }
    setBusy(null);
  };

  return (
    <Card title="Verify your email to see invitations">
      <p className="text-sm text-gray-600 font-medium mb-6 leading-relaxed">
        Invitations to a team, agency or enterprise only show once your email address is confirmed.
        We can send the link to <span className="font-bold text-[#0B0B0B]">{user.email}</span> again.
      </p>
      {msg && (msg.ok ? <SuccessMessage message={msg.text} className="mb-4" /> : <ErrorMessage message={msg.text} className="mb-4" />)}
      <div className="flex flex-wrap gap-3">
        <PrimaryButton size="sm" onClick={resend} disabled={busy !== null}>{busy === 'send' ? 'Sending…' : 'Resend email'}</PrimaryButton>
        <SecondaryButton size="sm" onClick={recheck} disabled={busy !== null}>{busy === 'check' ? 'Checking…' : "I've verified"}</SecondaryButton>
      </div>
    </Card>
  );
};

export default VerifyEmailNotice;
