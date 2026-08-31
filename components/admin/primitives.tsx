// Admin UI primitives shared across sections: KPI cards, a reusable searchable + paginated table
// (the codebase had no table/pagination component), section headers, and a "Coming soon" panel for
// features without backend yet. Themed to match the app (#FF0000 / #0B0B0B / white cards).

import React, { useMemo, useState } from 'react';
import { Card } from '../UI';

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; accent?: boolean; tone?: 'default' | 'danger' | 'good' }> =
  ({ label, value, hint, accent, tone = 'default' }) => (
    <Card accent={accent}>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-3">{label}</p>
      <p className={`text-2xl sm:text-3xl font-black leading-none tabular-nums ${tone === 'danger' ? 'text-red-500' : tone === 'good' ? 'text-green-600' : 'text-[#0B0B0B]'}`}>{value}</p>
      {hint && <p className="text-[11px] font-medium text-gray-400 mt-3">{hint}</p>}
    </Card>
  );

export const AdminSectionHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="w-8 h-[2px] bg-[#FF0000] rounded-full" />
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">{title}</h2>
      </div>
      {subtitle && <p className="text-gray-500 font-medium text-sm max-w-2xl leading-relaxed ml-12">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

// Honesty marker for metrics derived from the recent action_logs sample (not platform totals).
export const SampledNote: React.FC<{ n: number; className?: string }> = ({ n, className }) => (
  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-100 ${className || ''}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
    <span className="text-[9px] font-bold text-yellow-700 uppercase tracking-widest">Recent sample · last {n} events</span>
  </div>
);

export const ComingSoon: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-bold text-[#0B0B0B]">{title}</p>
      <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>
    </div>
    <span className="shrink-0 px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-400 text-[9px] font-bold uppercase tracking-widest">Coming soon</span>
  </div>
);

export const ComingSoonCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <Card>
    <div className="flex items-center gap-3 mb-4">
      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-400 text-[9px] font-bold uppercase tracking-widest">Coming soon</span>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight mb-2">{title}</h3>
    <p className="text-sm text-gray-500 font-medium leading-relaxed">{description}</p>
  </Card>
);

// --- Reusable data table with optional search + client-side pagination ---
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function AdminTable<T extends { id?: string }>({
  columns, rows, searchKeys, searchPlaceholder = 'Search…', pageSize = 12, empty = 'No records found.', rightControls,
}: {
  columns: Column<T>[];
  rows: T[];
  searchKeys?: ((row: T) => string)[];
  searchPlaceholder?: string;
  pageSize?: number;
  empty?: string;
  rightControls?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim() || !searchKeys) return rows;
    const needle = q.toLowerCase();
    return rows.filter(r => searchKeys.some(fn => (fn(r) || '').toLowerCase().includes(needle)));
  }, [rows, q, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  // tabular-nums on right-aligned columns so digits share a column width and actually line up.
  const alignCls = (a?: string) => (a === 'right' ? 'text-right tabular-nums' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div>
      {(searchKeys || rightControls) && (
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          {searchKeys ? (
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder={searchPlaceholder}
              className="bg-[#FBFBFB] border border-gray-200 rounded-xl px-5 py-3 text-sm text-[#0B0B0B] outline-none focus:border-[#FF0000]/30 focus:ring-4 focus:ring-[#FF0000]/5 w-full sm:w-80"
            />
          ) : <span />}
          {rightControls}
        </div>
      )}
      <Card className="!p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-400 font-medium text-sm">{empty}</div>
        ) : (
          // min-w is what actually makes the scroller work: with `w-full` alone the table shrank to
          // its container instead of overflowing, so columns collapsed to 1-2 characters and the
          // horizontal scrollbar never appeared. Cell padding is responsive for the same reason.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {columns.map(c => (
                    <th key={c.key} className={`px-4 py-4 sm:px-6 sm:py-5 text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap ${alignCls(c.align)}`}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slice.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-gray-50/50 transition-colors">
                    {columns.map(c => (
                      <td key={c.key} className={`px-4 py-4 sm:px-6 sm:py-5 ${alignCls(c.align)} ${c.className || ''}`}>
                        {c.render ? c.render(row) : (row as any)[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {safePage * pageSize + 1}–{Math.min(filtered.length, (safePage + 1) * pageSize)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
              className="px-4 py-2 rounded-lg bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 hover:text-white transition-colors">Prev</button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">{safePage + 1} / {pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
              className="px-4 py-2 rounded-lg bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 hover:text-white transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small status pill used across tables.
export const Pill: React.FC<{ children: React.ReactNode; tone?: 'gray' | 'green' | 'red' | 'yellow' | 'blue' }> = ({ children, tone = 'gray' }) => {
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-500 border-gray-200',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-500 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };
  return <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${map[tone]}`}>{children}</span>;
};
