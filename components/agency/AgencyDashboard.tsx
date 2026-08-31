// Agency Hub — Dashboard panel (Phase 6.2)
import React from 'react';
import { Card } from '../UI';
import { Agency, AgencyClient, WorkspaceMember } from '../../types';

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p><p className="text-3xl font-black text-[#0B0B0B]">{value}</p></Card>
);

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700', growing: 'bg-blue-100 text-blue-700',
  at_risk: 'bg-yellow-100 text-yellow-700', inactive: 'bg-gray-100 text-gray-500',
};

const AgencyDashboard: React.FC<{
  agency: Agency; clients: AgencyClient[]; members: WorkspaceMember[];
  onQuickAction: (tab: string) => void; onOpenClient: (c: AgencyClient) => void;
}> = ({ agency, clients, members, onQuickAction, onOpenClient }) => {
  const activeClients = clients.filter(c => c.status === 'active' || c.status === 'growing').length;
  const totalAnalyses = clients.reduce((s, c) => s + (c.analysis_count || 0), 0);
  const topClients = [...clients].sort((a, b) => (b.analysis_count || 0) - (a.analysis_count || 0)).slice(0, 5);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Total Clients" value={clients.length} />
        <Stat label="Active Clients" value={activeClients} />
        <Stat label="Team Members" value={members.length} />
        <Stat label="Analyses" value={totalAnalyses} />
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Add Client', tab: 'Clients' },
          { label: 'Invite Team Member', tab: 'Members' },
          { label: 'Agency Settings', tab: 'Settings' },
        ].map(a => (
          <button key={a.tab} onClick={() => onQuickAction(a.tab)}
            className="px-5 py-3 rounded-xl bg-[#0B0B0B] text-white text-[11px] font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-colors">{a.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Client Health">
          {clients.length === 0 ? <p className="text-sm text-gray-400 font-medium py-6">No clients yet. Add your first client.</p> : (
            <div className="space-y-3">
              {clients.slice(0, 8).map(c => (
                <button key={c.id} onClick={() => onOpenClient(c)} className="w-full flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{c.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.industry || '—'}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-500'}`}>{c.status.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Agency Intelligence">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Most active clients</p>
          {topClients.length === 0 ? <p className="text-sm text-gray-400 font-medium">No activity yet.</p> : (
            <div className="space-y-2">
              {topClients.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B0B0B] truncate">{c.name}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.analysis_count || 0} analyses</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AgencyDashboard;
