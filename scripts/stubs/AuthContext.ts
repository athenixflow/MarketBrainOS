// Harness-only stand-in for context/AuthContext. The user object is a module constant on purpose:
// ScopeProvider's load() depends on `user`, so a fresh object per call would itself cause a loop.
const USER = { uid: 'harness-user', email: 'harness@example.com' };
export const useAuth = () => ({ user: USER, profile: null, loading: false });
