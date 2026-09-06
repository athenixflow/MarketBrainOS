// Token Store — buy token packs (simulated payment). Purchased tokens credit `purchased_tokens`
// (never expire) and are spent only after the plan allowance is exhausted. Reused by the Token
// Store page, the Settings billing tab and the Billing Center.

import React, { useState } from 'react';
import { Card, Badge, PrimaryButton, SuccessMessage, ErrorMessage } from './UI';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import { callConfirmTopUp, createNotification } from '../services/persistenceService';

const genRef = () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// The pack with the most tokens per dollar gets the "Best value" badge. Derived from config so it
// can never disagree with the prices shown.
const PACKS = DEFAULT_PRICING_CONFIG.tokenPacks;
const BEST_VALUE_ID = PACKS.reduce((best, p) => (p.tokens / p.price > best.tokens / best.price ? p : best), PACKS[0]).id;

export const TokenStore: React.FC<{ onPurchased?: () => void; compact?: boolean }> = ({ onPurchased, compact }) => {
  const { user, profile, refreshProfile } = useAuth();
  const packs = PACKS;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  // Tone of `msg` is tracked here rather than inferred from the text.
  const [msgErr, setMsgErr] = useState(false);
  const isFree = !profile || profile.tier === 'free';

  const buy = async (packId: string, tokens: number) => {
    if (!user) return;
    if (isFree) { setMsgErr(true); setMsg('Upgrade to a paid plan to buy token packs.'); return; }
    setBusy(packId); setMsgErr(false); setMsg('Processing…');
    try {
      await callConfirmTopUp(genRef(), packId);
      await refreshProfile();
      createNotification(user.uid, 'Token', 'Tokens added', `${tokens.toLocaleString()} tokens credited to your balance.`);
      setMsg(`${tokens.toLocaleString()} tokens credited.`);
      onPurchased?.();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsgErr(true);
      setMsg(e.message || 'Purchase failed.');
    } finally { setBusy(null); }
  };

  return (
    <div>
      <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'}`}>
        {packs.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{p.label}</p>
              {p.id === BEST_VALUE_ID && <Badge tone="red">Best value</Badge>}
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums leading-none text-[#0B0B0B]">{p.tokens.toLocaleString()}</p>
            <p className="mt-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">tokens</p>
            <p className="mt-4 text-lg font-black tabular-nums text-[#0B0B0B]">${p.price}</p>
            <div className="mt-3 mb-6"><Badge tone="green">Never expires</Badge></div>
            <PrimaryButton
              size="sm"
              onClick={() => buy(p.id, p.tokens)}
              disabled={busy !== null || isFree}
              className="mt-auto w-full"
            >
              {busy === p.id ? 'Processing…' : 'Buy'}
            </PrimaryButton>
          </Card>
        ))}
      </div>
      {isFree && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge tone="neutral">Paid plans only</Badge>
          <p className="text-sm text-gray-500 font-medium">
            Token packs are available on Pro and higher. Your Free allowance is a one-time balance and does not refill; upgrade to Pro for a monthly allowance and the ability to top up.
          </p>
        </div>
      )}
      {msg && (
        busy !== null
          ? <p className="mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{msg}</p>
          : msgErr
            ? <ErrorMessage message={msg} className="mt-6" />
            : <SuccessMessage message={msg} className="mt-6" />
      )}
    </div>
  );
};

export default TokenStore;
