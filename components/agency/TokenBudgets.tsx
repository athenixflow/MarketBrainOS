// Agency token budgeting (Phase 4) — the owner/director divides the agency's monthly token pool
// into per-client budget caps. A capped client is blocked once it spends its budget for the cycle
// (independent blocking); a client with budget 0 draws freely from the shared pool. Caps reset each
// billing cycle. Allocation is governance only — the actual tokens come from the owner's wallet.

import React, { useState } from 'react';
import { Agency, AgencyClient } from '../../types';
import { Card, Stat, Input, PrimaryButton, EmptyState, ErrorMessage, SuccessMessage } from '../UI';
import { callAllocateTokens } from '../../services/persistenceService';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricingConfig';

const TokenBudgets: React.FC<{
  agency: Agency | null;
  clients: AgencyClient[];
  agencyId: string;
  canManage: boolean;
  onReload: () => void;
}> = ({ agency, clients, agencyId, canManage, onReload }) => {
  const pool = (agency as any)?.enterprise_allocation || DEFAULT_PRICING_CONFIG.plans.agency.monthlyTokens;
  const totalAllocated = clients.reduce((s, c) => s + (c.allocation || 0), 0);
  const unallocated = Math.max(0, pool - totalAllocated);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (clientId: string) => {
    const amount = Math.max(0, parseInt(edits[clientId] ?? '', 10) || 0);
    setBusy(clientId); setMsg(''); setError('');
    try {
      await callAllocateTokens({ level: 'client', agencyId, clientId, amount });
      setMsg('Allocation updated.');
      onReload();
    } catch (e: any) { setError(e.message || 'Allocation failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <Card title="Agency token pool">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Stat label="Monthly pool" value={pool.toLocaleString()} />
          <Stat label="Allocated" value={totalAllocated.toLocaleString()} />
          <Stat label="Unallocated" value={unallocated.toLocaleString()} />
        </div>
        <p className="mt-6 text-sm text-gray-500 font-medium leading-relaxed">
          Set a per-cycle token budget for each client. A client with a budget is blocked once it’s
          spent (ask to allocate more); budget 0 means the client draws freely from the shared agency
          pool. Budgets reset each billing cycle.
        </p>
      </Card>

      <Card title="Client budgets">
        {clients.length === 0 ? (
          <EmptyState message="No clients yet" submessage="Add clients in the Clients tab to set per-client budgets." />
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const consumed = c.consumed_this_cycle || 0;
              const cap = c.allocation || 0;
              const remaining = cap > 0 ? Math.max(0, cap - consumed) : null;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{c.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums mt-1">
                      {cap > 0
                        ? `Budget ${cap.toLocaleString()} · used ${consumed.toLocaleString()} · ${remaining?.toLocaleString()} left`
                        : `Uncapped · used ${consumed.toLocaleString()} this cycle`}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-3 shrink-0">
                      <Input
                        compact
                        type="number"
                        ariaLabel={`Token budget for ${c.name}`}
                        placeholder="0 = uncapped"
                        value={edits[c.id] ?? (cap ? String(cap) : '')}
                        onChange={(e) => setEdits((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="w-36"
                      />
                      <PrimaryButton size="sm" onClick={() => save(c.id)} disabled={busy !== null}>
                        {busy === c.id ? 'Saving…' : 'Set'}
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

export default TokenBudgets;
