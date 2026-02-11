// Test file to verify Supabase integration
import { supabase } from './services/supabase'

// Test connection
export const testSupabaseConnection = async () => {
  try {
    // Test basic connection
    const { data, error } = await supabase.from('users').select('count()').limit(1)
    
    if (error) {
      console.error('Supabase connection failed:', error)
      return false
    }
    
    console.log('Supabase connection successful!')
    console.log('User count:', data)
    return true
  } catch (error) {
    console.error('Supabase test failed:', error)
    return false
  }
}

// Test user creation
export const testUserCreation = async (userId: string, email: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('User creation failed:', error)
      return null
    }
    
    console.log('User created successfully:', data)
    return data
  } catch (error) {
    console.error('User creation test failed:', error)
    return null
  }
}

// Test profile creation
export const testProfileCreation = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        tokens: 4,
        tier: 'free',
        role: 'user'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Profile creation failed:', error)
      return null
    }
    
    console.log('Profile created successfully:', data)
    return data
  } catch (error) {
    console.error('Profile creation test failed:', error)
    return null
  }
}

// Run tests
if (typeof window !== 'undefined') {
  // Only run in browser environment
  testSupabaseConnection().then(success => {
    if (success) {
      console.log('✅ Supabase integration is working!')
    } else {
      console.log('❌ Supabase integration has issues')
    }
  })
}