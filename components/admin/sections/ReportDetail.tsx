// Report detail — report metadata + content, with admin archive/delete actions.

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { itemText } from '../../ResultSections';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import { adminCan } from '../../../config/adminAccess';
import { callAdminManageReport } from '../../../services/persistenceService';
import { fmtDate } from '../util';

const ReportDetail: React.FC = () => {
  const { id } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const r = a.reports.find(x => x.id === id);
  const canDelete = adminCan(a.profile?.role, 'content', 'delete');

  if (!r) return (
    <div>
      <AdminSectionHeader title="Report" actions={<button onClick={() => navigate('/admin/reports')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">Report not found (admin read requires the rules deploy).</p></Card>
    </div>
  );

  const sections = Array.isArray(r.content?.sections) ? r.content.sections : null;

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={r.title || 'Report'} subtitle={`${r.report_type || 'report'} • ${r.visibility_type || 'private'}`}
        actions={<button onClick={() => navigate('/admin/reports')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Reports</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Type" value={<span className="text-lg">{r.report_type || '—'}</span>} accent />
        <KpiCard label="Visibility" value={<span className="text-lg">{r.visibility_type || 'private'}</span>} />
        <KpiCard label="Created" value={<span className="text-lg">{fmtDate(r.created_at)}</span>} />
        <KpiCard label="Creator" value={<span className="text-xs break-all">{r.creator_user_id}</span>} />
      </div>

      {canDelete && (
        <div className="flex gap-3">
          <button onClick={() => a.confirm({ scope: 'admin:system_config', keyword: 'CONFIRM', warningTitle: 'ARCHIVE REPORT', warningMessage: `Archive "${r.title}".`, run: async () => { await callAdminManageReport(r.id!, 'archive'); navigate('/admin/reports'); } })} className="px-5 py-2.5 rounded-xl bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest hover:text-[#0B0B0B]">Archive</button>
          <button onClick={() => a.confirm({ scope: 'admin:system_config', keyword: 'DELETE', warningTitle: 'DELETE REPORT', warningMessage: `Permanently delete "${r.title}".`, run: async () => { await callAdminManageReport(r.id!, 'delete'); navigate('/admin/reports'); } })} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-[10px] font-bold uppercase tracking-widest">Delete</button>
        </div>
      )}

      <Card title="Content">
        {sections ? (
          <div className="space-y-6">
            {sections.map((s: any, i: number) => (
              <div key={i}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{s.title}</p>
                <ul className="space-y-1.5">{(s.items || []).map((it: any, j: number) => <li key={j} className="text-sm text-gray-600 font-medium flex gap-2"><span className="mt-2 w-1 h-1 rounded-full bg-[#FF0000] shrink-0" />{itemText(it)}</li>)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <pre className="text-[11px] font-mono text-gray-500 bg-gray-50 p-4 rounded-xl overflow-x-auto max-h-96">{typeof r.content === 'string' ? r.content : JSON.stringify(r.content, null, 2)}</pre>
        )}
      </Card>
    </div>
  );
};

export default ReportDetail;
