
// Deprecated: Migrated to Firebase.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) })
};
