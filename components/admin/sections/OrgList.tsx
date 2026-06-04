// Organizations — read-only admin listings of Team Workspaces, Agencies, and Enterprises.

import React, { useEffect, useState } from 'react';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { adminGetWorkspaces, adminGetAgencies, adminGetEnterprises } from '../../../services/persistenceService';
import { fmtDate } from '../util';

type Kind = 'workspace' | 'agency' | 'enterprise';
const CONFIG: Record<Kind, { title: string; subtitle: string; countLabel: string; countField: string }> = {
  workspace: { title: 'Workspaces', subtitle: 'Team workspaces across the platform.', countLabel: 'Members', countField: 'member_count' },
  agency: { title: 'Agencies', subtitle: 'Agency organizations and their client books.', countLabel: 'Clients', countField: 'client_count' },
  enterprise: { title: 'Enterprise', subtitle: 'Enterprise organizations and linked containers.', countLabel: 'Members', countField: 'member_count' },
};

const OrgList: React.FC<{ kind: Kind }> = ({ kind }) => {
  useAdmin(); // ensure within provider (consistency)
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fn = kind === 'workspace' ? adminGetWorkspaces : kind === 'agency' ? adminGetAgencies : adminGetEnterprises;
    fn().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [kind]);

  const active = rows.filter(r => r.status !== 'archived').length;

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: r => <span className="text-sm font-bold text-[#0B0B0B]">{r.name || 'Untitled'}</span> },
    { key: 'owner', header: 'Owner', render: r => <span className="text-xs text-gray-500 truncate block max-w-[180px]">{r.owner_id}</span> },
    { key: 'count', header: cfg.countLabel, render: r => <span className="text-sm font-bold text-[#0B0B0B]">{r[cfg.countField] ?? '—'}</span> },
    { key: 'status', header: 'Status', render: r => <Pill tone={r.status === 'archived' ? 'gray' : 'green'}>{r.status || 'active'}</Pill> },
    { key: 'created', header: 'Created', align: 'right', render: r => <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span> },
  ];

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={cfg.title} subtitle={cfg.subtitle} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <KpiCard label={`Total ${cfg.title}`} value={rows.length} accent />
        <KpiCard label="Active" value={active} tone="good" />
        <KpiCard label="Archived" value={rows.length - active} />
      </div>
      <AdminTable rows={rows} columns={columns} searchKeys={[r => r.name || '', r => r.owner_id || '']}
        searchPlaceholder={`Search ${cfg.title.toLowerCase()}…`} empty={loading ? 'Loading…' : `No ${cfg.title.toLowerCase()} found.`} />
    </div>
  );
};

export default OrgList;
