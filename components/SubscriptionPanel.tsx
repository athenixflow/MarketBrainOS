import React, { useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Badge, SuccessMessage, ErrorMessage, useConfirmTap } from './UI';
import { useAuth } from '../context/AuthContext';
import { isPaidTier } from '../config/access';
import { callChangeSubscription, createNotification } from '../services/persistenceService';
import { SubscriptionStatus } from '../types';
import { DEFAULT_PRICING_CONFIG, PLAN_META } from '../config/pricingConfig';
import { track } from '../services/analytics';
import { fetchBillingStatus } from '../services/billing';

// Derived, never hardcoded: plan copy must track the pricing config or it drifts (it previously
// advertised 200 tokens while the config granted 100).
const PRO_TOKENS = DEFAULT_PRICING_CONFIG.plans.pro.monthlyTokens;
const PRO_PRICE = DEFAULT_PRICING_CONFIG.plans.pro.price;
const PRO_NAME = PLAN_META.pro.name;

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

  // The panel serves every paid tier (Team/Agency/Enterprise included), so copy names the account's
  // real plan; it used to say "Pro" for all of them. Read before the early return so the taps below
  // can use it.
  const planName = profile ? (PLAN_META[profile.tier]?.name || profile.tier) : PLAN_META.free.name;
  // Monthly allowance of the account's own plan, for the "includes N tokens" line.
  const planTokens = profile ? (DEFAULT_PRICING_CONFIG.plans[profile.tier]?.monthlyTokens ?? PRO_TOKENS) : PRO_TOKENS;

  // Cancelling or downgrading a paid plan fired on a single tap; both now need a second tap.
  const cancelTap = useConfirmTap(() => run('cancel', 'Subscription cancelled.', `Your ${planName} plan has been cancelled.`));
  const downgradeTap = useConfirmTap(() => run('downgrade', 'Downgraded to Free.', 'Your account moved to the Free plan.'));

  /*
   * NO PAY BUTTON UNTIL THERE IS A WAY TO PAY (GTM part 19 §5 step 3).
   *
   * Until Paystack is wired, "Upgrade to Pro, $19/mo" takes no money AND grants the plan.
   * That is a promise of a charge that never arrives sitting on top of a paid tier given
   * away — and the first person to notice the second half tells everybody. The control
   * says what is actually true instead, and the server keeps deciding tiers.
   */
  const [billingLive, setBillingLive] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBillingLive(s.billing_live); });
    return () => { alive = false; };
  }, []);

  if (!profile) return null;

  const status: SubscriptionStatus = profile.subscription_status || (isPaidTier(profile.tier) ? 'active' : 'free');
  const isPro = isPaidTier(profile.tier);
  const badge = STATUS_BADGE[status] || STATUS_BADGE.free;

  const run = async (action: 'upgrade' | 'cancel' | 'downgrade' | 'renew', successMsg: string, notif: string) => {
    if (!user) return;
    /* See the note above: upgrading grants a paid tier and charges nothing until Paystack
       is wired. Cancelling and downgrading stay available — those take nothing away that
       was paid for, and blocking them would trap somebody in a plan. */
    if ((action === 'upgrade' || action === 'renew') && billingLive === false) {
      setMsgErr(true);
      setMsg('Card payments are not live yet. Email support and we will set your plan up by hand.');
      return;
    }
    /* The same intent event from inside the product, so the two surfaces are comparable
       and a change of plan is never confused with a cancellation in the funnel. */
    if (action === 'upgrade' || action === 'renew') {
      track('upgrade_clicked', { plan: action === 'renew' ? profile?.tier : 'pro', surface: 'subscription_panel', signed_in: true });
    }
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
          <span className="text-2xl font-black text-[#0B0B0B]">{planName}</span>
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
            ? `Your ${planName} plan is cancelled and will not renew. You keep access until the end of the current period.`
            : `${planName} includes ${planTokens} tokens every month, all tools, priority support, and token top-ups. Purchased tokens never expire.`
          : `Your Free allowance is a one-time balance and does not refill. Upgrade to ${PRO_NAME} for ${PRO_TOKENS} tokens every month, all tools, priority support, and the ability to top up.`}
      </p>

      <div className="flex flex-wrap gap-4">
        {!isPro && (
          <PrimaryButton size="md" onClick={() => run('upgrade', `Upgraded to ${PRO_NAME}.`, `Welcome to ${PRO_NAME}. ${PRO_TOKENS} tokens added.`)} disabled={!!busy}>
            {busy === 'upgrade' ? 'Processing...' : `Upgrade to ${PRO_NAME}, $${PRO_PRICE}/mo`}
          </PrimaryButton>
        )}
        {isPro && status === 'active' && (
          <>
            <SecondaryButton
              onClick={() => run('renew', 'Subscription renewed.', `Your ${planName} plan renewed. ${planTokens} tokens added.`)}
              disabled={!!busy}
            >
              {busy === 'renew' ? 'Processing...' : 'Renew Now'}
            </SecondaryButton>
            <SecondaryButton
              onClick={cancelTap.tap}
              disabled={!!busy}
              className={cancelTap.armed ? '!border-[#FF0000] !text-[#FF0000]' : ''}
            >
              {busy === 'cancel' ? 'Processing...' : cancelTap.armed ? 'Tap again to cancel plan' : 'Cancel Plan'}
            </SecondaryButton>
          </>
        )}
        {isPro && status === 'cancelled' && (
          <>
            <PrimaryButton size="md" onClick={() => run('renew', 'Subscription reactivated.', `Your ${planName} plan is active again.`)} disabled={!!busy}>
              {busy === 'renew' ? 'Processing...' : `Reactivate ${planName}`}
            </PrimaryButton>
            <SecondaryButton
              onClick={downgradeTap.tap}
              disabled={!!busy}
              className={downgradeTap.armed ? '!border-[#FF0000] !text-[#FF0000]' : ''}
            >
              {busy === 'downgrade' ? 'Processing...' : downgradeTap.armed ? 'Tap again to downgrade' : 'Downgrade to Free'}
            </SecondaryButton>
          </>
        )}
      </div>

      {msg && (msgErr ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />)}
    </Card>
  );
};

export default SubscriptionPanel;
