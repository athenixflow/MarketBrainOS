// MarketBrain OS — Scope/Context System (Phase 6.0 / Master Wiring)
//
// Tracks the organizational context the user is currently acting within. This is what makes
// the platform behave as ONE product with progressive unlocks: the active scope drives which
// container ids stamp onto new analyses, what the history/reports/dashboards show, and which
// nav appears. 'personal' is the V1 default and is always available.

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Scope, UserMembership } from '../types';
import { Membership } from '../services/permissionService';
import { getUserMemberships } from '../services/persistenceService';
import { useAuth } from './AuthContext';

interface ScopeContextType {
  scope: Scope;                          // active organizational context
  memberships: UserMembership[];         // every container the user belongs to
  activeMembership: Membership | null;   // role+family for the active scope (for can())
  loadingMemberships: boolean;
  setScope: (scope: Scope) => void;
  resetToPersonal: () => void;
  refreshMemberships: () => Promise<void>;
}

const PERSONAL: Scope = { level: 'personal' };

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

export const ScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [scope, setScopeState] = useState<Scope>(PERSONAL);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setMemberships([]); return; }
    setLoadingMemberships(true);
    try {
      setMemberships(await getUserMemberships(user.uid));
    } finally {
      setLoadingMemberships(false);
    }
  }, [user]);

  useEffect(() => {
    // On sign-out (or user switch) always fall back to personal scope.
    setScopeState(PERSONAL);
    load();
  }, [user, load]);

  // Stable identities. These were recreated on every render, and ClientWorkspace has an effect
  // that depends on `setScope` and calls it with a new object: set state -> provider re-renders ->
  // new setScope -> effect runs again, forever. Opening a client in Agency Hub froze the page.
  const setScope = useCallback((s: Scope) => setScopeState(s), []);
  const resetToPersonal = useCallback(() => setScopeState(PERSONAL), []);

  // Resolve the membership that applies to the active scope, for the permission engine.
  // (Client scopes resolve against the parent agency membership.)
  const activeMembership: Membership | null = useMemo(() => {
    if (scope.level === 'personal') return null;
    if (scope.level === 'team' && scope.workspaceId) {
      const m = memberships.find(x => x.family === 'workspace' && x.containerId === scope.workspaceId);
      return m ? { family: 'workspace', role: m.role as any } : null;
    }
    if (scope.level === 'client' && scope.agencyId) {
      const m = memberships.find(x => x.family === 'agency' && x.containerId === scope.agencyId);
      return m ? { family: 'agency', role: m.role as any } : null;
    }
    if (scope.level === 'enterprise' && scope.enterpriseId) {
      const m = memberships.find(x => x.family === 'enterprise' && x.containerId === scope.enterpriseId);
      return m ? { family: 'enterprise', role: m.role as any } : null;
    }
    return null;
  }, [scope, memberships]);

  const value = useMemo<ScopeContextType>(() => ({
    scope, memberships, activeMembership, loadingMemberships,
    setScope, resetToPersonal, refreshMemberships: load,
  }), [scope, memberships, activeMembership, loadingMemberships, setScope, resetToPersonal, load]);

  return (
    <ScopeContext.Provider value={value}>
      {children}
    </ScopeContext.Provider>
  );
};

export const useScope = () => {
  const ctx = useContext(ScopeContext);
  if (ctx === undefined) throw new Error('useScope must be used within a ScopeProvider');
  return ctx;
};
