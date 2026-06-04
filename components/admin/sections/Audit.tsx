// Audit Logs — the immutable, hash-chained ledger of every admin action.

import React from 'react';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader } from '../primitives';

const Audit: React.FC = () => {
  const a = useAdmin();
  return (
    <div>
      <AdminSectionHeader
        title="Audit Logs"
        subtitle="Immutable, hash-chained record of every administrative action."
        actions={<button onClick={a.runManualIntegrityCheck} className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest">{a.verifyingChain ? 'Verifying…' : 'Verify Sequence'}</button>}
      />
      {a.auditLogs.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center font-medium italic">No admin actions recorded yet.</p> : (
        <div className="space-y-4">
          {a.auditLogs.map(log => (
            <div key={log.id} className="p-6 bg-white border border-gray-100 rounded-[24px] flex flex-col gap-3 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[13px] font-black uppercase text-[#0B0B0B]">{log.action_type}</span></div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-8 text-[11px]">
                <div><p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Actor</p><p className="font-bold text-[#0B0B0B] truncate">{log.admin_email}</p></div>
                <div><p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Target</p><p className="font-bold text-[#0B0B0B] truncate">{log.target}</p></div>
              </div>
              {log.metadata && log.metadata.changes && (
                <div className="pt-3 border-t border-gray-50">
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Change Delta</p>
                  <pre className="text-[9px] font-mono text-gray-500 bg-gray-50 p-2 rounded-lg overflow-x-auto">{JSON.stringify(log.metadata.changes, null, 2)}</pre>
                </div>
              )}
              <div className="pt-3 border-t border-gray-50">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">Block Hash</p>
                <code className="text-[10px] font-mono text-gray-400 break-all bg-gray-50 p-2 rounded-lg block">{log.hash}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Audit;
