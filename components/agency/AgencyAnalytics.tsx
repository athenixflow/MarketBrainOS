// Agency Hub — Analytics panel (Phase 6.2). Derived from clients + members.
import React from 'react';
import { Card } from '../UI';
import { Agency, AgencyClient, WorkspaceMember } from '../../types';

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p><p className="text-2xl sm:text-3xl font-black text-[#0B0B0B] tabular-nums">{value}</p></Card>
);

const AgencyAnalytics: React.FC<{ agency: Agency; clients: AgencyClient[]; members: WorkspaceMember[] }> = ({ agency, clients, members }) => {
  const active = clients.filter(c => c.status === 'active' || c.status === 'growing').length;
  const totalAnalyses = clients.reduce((s, c) => s + (c.analysis_count || 0), 0);
  const topClients = [...clients].sort((a, b) => (b.analysis_count || 0) - (a.analysis_count || 0)).slice(0, 8);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Total Clients" value={clients.length} />
        <Stat label="Active Clients" value={active} />
        <Stat label="Team Members" value={members.length} />
        <Stat label="Total Analyses" value={totalAnalyses} />
      </div>
      <Card title="Top clients by analysis volume">
        {topClients.length === 0 ? <p className="text-sm text-gray-400 font-medium">No data yet.</p> : (
          <div className="space-y-2">{topClients.map(c => (
            <div key={c.id} className="flex items-center justify-between"><span className="text-xs font-bold text-[#0B0B0B] truncate">{c.name}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.analysis_count || 0}</span></div>
          ))}</div>
        )}
      </Card>
    </div>
  );
};

export default AgencyAnalytics;
