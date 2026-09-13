// Harness-only stand-in for services/persistenceService (which initialises Firebase on import).
// Used by scripts/browser-harness.ts via a Vite alias so context/ScopeContext can mount offline.
export const getUserMemberships = async (_uid: string) => [];
