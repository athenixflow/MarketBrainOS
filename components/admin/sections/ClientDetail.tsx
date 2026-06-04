// Client detail — client info, assigned team, analysis/report stats, notes, and activity.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import { getClient, getClientAssignments, getClientNotes, getClientActivity } from '../../../services/persistenceService';
import { AgencyClient, ClientAssignment, ClientNote, ClientActivity } from '../../../types';
import { fmtDate, fmtDateTime } from '../util';

const ClientDetail: React.FC = () => {
  const { id } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const [client, setClient] = useState<AgencyClient | null>(null);
  const [team, setTeam] = useState<ClientAssignment[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [activity, setActivity] = useState<ClientActivity[]>([]);

  useEffect(() => {
    if (!id) return;
    getClient(id).then(setClient).catch(() => {});
    getClientAssignments(id).then(setTeam).catch(() => {});
    getClientNotes(id).then(setNotes).catch(() => {});
    getClientActivity(id).then(setActivity).catch(() => {});
  }, [id]);

  const stats = useMemo(() => {
    const analyses = a.actionLogs.filter(l => (l as any).client_id === id).length;
    const tokens = a.actionLogs.filter(l => (l as any).client_id === id).reduce((n, l) => n + (l.tokens_used || 0), 0);
    const reports = a.reports.filter(r => r.client_id === id).length;
    return { analyses, tokens, reports };
  }, [a.actionLogs, a.reports, id]);

  if (!client) return (
    <div>
      <AdminSectionHeader title="Client" actions={<button onClick={() => navigate('/admin/agencies')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">Loading client…</p></Card>
    </div>
  );

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={client.name} subtitle={`${client.industry || 'Client'} • ${client.status}`}
        actions={<button onClick={() => navigate(`/admin/agencies/${client.agency_id}`)} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Agency</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Analyses" value={stats.analyses} accent />
        <KpiCard label="Reports" value={stats.reports} />
        <KpiCard label="Tokens Used" value={stats.tokens} />
        <KpiCard label="Status" value={client.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Client Info">
          {[['Name', client.name], ['Industry', client.industry || '—'], ['Website', client.website || '—'], ['Contact', client.primary_contact || '—'], ['Email', client.email || '—'], ['Created', fmtDate(client.created_at)]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k}</span><span className="text-sm font-bold text-[#0B0B0B] truncate max-w-[60%]">{v}</span></div>
          ))}
        </Card>
        <Card title={`Assigned Team (${team.length})`}>
          {team.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No assignments.</p> : (
            <div className="divide-y divide-gray-50">
              {team.map(t => (
                <div key={t.id} className="flex items-center justify-between py-3 first:pt-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{t.email}</p><Pill tone="blue">{t.assignment_role.replace('_', ' ')}</Pill></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Notes (${notes.length})`}>
          {notes.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No notes.</p> : (
            <div className="space-y-3">{notes.map(nt => (
              <div key={nt.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-sm text-gray-600 font-medium">{nt.content}</p><p className="text-[10px] text-gray-400 mt-2">{fmtDate(nt.created_at)}</p></div>
            ))}</div>
          )}
        </Card>
        <Card title="Activity Feed">
          {activity.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No activity.</p> : (
            <div className="divide-y divide-gray-50">{activity.map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-3 first:pt-0"><span className="text-xs font-medium text-gray-600">{ev.summary}</span><span className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(ev.created_at)}</span></div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ClientDetail;
