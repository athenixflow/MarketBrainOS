// Agency detail — info, members, client book, and activity. Client rows open the client detail.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import { getAgencyMembers, getAgencyClients } from '../../../services/persistenceService';
import { WorkspaceMember, AgencyClient } from '../../../types';
import { fmtDate } from '../util';

const AgencyDetail: React.FC = () => {
  const { id } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const ag: any = a.agencies.find(g => g.id === id);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [clients, setClients] = useState<AgencyClient[]>([]);

  useEffect(() => {
    if (!id) return;
    getAgencyMembers(id).then(setMembers).catch(() => {});
    getAgencyClients(id).then(setClients).catch(() => {});
  }, [id]);

  const tokens = useMemo(() => a.actionLogs.filter(l => (l as any).agency_id === id).reduce((n, l) => n + (l.tokens_used || 0), 0), [a.actionLogs, id]);

  if (!ag) return (
    <div>
      <AdminSectionHeader title="Agency" actions={<button onClick={() => navigate('/admin/agencies')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">Agency not found.</p></Card>
    </div>
  );

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={ag.name || 'Agency'} subtitle={`Owner ${ag.owner_id} • ${ag.status || 'active'}`}
        actions={<button onClick={() => navigate('/admin/agencies')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Agencies</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Members" value={members.length || ag.member_count || 0} accent />
        <KpiCard label="Clients" value={clients.length || ag.client_count || 0} />
        <KpiCard label="Tokens Used" value={tokens} />
        <KpiCard label="Status" value={ag.status || 'active'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Members (${members.length})`}>
          {members.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No members loaded.</p> : (
            <div className="divide-y divide-gray-50">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3 first:pt-0">
                  <p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}</p>
                  <Pill tone={m.role === 'agency_owner' ? 'red' : 'gray'}>{m.role.replace('agency_', '')}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={`Clients (${clients.length})`}>
          {clients.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No clients.</p> : (
            <div className="divide-y divide-gray-50">
              {clients.map(c => (
                <button key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="w-full flex items-center justify-between py-3 first:pt-0 text-left hover:opacity-70">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate hover:text-[#FF0000]">{c.name}</p><p className="text-[10px] text-gray-400">{c.industry || '—'}</p></div>
                  <Pill tone={c.status === 'at_risk' ? 'red' : c.status === 'active' || c.status === 'growing' ? 'green' : 'gray'}>{c.status}</Pill>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AgencyDetail;
