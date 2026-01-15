
// Deprecated: Migrated to Firebase.
// This mock object ensures any legacy imports do not crash the build.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) })
};
