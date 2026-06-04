// Tool Performance — per-tool usage, success/failure, and token consumption from action_logs.
// Availability toggles live in Feature Flags; per-tool cost editing arrives with the cost-override
// function (deploy required).

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, ComingSoon, Column, SampledNote } from '../primitives';

interface ToolRow { id: string; module: string; runs: number; success: number; failed: number; tokens: number; }

const Tools: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();

  const rows: ToolRow[] = useMemo(() => {
    const map = new Map<string, ToolRow>();
    a.actionLogs.forEach(l => {
      if (!l.module) return;
      const r = map.get(l.module) || { id: l.module, module: l.module, runs: 0, success: 0, failed: 0, tokens: 0 };
      r.runs++;
      if (l.status === 'success') r.success++;
      if (l.status === 'failed_refunded') r.failed++;
      r.tokens += l.tokens_used || 0;
      map.set(l.module, r);
    });
    return [...map.values()].sort((x, y) => y.runs - x.runs);
  }, [a.actionLogs]);

  const topTool = rows[0]?.module || '—';
  const totalRuns = rows.reduce((n, r) => n + r.runs, 0);

  const columns: Column<ToolRow>[] = [
    { key: 'module', header: 'Tool', render: r => <span className="text-sm font-bold text-[#0B0B0B]">{r.module}</span> },
    { key: 'runs', header: 'Runs', render: r => <span className="text-sm font-bold text-[#0B0B0B]">{r.runs}</span> },
    { key: 'rate', header: 'Success', render: r => { const rate = r.runs ? Math.round((r.success / r.runs) * 100) : 0; return <Pill tone={rate >= 90 ? 'green' : rate >= 70 ? 'yellow' : 'red'}>{rate}%</Pill>; } },
    { key: 'failed', header: 'Failed', render: r => <span className={`text-xs font-bold ${r.failed ? 'text-red-500' : 'text-gray-400'}`}>{r.failed}</span> },
    { key: 'tokens', header: 'Tokens', align: 'right', render: r => <span className="text-xs font-bold text-gray-600">{r.tokens}</span> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Tools" subtitle="Per-tool performance from recent activity."
        actions={<SampledNote n={a.metrics.sampleSize} />} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Tools Used" value={rows.length} accent />
        <KpiCard label="Total Runs" value={totalRuns} />
        <KpiCard label="Most Used" value={<span className="text-lg">{topTool}</span>} />
        <KpiCard label="Tokens Consumed" value={rows.reduce((n, r) => n + r.tokens, 0)} />
      </div>

      <AdminTable rows={rows} columns={columns} searchKeys={[r => r.module]} searchPlaceholder="Search tools…" empty="No tool activity yet." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Availability">
          <p className="text-sm text-gray-500 font-medium mb-6">Enable, disable, or put tools in maintenance from Feature Flags.</p>
          <button onClick={() => navigate('/admin/flags')} className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest border-b border-[#FF0000]/20 pb-1 hover:opacity-60">Open Feature Flags →</button>
        </Card>
        <Card title="Token Cost Management">
          <ComingSoon title="Editable per-tool token cost" description="Cost overrides land with the system-settings cost function (deploy required)." />
        </Card>
      </div>
    </div>
  );
};

export default Tools;
