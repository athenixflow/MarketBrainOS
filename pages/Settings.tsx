// Settings — account management hub. Real where supported (Profile, Account, Security via
// Firebase, Notifications, Subscription, Billing); polished "Coming soon" stubs for features
// without backend yet (2FA, sessions, login history, integrations, invoices). Profile/account/
// notification writes go through updateUserProfile (allowlisted; economy fields stay server-only).

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  updatePassword, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
} from 'firebase/auth';
import {
  PageHeader, Card, PrimaryButton, SecondaryButton, Input, Select, Tabs, ComingSoon, LoadingState,
  SuccessMessage, ErrorMessage, Skeleton, EmptyState, LedgerRow,
} from '../components/UI';
import { GoogleButton } from '../components/auth/AuthField';
import SubscriptionPanel from '../components/SubscriptionPanel';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { googleProvider } from '../services/firebase';
import {
  updateUserProfile, getUserPaymentHistory, callRequestPasswordReset, callDeleteAccount, DeleteAccountResult,
} from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord, NotificationPrefs } from '../types';
import { canSeeFeature, tierAtLeast } from '../config/access';
import { SecurityEngine } from '../services/securityEngine';

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Hindi', 'Chinese'];

const toOptions = (values: string[], placeholder: string) => [
  { value: '', label: placeholder },
  ...values.map((v) => ({ value: v, label: v })),
];

// --- small local pieces ---
const Toggle: React.FC<{ label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }> =
  ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between gap-6 py-5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#0B0B0B]">{label}</p>
        {description && <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${checked ? 'bg-[#FF0000]' : 'bg-gray-200'}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

// A roadmap item: something the product will do, shown with a single shared "Coming soon" badge.
const RoadmapRow: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-bold text-[#0B0B0B]">{title}</p>
      <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>
    </div>
    <ComingSoon className="shrink-0" />
  </div>
);

// Save feedback: the tone is tracked explicitly rather than inferred from the message text.
const Flash: React.FC<{ msg: string; error: boolean }> = ({ msg, error }) =>
  msg ? (error ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />) : null;

// Where a container's settings live, for the refusal state's "archive or transfer first" links.
const CONTAINER_PATH: Record<string, string> = { workspace: '/team', agency: '/agency', enterprise: '/enterprise' };
const sum = (counts: Record<string, number> | undefined, keys: string[]) => keys.reduce((n, k) => n + (counts?.[k] || 0), 0);

const Settings: React.FC = () => {
  const { user, profile, refreshProfile, profileError, signOut } = useAuth();
  const { memberships } = useScope();
  const navigate = useNavigate();
  const accessCtx = { profile, memberships };

  const showWorkspace = tierAtLeast(profile?.tier, 'team') || memberships.some(m => m.family === 'workspace');
  const tabs = useMemo(
    () => ['Profile', 'Account', 'Security', 'Notifications', 'Subscription', 'Billing', 'Integrations', ...(showWorkspace ? ['Workspace'] : [])],
    [showWorkspace]);
  const [activeTab, setActiveTab] = useState('Profile');

  // --- profile/account form state (seeded from profile) ---
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_name: '', job_title: '', bio: '',
    username: '', timezone: '', language: '',
  });
  const [prefs, setPrefs] = useState<NotificationPrefs>({ analysis: true, token: true, product: true, workspace: true, email: true });

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name || '', last_name: profile.last_name || '',
      company_name: profile.company_name || '', job_title: profile.job_title || '',
      bio: profile.bio || '', username: profile.username || '',
      timezone: profile.timezone || '', language: profile.language || '',
    });
    setPrefs({
      analysis: profile.notification_prefs?.analysis ?? true,
      token: profile.notification_prefs?.token ?? true,
      product: profile.notification_prefs?.product ?? true,
      workspace: profile.notification_prefs?.workspace ?? true,
      email: profile.notification_prefs?.email ?? true,
    });
  }, [profile]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState(false);
  const saveProfile = async (fields: Partial<typeof form>) => {
    if (!user) return;
    setSavingProfile(true); setProfileMsg(''); setProfileErr(false);
    try {
      await updateUserProfile(user.uid, fields);
      await refreshProfile();
      setProfileMsg('Saved.');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (e: any) {
      setProfileErr(true);
      setProfileMsg(e.message || 'Save failed.');
    } finally { setSavingProfile(false); }
  };

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState('');
  const [prefsErr, setPrefsErr] = useState(false);
  const savePrefs = async (next: NotificationPrefs) => {
    setPrefs(next);
    if (!user) return;
    setSavingPrefs(true); setPrefsMsg(''); setPrefsErr(false);
    try {
      await updateUserProfile(user.uid, { notification_prefs: next });
      await refreshProfile();
      setPrefsMsg('Preferences saved.');
      setTimeout(() => setPrefsMsg(''), 3000);
    } catch (e: any) { setPrefsErr(true); setPrefsMsg(e.message || 'Save failed.'); }
    finally { setSavingPrefs(false); }
  };

  // --- security ---
  const isPasswordUser = !!user?.providerData?.some(p => p.providerId === 'password');
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [securityMsg, setSecurityMsg] = useState(''); const [securityErr, setSecurityErr] = useState(false);
  const sendReset = async () => {
    if (!user || !user.email) return;
    setSecurityMsg(''); setSecurityErr(false);
    try { await callRequestPasswordReset(user.email); setSecurityMsg('Password reset email sent.'); }
    catch (e: any) { setSecurityErr(true); setSecurityMsg(e.message || 'Could not send reset email.'); }
  };
  const changePassword = async () => {
    if (!user || !user.email) return;
    setSecurityMsg(''); setSecurityErr(false);
    if (pwd.next.length < 6) { setSecurityErr(true); setSecurityMsg('New password must be at least 6 characters.'); return; }
    try {
      const cred = EmailAuthProvider.credential(user.email, pwd.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwd.next);
      setPwd({ current: '', next: '' });
      setSecurityMsg('Password updated.');
    } catch (e: any) { setSecurityErr(true); setSecurityMsg(e.message || 'Could not update password.'); }
  };

  // --- danger zone: account deletion (docs/qa-fix-deletion-flow.md) ---
  // Check (dry run) → Verify (re-auth) → Confirm (type DELETE) → sign out → /auth?deleted=1.
  type CheckState = { status: 'idle' | 'checking' | 'ready' | 'refused' | 'failed'; manifest?: DeleteAccountResult };
  const [confirming, setConfirming] = useState(false);
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const [confirmText, setConfirmText] = useState('');
  const [reauthPwd, setReauthPwd] = useState('');
  const [reauthed, setReauthed] = useState(false);          // Google users, after reauthenticateWithPopup
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const canDelete = check.status === 'ready' && confirmText === 'DELETE' && (isPasswordUser ? reauthPwd.length > 0 : reauthed) && !deleting;

  const runCheck = async () => {
    setCheck({ status: 'checking' }); setDeleteError('');
    try {
      const manifest = await callDeleteAccount({ confirm: 'DELETE', dryRun: true });
      setCheck({ status: manifest.refusal ? 'refused' : 'ready', manifest });
    } catch {
      setCheck({ status: 'failed' });
      setDeleteError("We couldn't check your account. Check your connection and try again.");
    }
  };
  const openDeletion = () => { setConfirming(true); runCheck(); };
  const closeDeletion = () => {
    setConfirming(false); setCheck({ status: 'idle' });
    setConfirmText(''); setReauthPwd(''); setReauthed(false); setDeleteError('');
  };

  const reauthWithGoogle = async () => {
    if (!user) return;
    setDeleteError('');
    try { await reauthenticateWithPopup(user, googleProvider); setReauthed(true); }
    catch (err: any) {
      const code = err?.code || '';
      setDeleteError(
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? 'The Google window closed before we could verify you.'
        : code === 'auth/popup-blocked' ? 'Your browser blocked the Google popup. Allow popups for this site, then retry.'
        : code === 'auth/user-mismatch' ? 'That Google account is not the one you are signed in with.'
        : SecurityEngine.sanitizeErrorMessage(err?.message || 'Google verification failed.'));
    }
  };

  const deleteAccountNow = async () => {
    if (!user || !canDelete) return;
    setDeleteError('');
    // Step 1: fresh client credential. Password users prove it here; Google users already did.
    if (isPasswordUser) {
      try {
        if (!user.email) throw new Error('No email on this account.');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, reauthPwd));
      } catch (err: any) {
        const code = err?.code || '';
        setDeleteError(code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials'
          ? "That password doesn't match. Nothing was deleted."
          : code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes and try again. Nothing was deleted.'
          : SecurityEngine.sanitizeErrorMessage(err?.message || 'Could not verify your password.'));
        return;
      }
    }
    // Step 2: the callable carries the new auth_time (server refuses anything older than 5 minutes).
    setDeleting(true);
    try {
      await user.getIdToken(true);
      const result = await callDeleteAccount({ confirm: 'DELETE' });
      if (result.refusal) { setCheck({ status: 'refused', manifest: result }); setDeleting(false); return; }
      // Sign out first, or the /auth route's `user ? <Navigate to="/" />` fires.
      await signOut();
      navigate('/auth?deleted=1', { replace: true });
    } catch (err: any) {
      setDeleting(false);
      const code = (err?.code || '').toString().replace(/^functions\//, '');
      const details = err?.details || {};
      if (code === 'failed-precondition' && Array.isArray(details.containers)) {
        // Ownership changed mid-flow: show the same refusal state as the check.
        setCheck({ status: 'refused', manifest: { ok: false, deleted: {}, retained: [], refusal: details } });
      } else if (code === 'failed-precondition' && details.reason === 'reauth-required') {
        setReauthed(false); setReauthPwd('');
        setDeleteError('Your verification expired. Verify again to continue.');
      } else if (code === 'permission-denied') {
        setDeleteError(err?.message || 'Admin accounts are deleted from the admin console.');
      } else if (code === 'unauthenticated' || err?.code === 'auth/requires-recent-login') {
        setDeleteError('Please sign out, sign in again, and retry.');
      } else {
        setDeleteError(SecurityEngine.sanitizeErrorMessage(err?.message || 'Deletion did not finish. Nothing you did caused this; try again in a moment.'));
      }
    }
  };

  // --- billing ---
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsErr, setPaymentsErr] = useState<string | null>(null);
  useEffect(() => {
    if (!user || activeTab !== 'Billing') return;
    setLoadingPayments(true);
    setPaymentsErr(null);
    getUserPaymentHistory(user.uid)
      .then(setPayments)
      .catch(() => setPaymentsErr('We could not load your transactions. Please try again.'))
      .finally(() => setLoadingPayments(false));
  }, [user, activeTab]);

  // While the server purges, the profile read may already fail; this must win over the retry card below.
  if (deleting) return <LoadingState message="Deleting your account" />;

  if (!profile) {
    // Spun forever when the read failed; now it says so and offers a retry.
    if (profileError) {
      return (
        <div className="max-w-md">
          <ErrorMessage message={`We couldn't load your account: ${profileError}`} />
          <SecondaryButton onClick={() => refreshProfile()} className="mt-6" tone="dark">Retry</SecondaryButton>
        </div>
      );
    }
    return <LoadingState message="Loading your settings" />;
  }
  const initials = (profile.first_name?.[0] || profile.email?.[0] || 'U').toUpperCase();
  const isFree = profile.tier === 'free';

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, account, security, notifications, and subscription." />
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ---------- PROFILE ---------- */}
      {activeTab === 'Profile' && (
        <Card>
          <div className="flex flex-wrap items-center gap-6 mb-10">
            <div className="w-20 h-20 rounded-full bg-[#FF0000] text-white flex items-center justify-center text-2xl font-black shrink-0">{initials}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0B0B0B] truncate">{[form.first_name, form.last_name].filter(Boolean).join(' ') || profile.email}</p>
              <div className="mt-2"><ComingSoon label="Photo upload coming soon" /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Input label="First name" placeholder="Your first name" autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
            <Input label="Last name" placeholder="Your last name" autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
            <Input label="Company" placeholder="Where you work" autoComplete="organization" value={form.company_name} onChange={set('company_name')} />
            <Input label="Job title" placeholder="Your role" autoComplete="organization-title" value={form.job_title} onChange={set('job_title')} />
          </div>
          <Input label="Bio" placeholder="A short description of you and what you do" value={form.bio} onChange={set('bio')} multiline />
          <PrimaryButton onClick={() => saveProfile({ first_name: form.first_name, last_name: form.last_name, company_name: form.company_name, job_title: form.job_title, bio: form.bio })} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </PrimaryButton>
          <Flash msg={profileMsg} error={profileErr} />
        </Card>
      )}

      {/* ---------- ACCOUNT ---------- */}
      {activeTab === 'Account' && (
        <>
        <Card>
          <Input
            label="Email address"
            placeholder=""
            value={profile.email}
            onChange={() => {}}
            disabled
            labelRight={<ComingSoon label="Changes coming soon" />}
          />
          <Input label="Username" placeholder="Choose a username" autoComplete="username" value={form.username} onChange={set('username')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Select label="Time zone" value={form.timezone} options={toOptions(TIMEZONES, 'Select a time zone')} onChange={(v) => setForm(f => ({ ...f, timezone: v }))} />
            <Select label="Language" value={form.language} options={toOptions(LANGUAGES, 'Select a language')} onChange={(v) => setForm(f => ({ ...f, language: v }))} />
          </div>
          <PrimaryButton onClick={() => saveProfile({ username: form.username, timezone: form.timezone, language: form.language })} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save account'}
          </PrimaryButton>
          <Flash msg={profileMsg} error={profileErr} />
        </Card>

        {/* ---------- DANGER ZONE (Privacy §8; flow in docs/qa-fix-deletion-flow.md) ---------- */}
        <Card className="mt-6 !border-red-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#B91C1C] mb-3">Danger zone</p>
          <h3 className="text-lg font-bold tracking-tight text-[#0B0B0B] mb-3">Delete your account</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-3">
            This permanently deletes your profile, saved analyses, history, reports, notifications and your seats in any workspace. Unused tokens are forfeited and cannot be refunded.
          </p>
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
            Payment receipts and audit records are kept for as long as the law requires, with your name and email replaced by an anonymous id (<Link to="/privacy#s6" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">Privacy policy §6</Link>).
          </p>

          {!confirming ? (
            <SecondaryButton tone="danger" onClick={openDeletion}>Delete account</SecondaryButton>
          ) : (
            <div role="group" aria-label="Confirm account deletion" aria-busy={check.status === 'checking'} className="p-5 sm:p-6 rounded-2xl bg-red-50 border border-red-100 animate-in fade-in duration-300">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#B91C1C] mb-5">Confirm deletion</p>

              {check.status === 'checking' && (
                <p className="text-sm text-gray-500 font-medium mb-6">Checking your account…</p>
              )}

              {check.status === 'refused' && check.manifest?.refusal && (() => {
                const r = check.manifest.refusal;
                return r.reason === 'suspended' ? (
                  <p className="text-sm text-gray-600 font-medium leading-relaxed mb-6">
                    This account is suspended, so it has to be closed by support. Email{' '}
                    <a href="mailto:support@marketbrainos.app" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">support@marketbrainos.app</a> and we will take it from there.
                  </p>
                ) : (
                  <div className="mb-6">
                    <p className="text-sm font-bold text-[#0B0B0B] mb-2">You still own {r.containers.length} team{r.containers.length === 1 ? '' : 's'}.</p>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
                      Before you can delete your account, archive {r.containers.length === 1 ? 'it' : 'each one'} or hand it to another member. Archive from its Settings tab; transfer from Members → Make owner (you stay on as admin), then come back here.
                    </p>
                    <ul className="space-y-2">
                      {r.containers.map((c) => (
                        <li key={`${c.kind}_${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-red-100">
                          <span className="text-sm font-bold text-[#0B0B0B] min-w-0 truncate">{c.name}</span>
                          <Link to={CONTAINER_PATH[c.kind] || '/'} className="text-[10px] font-bold uppercase tracking-widest text-[#FF0000] hover:text-[#D40000] transition-colors whitespace-nowrap">
                            {c.kind} settings →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {check.status === 'ready' && (() => {
                const d = check.manifest?.deleted;
                const analyses = sum(d, ['tool_analysis_results', 'angleminer_results', 'testlab_results', 'conversion_doctor_results', 'workflow_runs']);
                const reports = d?.reports || 0;
                const sentInvites = sum(d, ['workspace_invitations_sent', 'agency_invitations_sent', 'enterprise_invitations_sent']);
                const myInvites = sum(d, ['workspace_invitations', 'agency_invitations', 'enterprise_invitations']);
                const paid = profile.tier !== 'free' && profile.subscription_status !== 'cancelled';
                const tierLabel = profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1);
                return (
                  <div className="mb-6 space-y-3 text-sm text-gray-600 font-medium leading-relaxed">
                    <p><strong className="text-[#0B0B0B]">Deleted now:</strong> your profile, sign-in, every analysis and report you created — including ones shared with your team — your history, notifications, memberships and open invitations.</p>
                    <p><strong className="text-[#0B0B0B]">Kept:</strong> payment records and security logs, because the law and our accountants require them (<Link to="/privacy#s6" className="font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">Privacy Policy §6</Link>). Your name and email are removed from them; only a scrambled reference remains.</p>
                    {(analyses > 0 || reports > 0) && (
                      <p>{analyses} {analyses === 1 ? 'analysis' : 'analyses'} and {reports} {reports === 1 ? 'report' : 'reports'} you created will be deleted.</p>
                    )}
                    {paid && (
                      <p>Your <strong className="text-[#0B0B0B]">{tierLabel}</strong> plan ends immediately. <strong className="text-[#0B0B0B]">{profile.monthly_tokens ?? profile.tokens}</strong> monthly and <strong className="text-[#0B0B0B]">{profile.purchased_tokens ?? 0}</strong> purchased tokens are forfeited — they are not refunded and cannot move to another account. If you want to spend them first, keep your account and come back later.</p>
                    )}
                    {sentInvites > 0 && <p>{sentInvites} {sentInvites === 1 ? 'invitation' : 'invitations'} you sent will be withdrawn.</p>}
                    {myInvites > 0 && <p>{myInvites} {myInvites === 1 ? 'invitation' : 'invitations'} waiting for you will be removed.</p>}
                  </div>
                );
              })()}

              {check.status === 'ready' && (
                <>
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
                </>
              )}

              {/* Live region is always present so the first error is announced, not just later ones. */}
              <div aria-live="polite">
                {deleteError && <ErrorMessage message={deleteError} className="mb-6" />}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {check.status === 'ready' && (
                  <PrimaryButton danger onClick={deleteAccountNow} disabled={!canDelete} className="w-full sm:w-auto">
                    {deleting ? 'Deleting…' : 'Delete my account permanently'}
                  </PrimaryButton>
                )}
                {check.status === 'failed' && (
                  <SecondaryButton onClick={runCheck}>Retry</SecondaryButton>
                )}
                <SecondaryButton onClick={closeDeletion} disabled={deleting}>
                  {check.status === 'ready' ? 'Keep my account' : 'Close'}
                </SecondaryButton>
              </div>
            </div>
          )}
        </Card>
        </>
      )}

      {/* ---------- SECURITY ---------- */}
      {activeTab === 'Security' && (
        <div className="space-y-6">
          <Card title="Password">
            {isPasswordUser ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <Input label="Current password" type="password" autoComplete="current-password" placeholder="Enter your current password" value={pwd.current} onChange={(e) => setPwd(p => ({ ...p, current: e.target.value }))} />
                  <Input label="New password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={pwd.next} onChange={(e) => setPwd(p => ({ ...p, next: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-4">
                  <PrimaryButton onClick={changePassword}>Update password</PrimaryButton>
                  <SecondaryButton onClick={sendReset}>Send reset email</SecondaryButton>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">You signed in with Google, so there is no password to change here. You can still send a reset email to set one.</p>
                <SecondaryButton onClick={sendReset}>Send password reset email</SecondaryButton>
              </>
            )}
            <Flash msg={securityMsg} error={securityErr} />
          </Card>
          <Card title="Advanced security">
            <div className="space-y-3">
              <RoadmapRow title="Two-factor authentication" description="Add a second step at sign-in for extra protection." />
              <RoadmapRow title="Active sessions" description="See and revoke devices currently signed in." />
              <RoadmapRow title="Login history" description="Review recent sign-in activity on your account." />
            </div>
          </Card>
        </div>
      )}

      {/* ---------- NOTIFICATIONS ---------- */}
      {activeTab === 'Notifications' && (
        <Card title="Notification preferences">
          <Toggle label="Analysis complete" description="When an analysis finishes running." checked={!!prefs.analysis} onChange={(v) => savePrefs({ ...prefs, analysis: v })} />
          <Toggle label="Token alerts" description="Low balance and top-up confirmations." checked={!!prefs.token} onChange={(v) => savePrefs({ ...prefs, token: v })} />
          <Toggle label="Product updates" description="New features and improvements." checked={!!prefs.product} onChange={(v) => savePrefs({ ...prefs, product: v })} />
          <Toggle label="Workspace notifications" description="Member, client, and report activity." checked={!!prefs.workspace} onChange={(v) => savePrefs({ ...prefs, workspace: v })} />
          <Toggle label="Email" description="Master switch for the email channel." checked={!!prefs.email} onChange={(v) => savePrefs({ ...prefs, email: v })} />
          <Flash msg={prefsMsg} error={prefsErr} />
          {savingPrefs && <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saving…</p>}
        </Card>
      )}

      {/* ---------- SUBSCRIPTION ---------- */}
      {activeTab === 'Subscription' && <SubscriptionPanel />}

      {/* ---------- BILLING ---------- */}
      {activeTab === 'Billing' && (
        <div className="space-y-6">
          <Card title="Billing center">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-gray-500 font-medium">See your plan, renewal date, token balance, expansions and invoices in one place.</p>
              <Link to="/billing"><PrimaryButton size="sm">Open billing center</PrimaryButton></Link>
            </div>
          </Card>
          <Card title="Token store">
            <p className="text-sm text-gray-500 font-medium mb-8">
              {isFree
                ? 'Token packs are available on Pro and higher. Your Free allowance is a one-time balance and does not refill.'
                : 'Buy token packs to top up your balance. Purchased tokens never expire and are spent only after your monthly allowance runs out.'}
            </p>
            <TokenStore onPurchased={() => { if (user) getUserPaymentHistory(user.uid).then(setPayments).catch(() => {}); }} />
          </Card>
          <Card title="Transaction history">
            {loadingPayments ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : paymentsErr ? (
              <ErrorMessage message={paymentsErr} />
            ) : payments.length === 0 ? (
              <EmptyState message="No transactions yet" submessage="Token purchases and plan changes will show up here." />
            ) : (
              <>
                <div className="space-y-3 mb-8">
                  {payments.map(p => {
                    const date = p.created_at ? new Date(p.created_at.toMillis ? p.created_at.toMillis() : p.created_at) : new Date(0);
                    return (
                      <LedgerRow
                        key={p.id}
                        when={date}
                        title="Token top-up"
                        detail={<span className="font-mono">Ref {p.payment_reference || 'N/A'}</span>}
                        right={
                          <div>
                            <p className="text-sm font-black text-green-600">+{p.tokens_credited} tokens</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${p.amount_paid}.00</p>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
                <button onClick={() => downloadAsCSV('MarketBrainOS_Billing_History', paymentsToCSV(payments))} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Export CSV</button>
              </>
            )}
          </Card>
          <Card title="Invoices">
            <RoadmapRow title="Downloadable PDF invoices" description="Formatted invoices for each transaction." />
          </Card>
        </div>
      )}

      {/* ---------- INTEGRATIONS ---------- */}
      {activeTab === 'Integrations' && (
        <Card title="Integrations">
          <p className="text-sm text-gray-500 font-medium mb-8">Connect your marketing stack to enrich analyses. These integrations are on the roadmap.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Google Analytics', 'Search Console', 'Meta', 'LinkedIn', 'HubSpot', 'CRM systems'].map(name => (
              <RoadmapRow key={name} title={name} description="Connect to import data and context." />
            ))}
          </div>
        </Card>
      )}

      {/* ---------- WORKSPACE ---------- */}
      {activeTab === 'Workspace' && showWorkspace && (
        <Card title="Workspace">
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
            Manage your workspace (members, permissions, branding, and settings) from the Team Workspace.
          </p>
          <Link to="/team">
            <PrimaryButton>Open Team Workspace</PrimaryButton>
          </Link>
          {canSeeFeature('agencyHub', accessCtx) && (
            <div className="mt-6">
              <Link to="/agency" className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1">Manage agency clients →</Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Settings;
