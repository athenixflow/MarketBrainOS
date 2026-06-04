// Unified admin search (Prompt 7) — ONE search engine over users, workspaces, agencies,
// enterprises, reports, and transactions, all from the single AdminContext load. Each result
// links to its detail view, wiring the entity relationships together.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext';
import { Pill } from './primitives';

interface Result { type: string; tone: any; label: string; sub?: string; to: string; }

const GlobalSearch: React.FC<{ placeholder?: string }> = ({ placeholder = 'Search users, workspaces, agencies, enterprises, reports, transactions…' }) => {
  const a = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const results = useMemo<Result[]>(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    const out: Result[] = [];
    const hit = (s?: string) => (s || '').toLowerCase().includes(n);

    a.users.forEach(u => { if (hit(u.email) || hit(u.id) || hit(u.company_name)) out.push({ type: 'User', tone: 'blue', label: u.email, sub: u.tier, to: `/admin/users/${u.id}` }); });
    a.workspaces.forEach(w => { if (hit((w as any).name) || hit(w.id) || hit((w as any).owner_id)) out.push({ type: 'Workspace', tone: 'gray', label: (w as any).name || 'Workspace', sub: `${(w as any).member_count ?? 0} members`, to: `/admin/workspaces/${w.id}` }); });
    a.agencies.forEach(g => { if (hit((g as any).name) || hit(g.id) || hit((g as any).owner_id)) out.push({ type: 'Agency', tone: 'red', label: (g as any).name || 'Agency', sub: `${(g as any).client_count ?? 0} clients`, to: `/admin/agencies/${g.id}` }); });
    a.enterprises.forEach(e => { if (hit((e as any).name) || hit(e.id)) out.push({ type: 'Enterprise', tone: 'yellow', label: (e as any).name || 'Enterprise', to: `/admin/enterprise/${e.id}` }); });
    a.reports.forEach(r => { if (hit(r.title) || hit(r.id || '')) out.push({ type: 'Report', tone: 'green', label: r.title || 'Report', sub: r.report_type, to: `/admin/reports/${r.id}` }); });
    a.payments.forEach(p => { if (hit(p.uid) || hit(p.payment_reference || '')) out.push({ type: 'Transaction', tone: 'green', label: `$${p.amount_paid} • ${p.tokens_credited} tokens`, sub: p.uid, to: `/admin/transactions` }); });

    return out.slice(0, 12);
  }, [q, a.users, a.workspaces, a.agencies, a.enterprises, a.reports, a.payments]);

  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#121212] border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-[#FF0000]/40 placeholder:text-gray-600" />
      {results.length > 0 && (
        <div className="absolute z-30 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} onClick={() => { setQ(''); navigate(r.to); }}
              className="w-full text-left px-6 py-3.5 hover:bg-gray-50 flex items-center justify-between gap-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <Pill tone={r.tone}>{r.type}</Pill>
                <span className="text-sm font-bold text-[#0B0B0B] truncate">{r.label}</span>
              </div>
              {r.sub && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">{r.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {q.trim() && results.length === 0 && (
        <div className="absolute z-30 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-400 font-medium">No matches for "{q}".</p>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
