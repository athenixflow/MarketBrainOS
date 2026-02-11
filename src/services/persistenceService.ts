import { supabase } from './supabase'
import { auth } from './firebase'

// Helper to get or create user in Supabase
const ensureUserExists = async (firebaseUser: any) => {
  if (!firebaseUser) return null

  try {
    // Check if user exists in Supabase
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', firebaseUser.uid)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
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

      if (createError) throw createError

      // Create default profile
      await supabase
        .from('user_profiles')
        .insert({
          id: newUser.id,
          tokens: 4, // Free tier default
          tier: 'free',
          role: 'user'
        })
    }

    return firebaseUser.uid
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    throw error
  }
}

export const saveAngleMinerResult = async (userId: string, product: string, industry: string, target: string, result: any) => {
  const { data, error } = await supabase
    .from('angle_miner_results')
    .insert({
      user_id: userId,
      product,
      industry,
      target,
      goal: result.goal || 'All',
      tones: result.tones || [],
      prime_angles: result.prime,
      supporting_angles: result.supporting,
      exploratory_angles: result.exploratory,
      hooks: result.hooks
    })
  
  if (error) throw error
  return data
}

export const saveTestLabResult = async (userId: string, type: string, variants: any[], result: any) => {
  const { data, error } = await supabase
    .from('test_lab_results')
    .insert({
      user_id: userId,
      type,
      variants,
      winner_label: result.winnerLabel,
      explanation: result.explanation
    })
  
  if (error) throw error
  return data
}

export const saveConversionDoctorResult = async (userId: string, input: string, score: number, result: any) => {
  const { data, error } = await supabase
    .from('conversion_doctor_results')
    .insert({
      user_id: userId,
      input,
      score,
      summary: result.summary,
      issues: result.issues,
      fixes: result.fixes,
      rewrites: result.rewrites,
      audited_url: result.auditedUrl
    })
  
  if (error) throw error
  return data
}

export const refreshProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) throw error
  return data
}

export const updateUserTokens = async (userId: string, newTokens: number) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ tokens: newTokens })
    .eq('id', userId)
  
  if (error) throw error
  return data
}

export const logSecurityViolation = async (event: any) => {
  const { data, error } = await supabase
    .from('security_events')
    .insert(event)
  
  if (error) throw error
  return data
}

export const logAdminAction = async (admin: any, actionType: string, target: string) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      admin_email: admin.email,
      admin_role: admin.role,
      action_type: actionType,
      target
    })
  
  if (error) throw error
  return data
}

export const logAction = async (logEntry: any) => {
  const { data, error } = await supabase
    .from('action_logs')
    .insert(logEntry)
  
  if (error) throw error
  return data
}

export const getSystemSettings = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data || { emergency_lockdown: false, last_updated: new Date().toISOString(), updated_by: 'system' }
}

export const updateUserRiskProfile = async (userId: string, riskIncrement: number, suspend: boolean = false, reason: string = '') => {
  const { data, error } = await supabase.rpc('update_user_risk_profile', {
    p_user_id: userId,
    p_risk_increment: riskIncrement,
    p_suspend: suspend,
    p_reason: reason
  })
  
  if (error) throw error
  return data
}

export const callConfirmTopUp = async (paymentReference: string) => {
  // This would integrate with your payment provider
  // For now, simulate successful top-up
  const { data, error } = await supabase
    .from('payment_records')
    .insert({
      payment_reference: paymentReference,
      amount_paid: 5.00,
      tokens_credited: 100,
      status: 'completed'
    })
  
  if (error) throw error
  
  // Update user tokens (this would need the actual user ID)
  // For now, return success
  return { success: true, tokensAdded: 100 }
}