// Enterprise Suite — Department & Team Performance (Phase 6.3)
import React from 'react';
import { Card, EmptyState } from '../UI';
import { EnterpriseAnalyticsSnapshot, EnterpriseDepartment, EnterpriseBrand } from '../../types';
import { getToolMeta } from '../../config/toolConfigs';

const EnterprisePerformance: React.FC<{
  analytics: EnterpriseAnalyticsSnapshot | null; departments: EnterpriseDepartment[]; brands: EnterpriseBrand[];
}> = ({ analytics, departments, brands }) => {
  const byModule = analytics?.by_module || [];
  if (!analytics && departments.length === 0 && brands.length === 0) {
    return <EmptyState message="No performance data yet." submessage="Add departments/brands and run aggregation to measure performance across the organization." />;
  }
  return (
    <div className="space-y-8">
      <Card title="Tool usage across the organization">
        {byModule.length === 0 ? <p className="text-sm text-gray-400 font-medium">Run aggregation to populate usage.</p> : (
          <div className="space-y-2">
            {byModule.slice(0, 10).map(m => (
              <div key={m.module} className="flex items-center justify-between"><span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(m.module)?.label || m.module}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{m.count}</span></div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title={`Departments (${departments.length})`}>
          {departments.length === 0 ? <p className="text-sm text-gray-400 font-medium">No departments defined.</p> : (
            <div className="space-y-2">
              {departments.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div><p className="text-sm font-bold text-[#0B0B0B]">{d.name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.type || 'General'}</p></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(d.linked_workspaces || []).length} teams</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={`Brands (${brands.length})`}>
          {brands.length === 0 ? <p className="text-sm text-gray-400 font-medium">No brands defined.</p> : (
            <div className="space-y-2">
              {brands.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div><p className="text-sm font-bold text-[#0B0B0B]">{b.name}</p><p className="text-[10px] font-medium text-gray-400 truncate max-w-[200px]">{b.description || '—'}</p></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(b.linked_workspaces || []).length} teams</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default EnterprisePerformance;
