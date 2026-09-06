// Settings — account management hub. Real where supported (Profile, Account, Security via
// Firebase, Notifications, Subscription, Billing); polished "Coming soon" stubs for features
// without backend yet (2FA, sessions, login history, integrations, invoices). Profile/account/
// notification writes go through updateUserProfile (allowlisted; economy fields stay server-only).

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import {
  PageHeader, Card, PrimaryButton, SecondaryButton, Input, Select, Tabs, ComingSoon, LoadingState,
  SuccessMessage, ErrorMessage, Skeleton, EmptyState, LedgerRow,
} from '../components/UI';
import SubscriptionPanel from '../components/SubscriptionPanel';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { updateUserProfile, getUserPaymentHistory, callRequestPasswordReset } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord, NotificationPrefs } from '../types';
import { canSeeFeature, tierAtLeast } from '../config/access';

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

const Settings: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships } = useScope();
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

  if (!profile) return <LoadingState message="Loading your settings" />;
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
