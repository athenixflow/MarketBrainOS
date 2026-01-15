
import React, { useState, useEffect } from 'react';
import { 
  PageHeader, 
  Card, 
  Input, 
  PrimaryButton, 
  EmptyState, 
  LoadingState, 
  ResultContainer, 
  ErrorMessage,
  TokenNotice,
  TokenWarning,
  ExportControls,
  HoneypotField
} from '../components/UI';
import { auditConversion, MAX_INPUT_CHARS } from '../services/geminiService';
import { AuditResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatConversionDoctorExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';

const ConversionDoctor: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [input, setInput] = useState('');
  const [context, setContext] = useState('Landing Page');
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  const contexts = ['Landing Page', 'Homepage', 'Sales Page', 'Funnel Step'];

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => setIsTakingLong(true), 10000);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const detectMode = (str: string): 'url' | 'text' | 'empty' => {
    const trimmed = str.trim();
    if (!trimmed) return 'empty';
    return (!trimmed.includes(' ') && trimmed.includes('.')) ? 'url' : 'text';
  };

  const validateInputFormat = (str: string): { isValid: boolean; error?: string } => {
    const trimmed = str.trim();
    if (!trimmed) return { isValid: false };
    
    const currentMode = detectMode(trimmed);
    
    if (currentMode === 'url') {
      const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
      
      if (!urlPattern.test(trimmed)) {
        if (!trimmed.toLowerCase().startsWith('http')) {
          return { 
            isValid: false, 
            error: "Protocol missing. Use https://..." 
          };
        }
        return { 
          isValid: false, 
          error: "Invalid URL structure (e.g. domain.com)" 
        };
      }
      
      try {
        const url = new URL(trimmed);
        const hasValidProtocol = url.protocol === 'http:' || url.protocol === 'https:';
        if (!hasValidProtocol) throw new Error();
        return { isValid: true };
      } catch {
        return { 
          isValid: false, 
          error: "Malformed URL format detected." 
        };
      }
    }
    
    return { isValid: trimmed.length > 0 };
  };

  const mode = detectMode(input);
  const validation = validateInputFormat(input);
  const showInlineError = input.trim().length > 0 && !validation.isValid;

  const handleAudit = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput || !validation.isValid) return;

    if (trimmedInput.length > MAX_INPUT_CHARS) {
      setError(`Page content exceeds safety limits (${trimmedInput.length}/${MAX_INPUT_CHARS}). Please consolidate.`);
      return;
    }

    if (profile && (profile.tokens <= 0 || profile.is_suspended)) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await auditConversion(trimmedInput, context, user?.uid);
      setResult({ ...data, auditedUrl: trimmedInput.startsWith('http') ? trimmedInput : undefined });
      
      if (user) await refreshProfile();
      
    } catch (err: any) {
      console.error("Audit failed:", err);
      if (err.message && (err.message.includes("Extraction Failed") || err.message.includes("404") || err.message.includes("unreachable"))) {
        setError(`Diagnostic Link Failure: The clinical engine could not access the provided URL. We suggest pasting raw copy for evaluation.`);
      } else {
        setError(err.message || "Clinical engine interruption.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
    setHoneypotValue('');
  };

  const handleCopy = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      downloadAsText("ConversionDoctor_Report", text);
    }
  };

  const handleExportPDF = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      printAsPDF("Conversion Doctor Elite Diagnostic Report", text);
    }
  };

  const isLowTokens = profile ? (profile.tier === 'free' ? profile.tokens <= 4 : profile.tokens <= 40) : false;
  const isExhausted = profile ? profile.tokens <= 0 : false;
  const isSuspended = profile?.is_suspended;
  const isPro = profile?.tier === 'pro';

  return (
    <div className="space-y-24">
      <PageHeader 
        title="Conversion Doctor: Landing Page Audit" 
        subtitle="Identify conversion blockers, friction points, and messaging gaps. Clinical diagnostic tools for high-performance landing pages." 
      />

      <div className="max-w-4xl mx-auto w-full">
        <Card className="shadow-2xl">
          {isSuspended && <div className="mb-12"><ErrorMessage message="SECURITY PROTOCOL ACTIVE: Account suspended due to risk threshold violations." /></div>}
          {error && <div className="mb-12"><ErrorMessage message={error} action={{ label: "Start Over", onClick: handleReset }} /></div>}
          
          {isLowTokens && !isExhausted && !isSuspended && <TokenWarning />}

          {isExhausted && !isSuspended ? (
            <TokenNotice 
              tier={profile?.tier || 'free'} 
              onUpgrade={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}
              onContinue={() => setError(null)}
            />
          ) : !isSuspended && (
            <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }}>
              <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
              <div className="relative">
                <div className="flex justify-between items-center mb-[-40px] relative z-10 px-1 pointer-events-none">
                  <div />
                  {mode !== 'empty' && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className={`w-1 h-1 rounded-full ${mode === 'url' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        Mode: {mode === 'url' ? 'Clinical URL Audit' : 'Raw Copy Diagnostic'}
                      </span>
                    </div>
                  )}
                </div>
                <Input 
                  label="Page Source" 
                  placeholder="Paste your page copy or enter a live URL (https://...)" 
                  value={input} 
                  onChange={(e) => { setInput(e.target.value); setError(null); }} 
                  multiline 
                  error={showInlineError ? validation.error : undefined}
                />
              </div>

              <div className="flex justify-between items-start mt-[-40px] mb-8">
                <div className="flex items-center gap-2">
                  {showInlineError && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                       <p className="text-[9px] font-bold text-[#FF0000] uppercase tracking-widest">
                         Invalid Format: {validation.error}
                       </p>
                    </div>
                  )}
                </div>
                <p className={`text-right text-[9px] font-bold uppercase tracking-widest ${input.length > MAX_INPUT_CHARS ? 'text-[#FF0000]' : 'text-gray-300'}`}>
                  {input.length} / {MAX_INPUT_CHARS} characters
                </p>
              </div>
              
              <div className="mb-12">
                <label className="text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40 block">Page Context</label>
                <div className="flex flex-wrap gap-3">
                  {contexts.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setContext(c)}
                      className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        context === c ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <PrimaryButton 
                  type="submit"
                  disabled={loading || !input.trim() || input.length > MAX_INPUT_CHARS || !validation.isValid} 
                  className="w-full"
                >
                  {loading ? 'Analyzing conversion structure...' : 'Run Conversion Audit'}
                </PrimaryButton>
                {result && !loading && (
                  <button 
                    type="button"
                    onClick={handleReset}
                    className="text-[10px] font-bold text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors text-center"
                  >
                    Run another audit
                  </button>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>

      {loading && <LoadingState message="Extracting psychological signals..." isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

      {!result && !loading && !error && (
        <EmptyState 
          message="No audit yet." 
          submessage="Paste a page or enter a URL to begin the diagnostic evaluation." 
        />
      )}

      {result && !loading && (
        <ResultContainer>
          <div className="flex justify-end mb-12">
            <ExportControls 
              onCopy={handleCopy} 
              onExportText={handleExportTxt} 
              onExportPDF={handleExportPDF} 
              isPro={isPro} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <Card className="lg:col-span-1 flex flex-col justify-center items-center py-20 bg-gray-50/30" accent>
               <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.4em] mb-10">Conversion Grade</p>
               <div className="text-8xl font-black tracking-tighter mb-4 text-[#0B0B0B]">{result.score}</div>
               <p className="font-bold text-gray-400 text-[10px] tracking-[0.2em] uppercase">Intelligence Confidence: High</p>
            </Card>

            <Card className="lg:col-span-2">
              <div className="space-y-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] opacity-80 uppercase tracking-[0.1em]">Executive Diagnostic</h2>
                </div>
                {result.auditedUrl && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg w-fit">
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-gray-400 truncate max-w-xs">{result.auditedUrl}</span>
                  </div>
                )}
                <p className="text-2xl font-bold text-[#0B0B0B] leading-snug">
                  {result.summary}
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-gray-50">
                   <div className="w-2 h-2 rounded-full bg-[#FF0000]" />
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Consultant View Enabled</p>
                </div>
              </div>
            </Card>
          </div>
        </ResultContainer>
      )}
    </div>
  );
};

export default ConversionDoctor;
