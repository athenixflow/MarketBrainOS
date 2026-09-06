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
    return <EmptyState card message="No performance data yet" submessage="Add departments or brands and refresh analytics to measure performance across the organization." />;
  }
  return (
    <div className="space-y-8">
      <Card title="Tool usage across the organization">
        {byModule.length === 0 ? <EmptyState message="No usage data yet" submessage="Refresh analytics from the Dashboard to populate tool usage." /> : (
          <div className="space-y-2">
            {byModule.slice(0, 10).map(m => (
              <div key={m.module} className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(m.module)?.label || m.module}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{m.count}</span></div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title={`Departments (${departments.length})`}>
          {departments.length === 0 ? <EmptyState message="No departments defined" submessage="Add departments in the Structure tab." /> : (
            <div className="space-y-2">
              {departments.map(d => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{d.name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.type || 'General'}</p></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums shrink-0">{(d.linked_workspaces || []).length} teams</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={`Brands (${brands.length})`}>
          {brands.length === 0 ? <EmptyState message="No brands defined" submessage="Add brands in the Structure tab." /> : (
            <div className="space-y-2">
              {brands.map(b => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{b.name}</p><p className="text-[10px] font-medium text-gray-400 truncate">{b.description || 'No description'}</p></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums shrink-0">{(b.linked_workspaces || []).length} teams</span>
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
