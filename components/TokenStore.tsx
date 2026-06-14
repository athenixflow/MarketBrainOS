// Token Store — buy token packs (simulated payment). Purchased tokens credit `purchased_tokens`
// (never expire) and are spent only after the monthly allowance is exhausted. Reused by the Token
// Store page, the Settings billing tab and the Billing Center.

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import { callConfirmTopUp, createNotification } from '../services/persistenceService';

const genRef = () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const TokenStore: React.FC<{ onPurchased?: () => void; compact?: boolean }> = ({ onPurchased, compact }) => {
  const { user, profile, refreshProfile } = useAuth();
  const packs = DEFAULT_PRICING_CONFIG.tokenPacks;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const isFree = !profile || profile.tier === 'free';

  const buy = async (packId: string, tokens: number) => {
    if (!user) return;
    if (isFree) { setMsg('Upgrade to a paid plan to buy token packs.'); return; }
    setBusy(packId); setMsg('Processing…');
    try {
      await callConfirmTopUp(genRef(), packId);
      await refreshProfile();
      createNotification(user.uid, 'Token', 'Tokens added', `${tokens.toLocaleString()} tokens credited to your balance.`);
      setMsg(`${tokens.toLocaleString()} tokens credited.`);
      onPurchased?.();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg(e.message || 'Purchase failed.');
    } finally { setBusy(null); }
  };

  return (
    <div>
      <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        {packs.map((p) => (
          <div key={p.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{p.label}</p>
            <p className="mt-2 text-2xl font-black text-[#0B0B0B]">{p.tokens.toLocaleString()}</p>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">tokens</p>
            <p className="mt-3 text-lg font-black text-[#0B0B0B]">${p.price}</p>
            <p className="text-[10px] font-medium text-gray-400 mb-4">never expire</p>
            <button
              onClick={() => buy(p.id, p.tokens)}
              disabled={busy !== null || isFree}
              className="mt-auto w-full py-2.5 rounded-xl bg-[#FF0000] text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {busy === p.id ? 'Processing…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
      {isFree && (
        <p className="mt-4 text-sm text-gray-500 font-medium">
          Token packs are available on paid plans. Upgrade to Pro or higher to purchase.
        </p>
      )}
      {msg && <p className="mt-4 text-sm font-semibold text-[#0B0B0B]">{msg}</p>}
    </div>
  );
};

export default TokenStore;
