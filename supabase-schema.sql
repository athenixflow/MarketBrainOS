-- MarketBrainOS Database Schema
-- Run this in Supabase SQL Editor

-- 1. Users table (replace Firebase Auth integration)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE,
  risk_score INTEGER DEFAULT 0,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  bot_confidence_score INTEGER DEFAULT 0
);

-- 2. User profiles (replace Firestore user documents)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tokens INTEGER DEFAULT 4,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'ops_admin', 'super_admin')),
  permissions TEXT[], -- Array of permission scopes
  session_started TIMESTAMP WITH TIME ZONE,
  is_verified_admin BOOLEAN DEFAULT FALSE,
  last_verification TIMESTAMP WITH TIME ZONE
);

-- 3. Analysis results tables
CREATE TABLE IF NOT EXISTS angle_miner_results (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  industry TEXT NOT NULL,
  target TEXT NOT NULL,
  goal TEXT DEFAULT 'All',
  tones TEXT[],
  prime_angles JSONB,
  supporting_angles JSONB,
  exploratory_angles JSONB,
  hooks JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_lab_results (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  variants JSONB NOT NULL,
  winner_label TEXT,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversion_doctor_results (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  score INTEGER NOT NULL,
  summary TEXT,
  issues JSONB,
  fixes JSONB,
  rewrites JSONB,
  audited_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Audit and security tables
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details TEXT,
  risk_increment INTEGER DEFAULT 0,
  identity_fingerprint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT,
  metadata JSONB,
  status TEXT CHECK (status IN ('success', 'failed_refunded', 'blocked')),
  tokens_used INTEGER,
  error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Payment records
CREATE TABLE IF NOT EXISTS payment_records (
  id SERIAL PRIMARY KEY,
  uid UUID REFERENCES users(id) ON DELETE CASCADE,
  payment_reference TEXT UNIQUE NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  tokens_credited INTEGER NOT NULL,
  provider TEXT DEFAULT 'stripe',
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Job queue for AI processing
CREATE TABLE IF NOT EXISTS job_queue (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  input JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 7. System settings
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  emergency_lockdown BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default system settings
INSERT INTO system_settings (emergency_lockdown, updated_by) 
VALUES (FALSE, 'system') 
ON CONFLICT DO NOTHING;

-- 8. Database Functions
-- Function to update user risk profile
CREATE OR REPLACE FUNCTION update_user_risk_profile(
  p_user_id UUID,
  p_risk_increment INTEGER,
  p_suspend BOOLEAN,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update risk score
  UPDATE users 
  SET risk_score = risk_score + p_risk_increment,
      is_suspended = CASE WHEN p_suspend THEN TRUE ELSE is_suspended END,
      suspension_reason = CASE WHEN p_suspend THEN p_reason ELSE suspension_reason END,
      last_active = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Function to get user with profile
CREATE OR REPLACE FUNCTION get_user_with_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  tokens INTEGER,
  tier TEXT,
  role TEXT,
  risk_score INTEGER,
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  permissions TEXT[],
  session_started TIMESTAMP WITH TIME ZONE,
  is_verified_admin BOOLEAN,
  last_verification TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.email,
    p.tokens,
    p.tier,
    p.role,
    u.risk_score,
    u.is_suspended,
    u.suspension_reason,
    p.permissions,
    p.session_started,
    p.is_verified_admin,
    p.last_verification
  FROM users u
  LEFT JOIN user_profiles p ON u.id = p.id
  WHERE u.id = p_user_id;
$$;

-- 9. Enable Row Level Security (RLS) for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE angle_miner_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_doctor_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 10. Create policies for user data access
CREATE POLICY "Users can view own data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "Users can view own profile" ON user_profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Users can view own angle results" ON angle_miner_results FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view own test results" ON test_lab_results FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view own conversion results" ON conversion_doctor_results FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view own action logs" ON action_logs FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view own job queue" ON job_queue FOR ALL USING (user_id = auth.uid());

-- Admin policies for audit and security data
CREATE POLICY "Admins can view all audit logs" ON audit_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can view all security events" ON security_events FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can view all payment records" ON payment_records FOR ALL TO authenticated USING (true);

-- System settings policy
CREATE POLICY "System settings readable by all" ON system_settings FOR SELECT USING (true);
CREATE POLICY "System settings writable by admins" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_risk_score ON users(risk_score);
CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON users(is_suspended);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tokens ON user_profiles(tokens);
CREATE INDEX IF NOT EXISTS idx_angle_results_user_id ON angle_miner_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_lab_results(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_results_user_id ON conversion_doctor_results(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_module ON action_logs(module);
CREATE INDEX IF NOT EXISTS idx_job_queue_user_id ON job_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- 12. Create views for common queries
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.last_active,
  u.risk_score,
  u.is_suspended,
  u.suspension_reason,
  p.tokens,
  p.tier,
  p.role,
  p.permissions,
  p.session_started,
  p.is_verified_admin,
  p.last_verification,
  -- Count of analysis results
  (SELECT COUNT(*) FROM angle_miner_results ar WHERE ar.user_id = u.id) as angle_results_count,
  (SELECT COUNT(*) FROM test_lab_results tr WHERE tr.user_id = u.id) as test_results_count,
  (SELECT COUNT(*) FROM conversion_doctor_results cr WHERE cr.user_id = u.id) as conversion_results_count,
  -- Last analysis dates
  (SELECT MAX(created_at) FROM angle_miner_results ar WHERE ar.user_id = u.id) as last_angle_analysis,
  (SELECT MAX(created_at) FROM test_lab_results tr WHERE tr.user_id = u.id) as last_test_analysis,
  (SELECT MAX(created_at) FROM conversion_doctor_results cr WHERE cr.user_id = u.id) as last_conversion_analysis
FROM users u
LEFT JOIN user_profiles p ON u.id = p.id;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;