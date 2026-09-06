import React, { useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Badge, SuccessMessage, ErrorMessage } from './UI';
import { useAuth } from '../context/AuthContext';
import { callChangeSubscription, createNotification } from '../services/persistenceService';
import { SubscriptionStatus } from '../types';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';

// Derived, never hardcoded: plan copy must track the pricing config or it drifts (it previously
// advertised 200 tokens while the config granted 100).
const PRO_TOKENS = DEFAULT_PRICING_CONFIG.plans.pro.monthlyTokens;
const PRO_PRICE = DEFAULT_PRICING_CONFIG.plans.pro.price;

type BadgeTone = 'neutral' | 'red' | 'green' | 'blue' | 'yellow' | 'dark';
const STATUS_BADGE: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  free: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'green' },
  past_due: { label: 'Past due', tone: 'yellow' },
  cancelled: { label: 'Cancelled', tone: 'yellow' },
  expired: { label: 'Expired', tone: 'red' },
};

const SubscriptionPanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  // Tone of `msg` is tracked here rather than inferred from the text.
  const [msgErr, setMsgErr] = useState(false);

  if (!profile) return null;

  const status: SubscriptionStatus = profile.subscription_status || (profile.tier === 'pro' ? 'active' : 'free');
  const isPro = profile.tier === 'pro';
  const badge = STATUS_BADGE[status] || STATUS_BADGE.free;

  const run = async (action: 'upgrade' | 'cancel' | 'downgrade' | 'renew', successMsg: string, notif: string) => {
    if (!user) return;
    setBusy(action);
    setMsg('');
    setMsgErr(false);
    try {
      await callChangeSubscription(action);
      await refreshProfile();
      setMsg(successMsg);
      createNotification(user.uid, 'Subscription', notif);
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) {
      setMsgErr(true);
      setMsg(e.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Card title="Subscription">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-[#0B0B0B]">{isPro ? 'Pro' : 'Free'}</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        {isPro && profile.plan_renews_at && status === 'active' && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
            Renews {new Date(profile.plan_renews_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
        {isPro
          ? status === 'cancelled'
            ? 'Your Pro plan is cancelled and will not renew. You keep access until the end of the current period.'
            : `Pro includes ${PRO_TOKENS} tokens every month, all tools, priority support, and token top-ups. Purchased tokens never expire.`
          : `Your Free allowance is a one-time balance and does not refill. Upgrade to Pro for ${PRO_TOKENS} tokens every month, all tools, priority support, and the ability to top up.`}
      </p>

      <div className="flex flex-wrap gap-4">
        {!isPro && (
          <PrimaryButton size="md" onClick={() => run('upgrade', 'Upgraded to Pro.', `Welcome to Pro. ${PRO_TOKENS} tokens added.`)} disabled={!!busy}>
            {busy === 'upgrade' ? 'Processing...' : `Upgrade to Pro, $${PRO_PRICE}/mo`}
          </PrimaryButton>
        )}
        {isPro && status === 'active' && (
          <>
            <SecondaryButton
              onClick={() => run('renew', 'Subscription renewed.', `Your Pro plan renewed. ${PRO_TOKENS} tokens added.`)}
              disabled={!!busy}
            >
              {busy === 'renew' ? 'Processing...' : 'Renew Now'}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => run('cancel', 'Subscription cancelled.', 'Your Pro plan has been cancelled.')}
              disabled={!!busy}
            >
              {busy === 'cancel' ? 'Processing...' : 'Cancel Plan'}
            </SecondaryButton>
          </>
        )}
        {isPro && status === 'cancelled' && (
          <>
            <PrimaryButton size="md" onClick={() => run('renew', 'Subscription reactivated.', 'Your Pro plan is active again.')} disabled={!!busy}>
              {busy === 'renew' ? 'Processing...' : 'Reactivate Pro'}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => run('downgrade', 'Downgraded to Free.', 'Your account moved to the Free plan.')}
              disabled={!!busy}
            >
              {busy === 'downgrade' ? 'Processing...' : 'Downgrade to Free'}
            </SecondaryButton>
          </>
        )}
      </div>

      {msg && (msgErr ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />)}
    </Card>
  );
};

export default SubscriptionPanel;
