// Enterprise Suite — Briefings Center (Phase 6.3)
import React, { useState } from 'react';
import { Card, PrimaryButton, ErrorMessage } from '../UI';
import { Enterprise, EnterpriseBriefing, BriefingPeriod } from '../../types';
import { callGenerateExecutiveBriefing } from '../../services/persistenceService';

const PERIODS: BriefingPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual'];
const Section: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <ul className="space-y-1">{items.map((it, i) => <li key={i} className="text-sm text-gray-600 font-medium flex gap-2"><span className="text-[#FF0000]">·</span>{it}</li>)}</ul></div>
  );

const EnterpriseBriefings: React.FC<{ enterprise: Enterprise; briefings: EnterpriseBriefing[]; canGenerate: boolean; onReload: () => void }> = ({ enterprise, briefings, canGenerate, onReload }) => {
  const [period, setPeriod] = useState<BriefingPeriod>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');

  const generate = async () => {
    setBusy(true); setError('');
    try { await callGenerateExecutiveBriefing(enterprise.id, period); onReload(); }
    catch (e: any) { setError(e.message || 'Generation failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {canGenerate && (
        <Card title="Generate executive briefing">
          <p className="text-sm text-gray-500 font-medium mb-4">AI synthesizes the latest aggregated intelligence into a leadership briefing. (Runs server-side; deploy-time.)</p>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={period} onChange={(e) => setPeriod(e.target.value as BriefingPeriod)} className="border border-gray-200 rounded-lg p-3 text-sm outline-none capitalize">
              {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <PrimaryButton onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate Briefing'}</PrimaryButton>
          </div>
          {error && <div className="mt-3"><ErrorMessage message={error} /></div>}
        </Card>
      )}

      {briefings.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium py-8 text-center">No briefings yet.</p>
      ) : (
        <div className="space-y-4">
          {briefings.map(b => {
            const isOpen = open === b.id;
            return (
              <Card key={b.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div><h3 className="text-base font-bold text-[#0B0B0B]">{b.title}</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{b.period} · {new Date(b.created_at).toLocaleDateString()}</p></div>
                  <button onClick={() => setOpen(isOpen ? '' : b.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest">{isOpen ? 'Hide' : 'Read'}</button>
                </div>
                {b.summary && <p className="text-sm text-gray-600 font-medium mt-3 line-clamp-2">{b.summary}</p>}
                {isOpen && (
                  <div className="mt-5 space-y-5 animate-in fade-in duration-300">
                    {b.summary && <p className="text-sm text-gray-600 leading-relaxed font-medium">{b.summary}</p>}
                    <Section title="Major wins" items={b.wins} />
                    <Section title="Risks" items={b.risks} />
                    <Section title="Opportunities" items={b.opportunities} />
                    <Section title="Recommendations" items={b.recommendations} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EnterpriseBriefings;
