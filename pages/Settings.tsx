// Settings — account management hub. Real where supported (Profile, Account, Security via
// Firebase, Notifications, Subscription, Billing); polished "Coming soon" stubs for features
// without backend yet (2FA, sessions, login history, integrations, invoices). Profile/account/
// notification writes go through updateUserProfile (allowlisted; economy fields stay server-only).

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { PageHeader, Card, PrimaryButton, Input, Tabs } from '../components/UI';
import SubscriptionPanel from '../components/SubscriptionPanel';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { auth } from '../services/firebase';
import { updateUserProfile, getUserPaymentHistory, callConfirmTopUp, createNotification } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord, NotificationPrefs } from '../types';
import { canSeeFeature, tierAtLeast } from '../config/access';

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Hindi', 'Chinese'];

// --- small primitives ---
const Select: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }> =
  ({ label, value, options, onChange, placeholder }) => (
    <div className="flex flex-col mb-8">
      <label className="text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#FBFBFB] border border-gray-100 p-6 rounded-[24px] focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 outline-none transition-all text-base text-[#0B0B0B]"
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

const Toggle: React.FC<{ label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }> =
  ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-5 border-b border-gray-100 last:border-0">
      <div className="pr-6">
        <p className="text-sm font-bold text-[#0B0B0B]">{label}</p>
        {description && <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${checked ? 'bg-[#FF0000]' : 'bg-gray-200'}`}
        aria-pressed={checked}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

const ComingSoon: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-bold text-[#0B0B0B]">{title}</p>
      <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>
    </div>
    <span className="shrink-0 px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-400 text-[9px] font-bold uppercase tracking-widest">Coming soon</span>
  </div>
);

const SavedFlash: React.FC<{ msg: string; error?: boolean }> = ({ msg, error }) =>
  msg ? <p className={`mt-6 text-[10px] font-bold uppercase tracking-widest ${error ? 'text-red-500' : 'text-green-600'}`}>{msg}</p> : null;

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
  const saveProfile = async (fields: Partial<typeof form>) => {
    if (!user) return;
    setSavingProfile(true); setProfileMsg('');
    try {
      await updateUserProfile(user.uid, fields);
      await refreshProfile();
      setProfileMsg('Saved.');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (e: any) {
      setProfileMsg(e.message || 'Save failed.');
    } finally { setSavingProfile(false); }
  };

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState('');
  const savePrefs = async (next: NotificationPrefs) => {
    setPrefs(next);
    if (!user) return;
    setSavingPrefs(true); setPrefsMsg('');
    try {
      await updateUserProfile(user.uid, { notification_prefs: next });
      await refreshProfile();
      setPrefsMsg('Preferences saved.');
      setTimeout(() => setPrefsMsg(''), 3000);
    } catch (e: any) { setPrefsMsg(e.message || 'Save failed.'); }
    finally { setSavingPrefs(false); }
  };

  // --- security ---
  const isPasswordUser = !!user?.providerData?.some(p => p.providerId === 'password');
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [securityMsg, setSecurityMsg] = useState(''); const [securityErr, setSecurityErr] = useState(false);
  const sendReset = async () => {
    if (!user || !user.email) return;
    setSecurityMsg(''); setSecurityErr(false);
    try { await sendPasswordResetEmail(auth, user.email); setSecurityMsg('Password reset email sent.'); }
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
  const [topUpMsg, setTopUpMsg] = useState('');
  useEffect(() => {
    if (!user || activeTab !== 'Billing') return;
    setLoadingPayments(true);
    getUserPaymentHistory(user.uid).then(setPayments).catch(console.error).finally(() => setLoadingPayments(false));
  }, [user, activeTab]);
  const topUp = async () => {
    if (!user || profile?.tier !== 'pro') return;
    setTopUpMsg('Processing…');
    try {
      await callConfirmTopUp(`tx_${Date.now()}_${Math.random().toString(36).slice(7)}`);
      await refreshProfile();
      const fresh = await getUserPaymentHistory(user.uid); setPayments(fresh);
      createNotification(user.uid, 'Token', 'Top-up successful', '100 tokens added.');
      setTopUpMsg('100 tokens credited.');
      setTimeout(() => setTopUpMsg(''), 3000);
    } catch (e: any) { setTopUpMsg(e.message || 'Top-up failed.'); }
  };

  if (!profile) return null;
  const initials = (profile.first_name?.[0] || profile.email?.[0] || 'U').toUpperCase();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, account, security, notifications, and subscription." />
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ---------- PROFILE ---------- */}
      {activeTab === 'Profile' && (
        <Card>
          <div className="flex items-center gap-6 mb-12">
            <div className="w-20 h-20 rounded-full bg-[#FF0000] text-white flex items-center justify-center text-2xl font-black">{initials}</div>
            <div>
              <p className="text-sm font-bold text-[#0B0B0B]">{[form.first_name, form.last_name].filter(Boolean).join(' ') || profile.email}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Photo upload coming soon</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Input label="First Name" placeholder="Jane" value={form.first_name} onChange={set('first_name')} />
            <Input label="Last Name" placeholder="Doe" value={form.last_name} onChange={set('last_name')} />
            <Input label="Company Name" placeholder="Acme Inc." value={form.company_name} onChange={set('company_name')} />
            <Input label="Job Title" placeholder="Head of Growth" value={form.job_title} onChange={set('job_title')} />
          </div>
          <Input label="Bio" placeholder="A short description about you and what you do…" value={form.bio} onChange={set('bio')} multiline />
          <PrimaryButton onClick={() => saveProfile({ first_name: form.first_name, last_name: form.last_name, company_name: form.company_name, job_title: form.job_title, bio: form.bio })} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </PrimaryButton>
          <SavedFlash msg={profileMsg} error={profileMsg !== '' && profileMsg !== 'Saved.'} />
        </Card>
      )}

      {/* ---------- ACCOUNT ---------- */}
      {activeTab === 'Account' && (
        <Card>
          <Input label="Email Address" placeholder="" value={profile.email} onChange={() => {}} disabled />
          <p className="-mt-8 mb-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email changes coming soon</p>
          <Input label="Username" placeholder="janedoe" value={form.username} onChange={set('username')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Select label="Time Zone" value={form.timezone} options={TIMEZONES} onChange={(v) => setForm(f => ({ ...f, timezone: v }))} />
            <Select label="Language" value={form.language} options={LANGUAGES} onChange={(v) => setForm(f => ({ ...f, language: v }))} />
          </div>
          <PrimaryButton onClick={() => saveProfile({ username: form.username, timezone: form.timezone, language: form.language })} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Account'}
          </PrimaryButton>
          <SavedFlash msg={profileMsg} error={profileMsg !== '' && profileMsg !== 'Saved.'} />
        </Card>
      )}

      {/* ---------- SECURITY ---------- */}
      {activeTab === 'Security' && (
        <div className="space-y-6">
          <Card title="Password">
            {isPasswordUser ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <Input label="Current Password" placeholder="••••••••" value={pwd.current} onChange={(e) => setPwd(p => ({ ...p, current: e.target.value }))} />
                  <Input label="New Password" placeholder="At least 6 characters" value={pwd.next} onChange={(e) => setPwd(p => ({ ...p, next: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-4">
                  <PrimaryButton onClick={changePassword}>Update Password</PrimaryButton>
                  <button onClick={sendReset} className="px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B] transition-colors">Send Reset Email</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">You signed in with Google, so there's no password to change here. You can still send a reset email to set one.</p>
                <button onClick={sendReset} className="px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B] transition-colors">Send Password Reset Email</button>
              </>
            )}
            <SavedFlash msg={securityMsg} error={securityErr} />
          </Card>
          <Card title="Advanced Security">
            <div className="space-y-3">
              <ComingSoon title="Two-Factor Authentication" description="Add a second step at sign-in for extra protection." />
              <ComingSoon title="Active Sessions" description="See and revoke devices currently signed in." />
              <ComingSoon title="Login History" description="Review recent sign-in activity on your account." />
            </div>
          </Card>
        </div>
      )}

      {/* ---------- NOTIFICATIONS ---------- */}
      {activeTab === 'Notifications' && (
        <Card title="Notification Preferences">
          <Toggle label="Analysis Complete" description="When an analysis finishes running." checked={!!prefs.analysis} onChange={(v) => savePrefs({ ...prefs, analysis: v })} />
          <Toggle label="Token Alerts" description="Low balance and top-up confirmations." checked={!!prefs.token} onChange={(v) => savePrefs({ ...prefs, token: v })} />
          <Toggle label="Product Updates" description="New features and improvements." checked={!!prefs.product} onChange={(v) => savePrefs({ ...prefs, product: v })} />
          <Toggle label="Workspace Notifications" description="Member, client, and report activity." checked={!!prefs.workspace} onChange={(v) => savePrefs({ ...prefs, workspace: v })} />
          <Toggle label="Email Preferences" description="Master switch for the email channel." checked={!!prefs.email} onChange={(v) => savePrefs({ ...prefs, email: v })} />
          <SavedFlash msg={prefsMsg} error={prefsMsg !== '' && prefsMsg !== 'Preferences saved.'} />
          {savingPrefs && <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saving…</p>}
        </Card>
      )}

      {/* ---------- SUBSCRIPTION ---------- */}
      {activeTab === 'Subscription' && <SubscriptionPanel />}

      {/* ---------- BILLING ---------- */}
      {activeTab === 'Billing' && (
        <div className="space-y-6">
          <Card title="Tokens">
            <p className="text-sm text-gray-500 font-medium mb-8">
              {profile.tier === 'pro'
                ? 'Top up 100 tokens for $5 at any time. Top-ups never affect your monthly reset.'
                : 'Token top-ups are available on the Pro plan. Upgrade from the Subscription tab to enable them.'}
            </p>
            {profile.tier === 'pro' && <PrimaryButton onClick={topUp}>Buy 100 Tokens — $5</PrimaryButton>}
            {topUpMsg && <p className="mt-6 text-[10px] font-bold text-green-600 uppercase tracking-widest">{topUpMsg}</p>}
          </Card>
          <Card title="Transaction History">
            {loadingPayments ? (
              <p className="text-sm text-gray-400 font-medium py-6 text-center">Loading…</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium py-6 text-center">No transactions yet.</p>
            ) : (
              <>
                <div className="space-y-3 mb-8">
                  {payments.map(p => {
                    const date = p.created_at ? new Date(p.created_at.toMillis ? p.created_at.toMillis() : p.created_at) : null;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100">
                        <div>
                          <p className="text-sm font-bold text-[#0B0B0B]">Token Top-Up</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{date ? date.toLocaleDateString() : ''} • Ref {p.payment_reference || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-green-600">+{p.tokens_credited} Tokens</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${p.amount_paid}.00</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => downloadAsCSV('MarketBrainOS_Billing_History', paymentsToCSV(payments))} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Export CSV</button>
              </>
            )}
          </Card>
          <Card title="Invoices">
            <ComingSoon title="Downloadable PDF Invoices" description="Formatted invoices for each transaction." />
          </Card>
        </div>
      )}

      {/* ---------- INTEGRATIONS ---------- */}
      {activeTab === 'Integrations' && (
        <Card title="Integrations">
          <p className="text-sm text-gray-500 font-medium mb-8">Connect your marketing stack to enrich analyses. These integrations are on the roadmap.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Google Analytics', 'Search Console', 'Meta', 'LinkedIn', 'HubSpot', 'CRM Systems'].map(name => (
              <ComingSoon key={name} title={name} description="Connect to import data and context." />
            ))}
          </div>
        </Card>
      )}

      {/* ---------- WORKSPACE ---------- */}
      {activeTab === 'Workspace' && showWorkspace && (
        <Card title="Workspace">
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
            Manage your workspace — members, permissions, branding, and settings — from the Team Workspace.
          </p>
          <Link to="/team">
            <PrimaryButton>Open Team Workspace</PrimaryButton>
          </Link>
          {canSeeFeature('agencyHub', accessCtx) && (
            <div className="mt-6">
              <Link to="/agency" className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1">Manage Agency clients →</Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Settings;
