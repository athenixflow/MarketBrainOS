// AI Operations — request volume and error analytics from action_logs (real). Provider latency,
// request queue, per-request cost, and model performance have no backend telemetry yet → Coming soon.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill, ComingSoon, SampledNote } from '../primitives';
import { DonutChart } from '../Charts';

const AIOps: React.FC = () => {
  const a = useAdmin();
  const m = a.metrics;

  const errorCats = useMemo(() => {
    const cats: Record<string, number> = {};
    a.actionLogs.forEach(l => { if (l.error_code) { const key = l.error_code.split(/[:/]/)[0].slice(0, 24); cats[key] = (cats[key] || 0) + 1; } });
    return Object.entries(cats).map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 6);
  }, [a.actionLogs]);

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="AI Operations" subtitle="Request analytics from recent activity. Provider/queue/model telemetry is on the roadmap."
        actions={<SampledNote n={m.sampleSize} />} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="AI Requests (sampled)" value={m.sampleSize} accent />
        <KpiCard label="Successful" value={m.statusCounts.success} tone="good" />
        <KpiCard label="Failed" value={m.statusCounts.failed} tone={m.statusCounts.failed ? 'danger' : 'default'} />
        <KpiCard label="Blocked" value={m.statusCounts.blocked} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Error Categories">
          {errorCats.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center font-medium">No errors in window. ✓</p> : <DonutChart data={errorCats} />}
        </Card>
        <Card title="Provider">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-bold text-[#0B0B0B]">Gemini (gemini-2.5-pro)</span>
            <Pill tone="green">Active</Pill>
          </div>
          <div className="space-y-3">
            <ComingSoon title="Latency & Error-rate Telemetry" description="Per-provider latency and error monitoring." />
            <ComingSoon title="Request Queue" description="Queue depth, retries, and job status." />
            <ComingSoon title="Model Performance & Cost" description="Per-request cost and model comparison." />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AIOps;
