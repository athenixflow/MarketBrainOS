import React, { useState } from 'react';
import { Card, PrimaryButton } from './UI';
import { useAuth } from '../context/AuthContext';
import { callChangeSubscription, createNotification } from '../services/persistenceService';
import { SubscriptionStatus } from '../types';

const STATUS_STYLE: Record<SubscriptionStatus, { label: string; cls: string }> = {
  free: { label: 'Free', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  active: { label: 'Active', cls: 'bg-green-50 text-green-600 border-green-100' },
  past_due: { label: 'Past Due', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
  cancelled: { label: 'Cancelled', cls: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  expired: { label: 'Expired', cls: 'bg-red-50 text-red-600 border-red-100' },
};

const SubscriptionPanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<string>('');

  if (!profile) return null;

  const status: SubscriptionStatus = profile.subscription_status || (profile.tier === 'pro' ? 'active' : 'free');
  const isPro = profile.tier === 'pro';
  const badge = STATUS_STYLE[status] || STATUS_STYLE.free;

  const run = async (action: 'upgrade' | 'cancel' | 'downgrade' | 'renew', successMsg: string, notif: string) => {
    if (!user) return;
    setBusy(action);
    setMsg('');
    try {
      await callChangeSubscription(action);
      await refreshProfile();
      setMsg(successMsg);
      createNotification(user.uid, 'Subscription', notif);
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) {
      setMsg(e.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Card title="Subscription">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-[#0B0B0B]">{isPro ? 'Pro' : 'Free'}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
        </div>
        {isPro && profile.plan_renews_at && status === 'active' && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Renews {new Date(profile.plan_renews_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
        {isPro
          ? status === 'cancelled'
            ? 'Your Pro plan is cancelled and will not renew. You keep access until the end of the current period.'
            : 'Pro includes 200 tokens every month, all tools, priority support, and token top-ups.'
          : 'Upgrade to Pro for 200 tokens every month, all tools, priority support, and the ability to top up.'}
      </p>

      <div className="flex flex-wrap gap-4">
        {!isPro && (
          <PrimaryButton onClick={() => run('upgrade', 'Upgraded to Pro.', 'Welcome to Pro — 200 tokens added.')} disabled={!!busy} className="!px-8">
            {busy === 'upgrade' ? 'Processing...' : 'Upgrade to Pro — $7/mo'}
          </PrimaryButton>
        )}
        {isPro && status === 'active' && (
          <>
            <button
              onClick={() => run('renew', 'Subscription renewed.', 'Your Pro plan renewed — 200 tokens added.')}
              disabled={!!busy}
              className="px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest bg-[#0B0B0B] text-white hover:bg-black transition-colors disabled:opacity-50"
            >
              {busy === 'renew' ? 'Processing...' : 'Renew Now'}
            </button>
            <button
              onClick={() => run('cancel', 'Subscription cancelled.', 'Your Pro plan has been cancelled.')}
              disabled={!!busy}
              className="px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#FF0000] hover:border-[#FF0000]/30 transition-colors disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Processing...' : 'Cancel Plan'}
            </button>
          </>
        )}
        {isPro && status === 'cancelled' && (
          <>
            <PrimaryButton onClick={() => run('renew', 'Subscription reactivated.', 'Your Pro plan is active again.')} disabled={!!busy} className="!px-8">
              {busy === 'renew' ? 'Processing...' : 'Reactivate Pro'}
            </PrimaryButton>
            <button
              onClick={() => run('downgrade', 'Downgraded to Free.', 'Your account moved to the Free plan.')}
              disabled={!!busy}
              className="px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B] transition-colors disabled:opacity-50"
            >
              {busy === 'downgrade' ? 'Processing...' : 'Downgrade to Free'}
            </button>
          </>
        )}
      </div>

      {msg && <p className="mt-6 text-[10px] font-bold text-green-600 uppercase tracking-widest">{msg}</p>}
    </Card>
  );
};

export default SubscriptionPanel;
