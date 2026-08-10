// Enterprise token budgeting — the owner divides the enterprise's monthly token pool into per-agency
// budget caps (writes `enterprise_allocation` on each linked agency, which becomes that agency's pool).
// Allocation is governance; a capped agency is blocked once it spends its budget for the cycle.

import React, { useState } from 'react';
import { Enterprise } from '../../types';
import { Card } from '../UI';
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

  const save = async (agencyId: string) => {
    const amount = Math.max(0, parseInt(edits[agencyId] ?? '', 10) || 0);
    setBusy(agencyId); setMsg('');
    try {
      await callAllocateTokens({ level: 'agency', enterpriseId, agencyId, amount });
      setMsg('Allocation updated.');
      onReload();
    } catch (e: any) { setMsg(e.message || 'Allocation failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <Card title="Enterprise token pool">
        <div className="flex flex-wrap gap-10">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monthly pool</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{pool.toLocaleString()}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Allocated</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{totalAllocated.toLocaleString()}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Unallocated</p><p className="text-xl font-black text-[#0B0B0B] mt-1">{unallocated.toLocaleString()}</p></div>
        </div>
        <p className="mt-4 text-sm text-gray-500 font-medium">
          Set a per-cycle token budget for each linked agency. The amount becomes that agency's pool
          (which it then divides among its clients and members). Budget 0 means the agency uses its own
          plan allowance. Only linked agencies appear here — link agencies in Settings.
        </p>
      </Card>

      <Card title="Agency budgets">
        {agencies.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium py-6 text-center">No linked agencies yet. Link agencies in Settings.</p>
        ) : (
          <div className="space-y-3">
            {agencies.map((a) => {
              const cap = Number(a.enterprise_allocation) || 0;
              return (
                <div key={a.id} className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{a.name || a.id}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {cap > 0 ? `Allocated ${cap.toLocaleString()} tokens/cycle` : 'Using own plan allowance'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number" min={0}
                        defaultValue={cap || ''}
                        onChange={(e) => setEdits((p) => ({ ...p, [a.id]: e.target.value }))}
                        placeholder="0 = own allowance"
                        className="w-36 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700"
                      />
                      <button onClick={() => save(a.id)} disabled={busy !== null} className="px-4 py-2 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                        {busy === a.id ? '…' : 'Set'}
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

export default EnterpriseBudgets;
