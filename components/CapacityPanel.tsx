// Org capacity + paid expansions (Phase 5). Shows used/cap per resource and lets the owner buy extra
// seats/workspaces/agencies (simulated). Effective cap = plan base + purchased extras. Reused by the
// Agency Hub, Team Workspace and Enterprise Suite.

import React, { useState } from 'react';
import { Card, PrimaryButton, Badge, SuccessMessage, ErrorMessage } from './UI';

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
  // Tone of `msg` is tracked here rather than inferred from the text.
  const [msgErr, setMsgErr] = useState(false);

  const buy = async (i: number, fn: () => Promise<void>) => {
    setBusy(i); setMsg(''); setMsgErr(false);
    try { await fn(); setMsg('Capacity added.'); setTimeout(() => setMsg(''), 3000); }
    catch (e: any) { setMsgErr(true); setMsg(e.message || 'Purchase failed.'); }
    finally { setBusy(null); }
  };

  return (
    <Card title={title}>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const full = r.used >= r.cap;
          return (
            <div key={i} className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0B0B0B]">{r.label}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className={`text-[10px] font-bold uppercase tracking-widest tabular-nums ${full ? 'text-[#FF0000]' : 'text-gray-400'}`}>
                    {r.used.toLocaleString()} of {r.cap.toLocaleString()} used
                  </p>
                  {full && <Badge tone="red">Full</Badge>}
                </div>
              </div>
              {r.onBuy && r.buyLabel && (
                <PrimaryButton size="sm" onClick={() => buy(i, r.onBuy!)} disabled={busy !== null}>
                  {busy === i ? 'Processing…' : r.buyLabel}
                </PrimaryButton>
              )}
            </div>
          );
        })}
      </div>
      {msg && (msgErr ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />)}
    </Card>
  );
};

export default CapacityPanel;
