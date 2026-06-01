// MarketBrain OS — Scope Switcher (Phase 6.0)
//
// Lets a user move between their personal context and any organizational container they
// belong to. The active scope drives history/reports/dashboards and stamps new analyses.
// Renders nothing until the user actually belongs to a container (so V1 users see no change).

import React, { useState, useRef, useEffect } from 'react';
import { useScope } from '../context/ScopeContext';
import { Scope } from '../types';

const ScopeSwitcher: React.FC = () => {
  const { scope, memberships, setScope, resetToPersonal } = useScope();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // V1 users (no memberships) get no switcher — the spine is present but invisible.
  if (memberships.length === 0) return null;

  // Only workspace + enterprise memberships map to an analysis scope here; agency
  // containers are entered via the Agency Hub (client selection) in Phase 6.2.
  const switchable = memberships.filter(m => m.family === 'workspace' || m.family === 'enterprise');

  const label =
    scope.level === 'personal' ? 'Personal'
    : (memberships.find(m =>
        (scope.level === 'team' && m.containerId === scope.workspaceId) ||
        (scope.level === 'enterprise' && m.containerId === scope.enterpriseId)
      )?.name || 'Workspace');

  const pick = (s: Scope) => { setScope(s); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] text-gray-300 hover:text-white uppercase transition-colors px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
        <span className="max-w-[140px] truncate">{label}</span>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white text-[#0B0B0B] rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => { resetToPersonal(); setOpen(false); }}
            className={`w-full text-left px-5 py-3 text-sm font-bold hover:bg-gray-50 transition-colors ${scope.level === 'personal' ? 'text-[#FF0000]' : ''}`}
          >
            Personal
          </button>
          {switchable.length > 0 && <div className="h-[1px] bg-gray-100" />}
          {switchable.map(m => {
            const target: Scope = m.family === 'workspace'
              ? { level: 'team', workspaceId: m.containerId }
              : { level: 'enterprise', enterpriseId: m.containerId };
            const active =
              (m.family === 'workspace' && scope.workspaceId === m.containerId) ||
              (m.family === 'enterprise' && scope.enterpriseId === m.containerId);
            return (
              <button
                key={`${m.family}-${m.containerId}`}
                onClick={() => pick(target)}
                className={`w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors ${active ? 'text-[#FF0000]' : ''}`}
              >
                <p className="text-sm font-bold truncate">{m.name}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{m.family}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScopeSwitcher;
