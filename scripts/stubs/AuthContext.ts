// Harness-only stand-in for context/AuthContext. The user object is a module constant on purpose:
// ScopeProvider's load() depends on `user`, so a fresh object per call would itself cause a loop.
// `profile` is a free-tier user so the header renders its fullest state ("Upgrade to Pro" pill).
const USER = { uid: 'harness-user', email: 'harness@example.com' };
const PROFILE = { id: 'harness-user', email: 'harness@example.com', tier: 'free', tokens: 20, role: 'user' };
export const useAuth = () => ({
  user: USER, profile: PROFILE, loading: false, isSystemLocked: false, profileError: null,
  signOut: async () => undefined, refreshProfile: async () => undefined,
});
export const AuthProvider = ({ children }: { children: any }) => children;
