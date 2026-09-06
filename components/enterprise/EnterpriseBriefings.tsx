// Enterprise Suite — Briefings Center (Phase 6.3)
import React, { useState } from 'react';
import { Card, PrimaryButton, Select, ErrorMessage, EmptyState } from '../UI';
import { Enterprise, EnterpriseBriefing, BriefingPeriod } from '../../types';
import { callGenerateExecutiveBriefing } from '../../services/persistenceService';

const PERIODS: BriefingPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual'];
const PERIOD_OPTIONS = PERIODS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));
const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

// `items` is declared required in types.ts but these are server-written documents, so a missing field
// would throw on .length rather than render empty. Default it.
const Section: React.FC<{ title: string; items?: string[] }> = ({ title, items = [] }) =>
  items.length === 0 ? null : (
    <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
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
          <p className="text-sm text-gray-500 font-medium mb-6">AI synthesizes the latest aggregated intelligence into a leadership briefing.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Select compact ariaLabel="Briefing period" value={period} onChange={(v) => setPeriod(v as BriefingPeriod)} options={PERIOD_OPTIONS} className="w-44" />
            <PrimaryButton onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate Briefing'}</PrimaryButton>
          </div>
          {error && <ErrorMessage message={error} className="mt-4" />}
        </Card>
      )}

      {briefings.length === 0 ? (
        <EmptyState card message="No briefings yet" submessage={canGenerate ? 'Generate your first executive briefing above.' : 'Briefings generated for your organization will appear here.'} />
      ) : (
        <div className="space-y-4">
          {briefings.map(b => {
            const isOpen = open === b.id;
            return (
              <Card key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0"><h3 className="text-base font-bold text-[#0B0B0B]">{b.title}</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{b.period} · {new Date(b.created_at).toLocaleDateString()}</p></div>
                  <button onClick={() => setOpen(isOpen ? '' : b.id)} aria-expanded={isOpen} className={rowAction}>{isOpen ? 'Hide' : 'Read'}</button>
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
