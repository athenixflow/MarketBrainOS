// Enterprise token budgeting — the owner divides the enterprise's monthly token pool into per-agency
// budget caps (writes `enterprise_allocation` on each linked agency, which becomes that agency's pool).
// Allocation is governance; a capped agency is blocked once it spends its budget for the cycle.

import React, { useState } from 'react';
import { Enterprise } from '../../types';
import { Card, Stat, Input, PrimaryButton, EmptyState, ErrorMessage, SuccessMessage } from '../UI';
import { callAllocateTokens } from '../../services/persistenceService';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricingConfig';

const EnterpriseBudgets: React.FC<{
  enterprise: Enterprise | null;
  agencies: any[];
  enterpriseId: string;
  canManage: boolean;
  onReload: () => void;
}> = ({ agencies, enterpriseId, canManage, onReload }) => {
  const pool = DEFAULT_PRICING_CONFIG.plans.enterprise.monthlyTokens;
  const totalAllocated = agencies.reduce((s, a) => s + (Number(a.enterprise_allocation) || 0), 0);
  const unallocated = Math.max(0, pool - totalAllocated);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (agencyId: string) => {
    const amount = Math.max(0, parseInt(edits[agencyId] ?? '', 10) || 0);
    setBusy(agencyId); setMsg(''); setError('');
    try {
      await callAllocateTokens({ level: 'agency', enterpriseId, agencyId, amount });
      setMsg('Allocation updated.');
      onReload();
    } catch (e: any) { setError(e.message || 'Allocation failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <Card title="Enterprise token pool">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Stat label="Monthly pool" value={pool.toLocaleString()} />
          <Stat label="Allocated" value={totalAllocated.toLocaleString()} />
          <Stat label="Unallocated" value={unallocated.toLocaleString()} />
        </div>
        <p className="mt-6 text-sm text-gray-500 font-medium leading-relaxed">
          Set a per-cycle token budget for each linked agency. The amount becomes that agency's pool
          (which it then divides among its clients and members). Budget 0 means the agency uses its own
          plan allowance. Only linked agencies appear here — link agencies in Settings.
        </p>
      </Card>

      <Card title="Agency budgets">
        {agencies.length === 0 ? (
          <EmptyState message="No linked agencies yet" submessage="Link agencies in Settings to set per-agency budgets." />
        ) : (
          <div className="space-y-3">
            {agencies.map((a) => {
              const cap = Number(a.enterprise_allocation) || 0;
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{a.name || a.id}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums mt-1">
                      {cap > 0 ? `Allocated ${cap.toLocaleString()} tokens per cycle` : 'Using own plan allowance'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-3 shrink-0">
                      <Input
                        compact
                        type="number"
                        ariaLabel={`Token budget for ${a.name || a.id}`}
                        placeholder="0 = own allowance"
                        value={edits[a.id] ?? (cap ? String(cap) : '')}
                        onChange={(e) => setEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                        className="w-40"
                      />
                      <PrimaryButton size="sm" onClick={() => save(a.id)} disabled={busy !== null}>
                        {busy === a.id ? 'Saving…' : 'Set'}
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {msg && <SuccessMessage message={msg} className="mt-4" />}
        {error && <ErrorMessage message={error} className="mt-4" />}
      </Card>
    </div>
  );
};

export default EnterpriseBudgets;
