// Harness-only stand-in for services/persistenceService (which initialises Firebase on import).
// Used by scripts/browser-harness.ts via a Vite alias so context/ScopeContext and the app header
// can mount offline. Every function the header's subtree touches returns an empty result.
export const getUserMemberships = async (_uid: string) => [];
export const getUserNotifications = async (_uid: string) => [];
export const markNotificationRead = async (_id: string) => undefined;
export const markAllNotificationsRead = async (_uid: string) => undefined;
