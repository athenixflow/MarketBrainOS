
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { Card, Input, PrimaryButton, PageHeader, ErrorMessage } from '../components/UI';
import { SecurityEngine } from '../services/securityEngine';
import { useAuth } from '../context/AuthContext';

const AuthPage: React.FC = () => {
  const [view, setView] = useState<'auth' | 'verify'>('auth');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [waitTimer, setWaitTimer] = useState<number | null>(null);
  
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    let timer: number;
    if (waitTimer !== null && waitTimer > 0) {
      timer = window.setInterval(() => {
        setWaitTimer(prev => (prev && prev > 0) ? prev - 1 : null);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [waitTimer]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const velocity = await SecurityEngine.checkLoginVelocity(email);
    if (!velocity.allowed) {
      setError(velocity.error || "Throttled.");
      if (velocity.waitSeconds) setWaitTimer(velocity.waitSeconds);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        await refreshProfile();
        navigate('/');
      } else if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        await refreshProfile();
        navigate('/');
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent. Check your inbox.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(SecurityEngine.sanitizeErrorMessage(err.message || 'Authentication failed.'));
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError("Google Sign-In failed.");
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
      <PageHeader 
        title={mode === 'signup' ? "Request Identity" : mode === 'forgot' ? "Recover Access" : "Secure Access"} 
        subtitle="MarketBrainOS Strategic Interface" 
      />
      <Card accent className="shadow-2xl">
        {mode === 'forgot' ? (
           <form onSubmit={handleEmailAuth}>
             <Input label="Recovery Email" placeholder="identity@internal.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
             {error && <ErrorMessage message={error} />}
             {successMsg && (
               <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm font-bold rounded-xl border border-green-200">
                 {successMsg}
               </div>
             )}
             <PrimaryButton className="w-full mb-6" disabled={loading}>Send Reset Link</PrimaryButton>
             <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#0B0B0B]">
               Back to Sign In
             </button>
           </form>
        ) : (
          <form onSubmit={handleEmailAuth}>
            <Input label="Operational Email" placeholder="identity@internal.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            <Input label="Passphrase" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            
            {error && <ErrorMessage message={error} />}
            
            <div className="space-y-6 mt-10">
              <PrimaryButton className="w-full" disabled={loading}>{mode === 'signup' ? "Provision Account" : "Verify & Sign In"}</PrimaryButton>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or Verify With</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button 
                type="button" 
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-[#0B0B0B] py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Google Workspace Identity
              </button>

              <div className="flex flex-col gap-4 pt-4">
                <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#0B0B0B]">
                  {mode === 'signin' ? "New Operator? Request Access" : "Existing Identity? Sign In"}
                </button>
                {mode === 'signin' && (
                  <button type="button" onClick={() => { setMode('forgot'); setError(null); }} className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#0B0B0B]">
                    Lost Credentials?
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default AuthPage;
