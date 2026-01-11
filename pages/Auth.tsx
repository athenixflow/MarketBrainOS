
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Card, Input, PrimaryButton, PageHeader, ErrorMessage, LoadingState } from '../components/UI';
import { SecurityEngine } from '../services/securityEngine';
import { useAuth } from '../context/AuthContext';

const AuthPage: React.FC = () => {
  const [view, setView] = useState<'auth' | 'verify'>('auth');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitTimer, setWaitTimer] = useState<number | null>(null);
  const [otpTimer, setOtpTimer] = useState<number>(0);
  
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    let timer: number;
    if (waitTimer !== null && waitTimer > 0) {
      timer = window.setInterval(() => {
        setWaitTimer(prev => (prev && prev > 0) ? prev - 1 : null);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [waitTimer]);

  useEffect(() => {
    let timer: number;
    if (otpTimer > 0) {
      timer = window.setInterval(() => {
        setOtpTimer(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpTimer]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError("Strategic infrastructure offline.");
      return;
    }
    setError(null);

    const velocity = await SecurityEngine.checkLoginVelocity(email);
    if (!velocity.allowed) {
      setError(velocity.error || "Throttled.");
      if (velocity.waitSeconds) setWaitTimer(velocity.waitSeconds);
      return;
    }

    setLoading(true);
    try {
      const clientSideHash = await SecurityEngine.adaptiveHash(password, email);

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password: clientSideHash,
        });
        if (signUpError) throw signUpError;
        alert('Provisioning initiated. Verify via secure link.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email, 
          password: clientSideHash 
        });
        
        if (signInError) {
          await SecurityEngine.recordLoginFailure(email);
          throw signInError;
        }

        await refreshProfile();
        
        // Post-login initialization
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Update administrative session metadata
          const now = new Date().toISOString();
          await supabase.from('users').update({ 
            session_started: now,
            last_verification: null, // Reset step-up on new login
            is_verified_admin: false
          }).eq('id', user.id);
        }

        navigate('/');
      }
    } catch (err: any) {
      setError(SecurityEngine.sanitizeErrorMessage(err.message || 'Auth failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await SecurityEngine.verifyStepUpOTP(otpCode, null);
      if (res.valid) {
        navigate('/');
      } else {
        throw new Error(res.error || "Invalid code.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (view === 'verify') {
    return (
      <div className="max-w-xl mx-auto py-24 animate-in fade-in duration-1000">
        <PageHeader title="Verification Required" subtitle="Identity must be confirmed via secondary channel." />
        <Card accent className="shadow-2xl">
          <form onSubmit={handleVerifyOTP}>
            <Input label="Security Code" placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} disabled={loading} />
            {error && <ErrorMessage message={error} />}
            <PrimaryButton className="w-full mt-6" disabled={loading}>Confirm Identity</PrimaryButton>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-24 animate-in fade-in duration-1000">
      <PageHeader title={isSignUp ? "Request Identity" : "Secure Access"} subtitle="MarketBrainOS Strategic Interface" />
      <Card accent className="shadow-2xl">
        <form onSubmit={handleAuth}>
          <Input label="Operational Email" placeholder="identity@internal" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          <Input label="Passphrase" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
          {error && <ErrorMessage message={error} />}
          <div className="space-y-6 mt-10">
            <PrimaryButton className="w-full" disabled={loading}>{isSignUp ? "Request Provisioning" : "Verify & Sign In"}</PrimaryButton>
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isSignUp ? "Existing Identity? Sign In" : "New Operator? Request Access"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AuthPage;
