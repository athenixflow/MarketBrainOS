// Security — the emergency lockdown kill switch (super_admin only), the immutable security
// exceptions ledger, and ledger-integrity status.

import React from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard } from '../primitives';

const Security: React.FC = () => {
  const a = useAdmin();
  const isSuper = a.profile?.role === 'super_admin';
  const locked = a.isEmergencyActive;

  const toggleLockdown = () => a.confirm({
    type: 'TOGGLE_LOCKDOWN', scope: 'admin:system_config', payload: { active: !locked },
    warningTitle: locked ? 'RELEASE SYSTEM LOCKDOWN' : 'ACTIVATE SYSTEM LOCKDOWN',
    warningMessage: locked ? 'Restore full platform functionality and user access.' : 'Immediately halt all neural operations, suspend authentication, and block user access. Drastic emergency measure.',
    keyword: locked ? 'RELEASE' : 'LOCKDOWN',
  });

  const critical = a.securityLogs.filter(l => l.severity === 'critical').length;

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Security" subtitle="Threat ledger, ledger integrity, and the platform kill switch." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Security Events" value={a.securityLogs.length} />
        <KpiCard label="Critical" value={critical} tone={critical ? 'danger' : 'good'} />
        <KpiCard label="Ledger Chain" value={a.chainValid === false ? 'ERROR' : 'Valid'} tone={a.chainValid === false ? 'danger' : 'good'} />
        <KpiCard label="System State" value={locked ? 'LOCKED' : 'Online'} tone={locked ? 'danger' : 'good'} />
      </div>

      <Card title="System Kill Switch" className={`!border-2 ${locked ? 'border-red-600 bg-red-50' : 'border-gray-100'}`}>
        <p className="text-sm font-medium text-gray-500 leading-relaxed mb-8">
          {locked ? 'System is frozen. Only recovery actions and lockdown release are permitted.' : 'Immediately freeze all platform operations, AI processing, and authentication.'}
        </p>
        <button disabled={!isSuper} onClick={toggleLockdown}
          className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all ${locked ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20'} disabled:opacity-20`}>
          {locked ? 'Release Operational Lockdown' : 'Activate System Lockdown'}
        </button>
        {!isSuper && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4 text-center">Super-admin clearance required.</p>}
      </Card>

      <Card title="Security Exceptions Ledger">
        {a.securityLogs.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center font-medium italic">Zero security signatures detected.</p> : (
          <div className="space-y-4">{a.securityLogs.map(log => (
            <div key={log.id} className={`p-6 border rounded-[24px] flex flex-col gap-3 ${log.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex justify-between items-center gap-4">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${log.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{log.event_type}</span>
                <span className="text-[10px] font-bold text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-sm font-medium text-gray-600 italic">"{log.details}"</p>
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
};

export default Security;
