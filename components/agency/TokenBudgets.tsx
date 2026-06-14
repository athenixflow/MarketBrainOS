// Agency token budgeting (Phase 4) — the owner/director divides the agency's monthly token pool
// into per-client budget caps. A capped client is blocked once it spends its budget for the cycle
// (independent blocking); a client with budget 0 draws freely from the shared pool. Caps reset each
// billing cycle. Allocation is governance only — the actual tokens come from the owner's wallet.

import React, { useState } from 'react';
import { Agency, AgencyClient } from '../../types';
import { Card } from '../UI';
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

  const save = async (clientId: string) => {
    const amount = Math.max(0, parseInt(edits[clientId] ?? '', 10) || 0);
    setBusy(clientId); setMsg('');
    try {
      await callAllocateTokens({ level: 'client', agencyId, clientId, amount });
      setMsg('Allocation updated.');
      onReload();
    } catch (e: any) { setMsg(e.message || 'Allocation failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <Card title="Agency token pool">
        <div className="flex flex-wrap gap-10">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monthly pool</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{pool.toLocaleString()}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Allocated</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{totalAllocated.toLocaleString()}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Unallocated</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{unallocated.toLocaleString()}</p></div>
        </div>
        <p className="mt-4 text-sm text-gray-500 font-medium">
          Set a per-cycle token budget for each client. A client with a budget is blocked once it’s
          spent (ask to allocate more); budget 0 means the client draws freely from the shared agency
          pool. Budgets reset each billing cycle.
        </p>
      </Card>

      <Card title="Client budgets">
        {clients.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium py-6 text-center">No clients yet.</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const consumed = c.consumed_this_cycle || 0;
              const cap = c.allocation || 0;
              const remaining = cap > 0 ? Math.max(0, cap - consumed) : null;
              return (
                <div key={c.id} className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{c.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {cap > 0
                        ? `Budget ${cap.toLocaleString()} • used ${consumed.toLocaleString()} • ${remaining?.toLocaleString()} left`
                        : `Uncapped • used ${consumed.toLocaleString()} this cycle`}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number" min={0}
                        defaultValue={cap || ''}
                        onChange={(e) => setEdits((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="0 = uncapped"
                        className="w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700"
                      />
                      <button onClick={() => save(c.id)} disabled={busy !== null} className="px-4 py-2 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                        {busy === c.id ? '…' : 'Set'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {msg && <p className="mt-4 text-sm font-semibold text-[#0B0B0B]">{msg}</p>}
      </Card>
    </div>
  );
};

export default TokenBudgets;
