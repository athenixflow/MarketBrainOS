// Enterprise detail — leadership, departments, brands, members, and a relationship hierarchy.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import RelationshipTree, { TreeNode } from '../RelationshipTree';
import { getEnterpriseMembers, getEnterpriseDepartments, getEnterpriseBrands } from '../../../services/persistenceService';
import { WorkspaceMember, EnterpriseDepartment, EnterpriseBrand } from '../../../types';
import { fmtDate } from '../util';

const EnterpriseDetail: React.FC = () => {
  const { id } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const ent: any = a.enterprises.find(e => e.id === id);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [departments, setDepartments] = useState<EnterpriseDepartment[]>([]);
  const [brands, setBrands] = useState<EnterpriseBrand[]>([]);

  useEffect(() => {
    if (!id) return;
    getEnterpriseMembers(id).then(setMembers).catch(() => {});
    getEnterpriseDepartments(id).then(setDepartments).catch(() => {});
    getEnterpriseBrands(id).then(setBrands).catch(() => {});
  }, [id]);

  const tree: TreeNode = useMemo(() => ({
    label: ent?.name || 'Enterprise', sublabel: `${members.length} users`,
    children: [
      ...brands.map(b => ({ label: b.name, sublabel: 'Brand', children: (b.linked_workspaces || []).map(w => ({ label: w, sublabel: 'workspace' })) })),
      ...departments.map(d => ({ label: d.name, sublabel: d.type || 'Department', children: (d.linked_workspaces || []).map(w => ({ label: w, sublabel: 'workspace' })) })),
    ],
  }), [ent, brands, departments, members.length]);

  if (!ent) return (
    <div>
      <AdminSectionHeader title="Enterprise" actions={<button onClick={() => navigate('/admin/enterprise')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">Enterprise not found.</p></Card>
    </div>
  );

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={ent.name || 'Enterprise'} subtitle={`Owner ${ent.owner_id} • ${ent.status || 'active'}`}
        actions={<button onClick={() => navigate('/admin/enterprise')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Enterprise</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Members" value={members.length || ent.member_count || 0} accent />
        <KpiCard label="Departments" value={departments.length} />
        <KpiCard label="Brands" value={brands.length} />
        <KpiCard label="Status" value={ent.status || 'active'} />
      </div>

      <Card title="Organization Hierarchy">
        {(brands.length === 0 && departments.length === 0)
          ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No departments or brands defined.</p>
          : <RelationshipTree root={tree} />}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Departments (${departments.length})`}>
          {departments.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">None.</p> : (
            <div className="divide-y divide-gray-50">{departments.map(d => (
              <div key={d.id} className="flex items-center justify-between py-3 first:pt-0"><p className="text-sm font-bold text-[#0B0B0B]">{d.name}</p><Pill tone="gray">{d.type || 'Dept'}</Pill></div>
            ))}</div>
          )}
        </Card>
        <Card title={`Brands (${brands.length})`}>
          {brands.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">None.</p> : (
            <div className="divide-y divide-gray-50">{brands.map(b => (
              <div key={b.id} className="flex items-center justify-between py-3 first:pt-0"><p className="text-sm font-bold text-[#0B0B0B]">{b.name}</p><span className="text-[10px] text-gray-400">{fmtDate(b.created_at)}</span></div>
            ))}</div>
          )}
        </Card>
      </div>

      <Card title={`Leadership & Members (${members.length})`}>
        {members.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No members loaded.</p> : (
          <div className="divide-y divide-gray-50">{members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-3 first:pt-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}</p><Pill tone={m.role === 'enterprise_owner' ? 'red' : 'blue'}>{m.role.replace('enterprise_', '').replace('_', ' ')}</Pill></div>
          ))}</div>
        )}
      </Card>
    </div>
  );
};

export default EnterpriseDetail;
