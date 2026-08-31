// Enterprise Suite — Executive Intelligence Center (Phase 6.3)
import React from 'react';
import { Card, EmptyState } from '../UI';
import { EnterpriseBriefing, EnterpriseForecast } from '../../types';

// items defaults to [] - these are server-written docs, so a missing field must not throw on .length.
const List: React.FC<{ title: string; items?: string[]; color: string }> = ({ title, items = [], color }) => (
  <Card title={title}>
    {items.length === 0 ? <p className="text-sm text-gray-400 font-medium">None surfaced.</p> : (
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className={`w-1.5 h-1.5 rounded-full mt-2 ${color}`} />
            <p className="text-sm text-gray-600 font-medium flex-1">{it}</p>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const TREND: Record<string, string> = { up: '↑', flat: '→', down: '↓' };
const TREND_COLOR: Record<string, string> = { up: 'text-green-600', flat: 'text-gray-400', down: 'text-red-600' };

const EnterpriseIntelligence: React.FC<{ latest: EnterpriseBriefing | null; forecasts: EnterpriseForecast[] }> = ({ latest, forecasts }) => {
  if (!latest && forecasts.length === 0) {
    return <EmptyState message="No executive intelligence yet." submessage="Generate a briefing (Briefings tab) and run aggregation to populate strategic priorities, risks, and forecasts." />;
  }
  return (
    <div className="space-y-8">
      {latest && (
        <>
          <Card title={latest.title}>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">{latest.summary}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4">{latest.period} · {new Date(latest.created_at).toLocaleDateString()}</p>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <List title="Strategic Opportunities" items={latest.opportunities} color="bg-green-500" />
            <List title="Emerging Risks" items={latest.risks} color="bg-red-500" />
            <List title="Executive Recommendations" items={latest.recommendations} color="bg-blue-500" />
            <List title="Major Wins" items={latest.wins} color="bg-purple-500" />
          </div>
        </>
      )}
      {forecasts.length > 0 && (
        <Card title="Forecasting">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forecasts.map(f => (
              <div key={f.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{f.label}</p>
                  <span className={`text-lg font-black ${TREND_COLOR[f.trend] || ''}`}>{TREND[f.trend] || ''}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium mt-1">{f.projection}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default EnterpriseIntelligence;
