// Org capacity + paid expansions (Phase 5). Shows used/cap per resource and lets the owner buy extra
// seats/workspaces/agencies (simulated). Effective cap = plan base + purchased extras. Reused by the
// Agency Hub, Team Workspace and Enterprise Suite.

import React, { useState } from 'react';
import { Card } from './UI';

export interface CapacityRow {
  label: string;
  used: number;
  cap: number;
  buyLabel?: string;
  onBuy?: () => Promise<void>;
}

const CapacityPanel: React.FC<{ title?: string; rows: CapacityRow[] }> = ({ title = 'Plan capacity', rows }) => {
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const buy = async (i: number, fn: () => Promise<void>) => {
    setBusy(i); setMsg('');
    try { await fn(); setMsg('Capacity added.'); setTimeout(() => setMsg(''), 3000); }
    catch (e: any) { setMsg(e.message || 'Purchase failed.'); }
    finally { setBusy(null); }
  };

  return (
    <Card title={title}>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const full = r.used >= r.cap;
          return (
            <div key={i} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0B0B0B]">{r.label}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${full ? 'text-[#FF0000]' : 'text-gray-400'}`}>
                  {r.used.toLocaleString()} of {r.cap.toLocaleString()} used{full ? ' • full' : ''}
                </p>
              </div>
              {r.onBuy && r.buyLabel && (
                <button
                  onClick={() => buy(i, r.onBuy!)}
                  disabled={busy !== null}
                  className="px-4 py-2 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 whitespace-nowrap"
                >
                  {busy === i ? '…' : r.buyLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <p className="mt-4 text-sm font-semibold text-[#0B0B0B]">{msg}</p>}
    </Card>
  );
};

export default CapacityPanel;
