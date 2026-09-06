// Agency Hub — Analytics panel (Phase 6.2). Derived from clients + members.
import React from 'react';
import { Card, Stat, EmptyState } from '../UI';
import { Agency, AgencyClient, WorkspaceMember } from '../../types';

const AgencyAnalytics: React.FC<{ agency: Agency; clients: AgencyClient[]; members: WorkspaceMember[] }> = ({ agency, clients, members }) => {
  const active = clients.filter(c => c.status === 'active' || c.status === 'growing').length;
  const totalAnalyses = clients.reduce((s, c) => s + (c.analysis_count || 0), 0);
  const topClients = [...clients].sort((a, b) => (b.analysis_count || 0) - (a.analysis_count || 0)).slice(0, 8);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><Stat label="Total Clients" value={clients.length} /></Card>
        <Card><Stat label="Active Clients" value={active} /></Card>
        <Card><Stat label="Team Members" value={members.length} /></Card>
        <Card><Stat label="Total Analyses" value={totalAnalyses} /></Card>
      </div>
      <Card title="Top clients by analysis volume">
        {topClients.length === 0 ? <EmptyState message="No data yet" submessage="Run analyses inside a client workspace to see volume by client." /> : (
          <div className="space-y-2">{topClients.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-[#0B0B0B] truncate">{c.name}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{c.analysis_count || 0}</span></div>
          ))}</div>
        )}
      </Card>
    </div>
  );
};

export default AgencyAnalytics;
