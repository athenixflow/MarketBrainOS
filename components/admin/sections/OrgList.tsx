// Organizations — read-only admin listings of Team Workspaces, Agencies, and Enterprises, from the
// shared AdminContext load. Rows open detail pages; suspend/restore/archive route through the
// confirm/step-up flow into adminManageOrg (gated by the capability matrix).

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { adminCan } from '../../../config/adminAccess';
import { callAdminManageOrg, AdminOrgKind } from '../../../services/persistenceService';
import { fmtDate } from '../util';

const CONFIG: Record<AdminOrgKind, { title: string; subtitle: string; countLabel: string; countField: string; route: string }> = {
  workspace: { title: 'Workspaces', subtitle: 'Team workspaces across the platform.', countLabel: 'Members', countField: 'member_count', route: 'workspaces' },
  agency: { title: 'Agencies', subtitle: 'Agency organizations and their client books.', countLabel: 'Clients', countField: 'client_count', route: 'agencies' },
  enterprise: { title: 'Enterprise', subtitle: 'Enterprise organizations and linked containers.', countLabel: 'Members', countField: 'member_count', route: 'enterprise' },
};

const OrgList: React.FC<{ kind: AdminOrgKind }> = ({ kind }) => {
  const a = useAdmin();
  const navigate = useNavigate();
  const cfg = CONFIG[kind];
  const rows: any[] = kind === 'workspace' ? a.workspaces : kind === 'agency' ? a.agencies : a.enterprises;

  const active = rows.filter(r => r.status !== 'archived' && r.status !== 'suspended').length;
  const suspended = rows.filter(r => r.status === 'suspended').length;
  const canSuspend = adminCan(a.profile?.role, 'org', 'suspend');

  const orgAction = (r: any, action: 'suspend' | 'restore' | 'archive') => a.confirm({
    scope: action === 'archive' ? 'admin:system_config' : 'admin:user_management', keyword: 'CONFIRM',
    warningTitle: `${action.toUpperCase()} ${cfg.title.slice(0, -1).toUpperCase()}`,
    warningMessage: `${action} "${r.name || cfg.title}". ${action === 'suspend' ? 'Members lose access until restored.' : ''}`,
    run: async () => { await callAdminManageOrg(kind, r.id, action); },
  });

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: r => <button onClick={() => navigate(`/admin/${cfg.route}/${r.id}`)} className="text-sm font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors text-left">{r.name || 'Untitled'}</button> },
    { key: 'owner', header: 'Owner', render: r => <span className="text-xs text-gray-500 truncate block max-w-[160px]">{r.owner_id}</span> },
    { key: 'count', header: cfg.countLabel, render: r => <span className="text-sm font-bold text-[#0B0B0B]">{r[cfg.countField] ?? '—'}</span> },
    { key: 'status', header: 'Status', render: r => <Pill tone={r.status === 'archived' ? 'gray' : r.status === 'suspended' ? 'red' : 'green'}>{r.status || 'active'}</Pill> },
    { key: 'created', header: 'Created', render: r => <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', render: r => canSuspend ? (
      <div className="flex items-center justify-end gap-2">
        {r.status === 'suspended'
          ? <button onClick={() => orgAction(r, 'restore')} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600">Restore</button>
          : <button onClick={() => orgAction(r, 'suspend')} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500">Suspend</button>}
        <button onClick={() => navigate(`/admin/${cfg.route}/${r.id}`)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B]">View</button>
      </div>
    ) : <button onClick={() => navigate(`/admin/${cfg.route}/${r.id}`)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B]">View</button> },
  ];

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={cfg.title} subtitle={cfg.subtitle} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label={`Total ${cfg.title}`} value={rows.length} accent />
        <KpiCard label="Active" value={active} tone="good" />
        <KpiCard label="Suspended" value={suspended} tone={suspended ? 'danger' : 'default'} />
        <KpiCard label="Archived" value={rows.filter(r => r.status === 'archived').length} />
      </div>
      <AdminTable rows={rows} columns={columns} searchKeys={[r => r.name || '', r => r.owner_id || '']}
        searchPlaceholder={`Search ${cfg.title.toLowerCase()}…`} empty={`No ${cfg.title.toLowerCase()} found.`} />
    </div>
  );
};

export default OrgList;
