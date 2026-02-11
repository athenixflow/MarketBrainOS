import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with your credentials
export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
)

// Auth wrapper for Firebase integration
export const getSupabaseUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Real-time subscription helper
export const subscribeToTable = (table: string, callback: (payload: any) => void) => {
  return supabase
    .channel('public:' + table)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe()
}

// Helper to sync Firebase Auth with Supabase
export const syncFirebaseUser = async (firebaseUser: any) => {
  if (!firebaseUser) return null

  try {
    // Check if user exists in Supabase
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', firebaseUser.uid)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking user:', checkError)
      return null
    }

    // Create user if doesn't exist
    if (!existingUser) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating user:', createError)
        return null
      }

      // Create default profile
      await supabase
        .from('user_profiles')
        .insert({
          id: newUser.id,
          tokens: 4, // Free tier default
          tier: 'free',
          role: 'user'
        })
      
      console.log('Created new user in Supabase:', newUser.id)
    }

    return firebaseUser.uid
  } catch (error) {
    console.error('Error syncing Firebase user:', error)
    return null
  }
}
