
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SecurityEngine } from '../services/securityEngine';
import { useAuth } from '../context/AuthContext';
import { UserTier, ActionLogEntry, PaymentRecord } from '../types';
import { getUserActionLogs, getUserPaymentHistory } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';

// Plan figures are derived from the pricing config so on-screen copy can never contradict what the
// account actually receives.
const PRO_TOKENS = DEFAULT_PRICING_CONFIG.plans.pro.monthlyTokens;
const PRO_PRICE = DEFAULT_PRICING_CONFIG.plans.pro.price;
const STARTER_PACK = DEFAULT_PRICING_CONFIG.tokenPacks[0];

// 1. PRIMARY ACTION BUTTON
export const PrimaryButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}> = ({ onClick, children, disabled, className, type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`bg-[#FF0000] text-white px-10 py-4 font-bold text-sm rounded-2xl shadow-sm hover:bg-[#D40000] hover:shadow-xl hover:shadow-[#FF0000]/10 active:scale-[0.99] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
);

// 2. SECONDARY BUTTON
export const SecondaryButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}> = ({ onClick, children, disabled, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`bg-transparent text-[#0B0B0B] border border-gray-200 px-8 py-3.5 font-bold text-xs rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 disabled:opacity-50 tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
);

// 3. CARD COMPONENT
// Padding is responsive: a flat p-12 left only 246px of interior on a 390px screen, which clipped
// numbers and table cells. `dark` is a real variant because overriding the base bg via className left
// `text-[#0B0B0B]` in place (near-black text on a near-black card) and depended on utility order.
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  accent?: boolean;
  dark?: boolean;
  onClick?: () => void;
}> = ({ children, className, title, accent, dark, onClick }) => (
  <div
    onClick={onClick}
    className={`${dark ? 'bg-[#121212] text-white border-gray-900' : 'bg-[#FFFFFF] text-[#0B0B0B] border-gray-100'} p-6 sm:p-8 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.02)] border relative overflow-hidden transition-all duration-500 ${className}`}
  >
    {accent && <div className="absolute top-8 left-0 w-1 h-8 bg-[#FF0000] rounded-r-full" />}
    {title && (
      <div className="flex items-center gap-4 mb-6">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] flex-shrink-0" />
        <h2 className={`text-sm font-bold uppercase tracking-[0.1em] ${dark ? 'text-white/90' : 'text-[#0B0B0B]/80'}`}>{title}</h2>
      </div>
    )}
    {children}
  </div>
);

// 4. SCORE / INTELLIGENCE INDICATOR
export const IntelligenceIndicator: React.FC<{ score: number }> = ({ score }) => (
  <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full border border-gray-100 bg-white shadow-sm font-bold text-xs text-[#0B0B0B] tracking-widest uppercase">
    <div className="flex h-2 w-2 relative">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0000] opacity-30"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0000]"></span>
    </div>
    Intelligence Grade: {score}
  </div>
);

// 5. TABS COMPONENT
export const Tabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ tabs, activeTab, onTabChange }) => (
  // Renders on the dark page (Settings, AngleMinerX), so the active label must be white: it was
  // text-[#0B0B0B] on the #0B0B0B background, i.e. the selected tab was invisible. gap-12 also put
  // 48px between tabs, which pushed 5+ tabs far off-screen on mobile.
  <div className="flex gap-6 border-b border-gray-900/50 mb-8 overflow-x-auto no-scrollbar">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => onTabChange(tab)}
        className={`pb-4 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${
          activeTab === tab
            ? 'text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {tab}
        {activeTab === tab && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />
        )}
      </button>
    ))}
  </div>
);

// 6. INPUT FIELDS
export const Input: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  multiline?: boolean;
  error?: string;
  disabled?: boolean;
  name?: string;
  /** Defaults to "text". MUST be set to "password" for secrets, or the value renders in clear text. */
  type?: 'text' | 'email' | 'password' | 'number';
  autoComplete?: string;
}> = ({ label, placeholder, value, onChange, multiline, error, disabled, name, type = 'text', autoComplete }) => (
  // Geometry matches components/auth/AuthField (the settled-correct form geometry in this repo).
  // The bottom margin is mb-6, not mb-12: the old 48px was un-overridable and every consumer cancelled
  // it with a -mt-10 hack, which in one case dragged the char counter on top of its own helper text.
  <div className="flex flex-col mb-6">
    <label className="text-[11px] font-bold text-gray-500 mb-2 tracking-widest uppercase">{label}</label>
    {multiline ? (
      <textarea
        name={name}
        disabled={disabled}
        className={`w-full min-w-0 bg-[#FBFBFB] border ${error ? 'border-red-300' : 'border-gray-200'} px-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-[#FF0000]/10 focus:border-[#FF0000] outline-none min-h-[150px] transition-all text-[15px] text-[#0B0B0B] placeholder:text-gray-500 leading-relaxed disabled:opacity-50`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e)}
      />
    ) : (
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`w-full min-w-0 bg-[#FBFBFB] border ${error ? 'border-red-300' : 'border-gray-200'} px-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-[#FF0000]/10 focus:border-[#FF0000] outline-none transition-all text-[15px] text-[#0B0B0B] placeholder:text-gray-500 disabled:opacity-50`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e)}
      />
    )}
    {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
  </div>
);

// 7. SECTION HEADER COMPONENT
export const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-8 mt-12">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-8 h-[2px] bg-[#FF0000] rounded-full" />
      {/* was `tracking-tight ... tracking-[0.2em]` - the second silently won */}
      <h3 className="text-xl font-bold text-[#0B0B0B] uppercase tracking-[0.2em]">{title}</h3>
    </div>
    {subtitle && <p className="text-gray-400 font-medium text-base ml-12">{subtitle}</p>}
  </div>
);

// 8. EMPTY STATE COMPONENT
export const EmptyState: React.FC<{ message: string; submessage?: string }> = ({ message, submessage }) => (
  <div className="py-16 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
    <div className="w-12 h-12 bg-[#F9F9F9] border border-gray-100 rounded-full mb-8 flex items-center justify-center">
      <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full opacity-30" />
    </div>
    <h3 className="text-xl font-bold text-gray-400 mb-3">{message}</h3>
    {submessage && <p className="text-gray-400/60 text-sm max-w-xs leading-relaxed">{submessage}</p>}
  </div>
);

// 9. LOADING / PROCESSING STATE
export const LoadingState: React.FC<{ 
  message?: string; 
  isTakingLong?: boolean;
  onCancel?: () => void;
}> = ({ message = "Analyzing...", isTakingLong, onCancel }) => (
  <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
    <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mb-6 animate-pulse" />
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.5em] mb-4">{message}</span>
    {isTakingLong && (
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in">
        This is taking longer than usual. Still working…
      </p>
    )}
    {onCancel && (
      <button 
        onClick={onCancel}
        className="mt-8 text-[9px] font-bold text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors"
      >
        Cancel and Retry
      </button>
    )}
  </div>
);

// 10. ERROR MESSAGE COMPONENT (GENERIC / CLIENT)
// Solid deep-red alert. Most call sites render this straight onto the near-black page (the org hubs,
// Workflow, admin) while a few sit inside a white Card, and the old light-grey panel was unreadable on
// dark. An opaque fill reads correctly on BOTH surfaces, so there is no `dark` prop to forget. Red-700
// rather than the brand #FF0000 so it never reads as a primary CTA. White on #B91C1C = 6.0:1 (AA).
export const ErrorMessage: React.FC<{
  message: string;
  action?: { label: string; onClick: () => void }
}> = ({ message, action }) => (
  <div
    role="alert"
    className="rounded-2xl bg-[#B91C1C] px-4 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 animate-in fade-in duration-300"
  >
    <div className="flex items-start gap-3 min-w-0">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/90 flex-shrink-0 mt-px">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p className="text-[13px] font-medium text-white leading-relaxed min-w-0">{message}</p>
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="text-[10px] font-bold text-white uppercase tracking-widest hover:opacity-70 transition-opacity border-b border-white/40 pb-0.5 flex-shrink-0"
      >
        {action.label}
      </button>
    )}
  </div>
);

// 11. ANALYSIS FAILURE STATE (SERVER / TOKENS)
export const AnalysisFailureState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div className="py-12 px-8 rounded-[32px] bg-red-50/30 border border-red-100 flex flex-col items-center text-center animate-in fade-in duration-500 my-8">
    <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
         <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
       </svg>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] mb-2 uppercase tracking-wide">Analysis Interrupted</h3>
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>
    
    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-8">
       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe: No tokens deducted</span>
    </div>

    {onRetry && (
      <button 
        onClick={onRetry}
        className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:text-[#D40000] hover:underline underline-offset-4 transition-all"
      >
        Dismiss & Adjust Inputs
      </button>
    )}
  </div>
);

// 11b. SYSTEM BLOCK STATE (MAINTENANCE / PAUSE)
export const SystemBlockState: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-12 px-8 rounded-[32px] bg-yellow-50/50 border border-yellow-100 flex flex-col items-center text-center animate-in fade-in duration-500 my-8">
    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
         <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
       </svg>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] mb-2 uppercase tracking-wide">Analysis Unavailable</h3>
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>

    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe: No tokens deducted</span>
    </div>
    
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Please check back shortly.</p>
  </div>
);

// 11c. RATE LIMIT STATE (COOLDOWN)
export const RateLimitState: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-12 px-8 rounded-[32px] bg-blue-50/50 border border-blue-100 flex flex-col items-center text-center animate-in fade-in duration-500 my-8">
    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
         <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] mb-2 uppercase tracking-wide">Cooldown Active</h3>
    <p className="text-sm font-medium text-gray-500 mb-2">You’re making requests too quickly.</p>
    <p className="text-xs text-gray-400 mb-8 max-w-md leading-relaxed">
      {message.toLowerCase().includes("wait") || message.toLowerCase().includes("limit") 
        ? message 
        : "To ensure platform stability, we limit the frequency of complex analyses."}
    </p>

    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe: No tokens deducted</span>
    </div>
    
    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
      Please check back shortly.
    </p>
  </div>
);

// 11d. NETWORK ERROR STATE (CONNECTIVITY/CORS)
export const NetworkErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="py-12 px-8 rounded-[32px] bg-gray-50 border border-gray-200 flex flex-col items-center text-center animate-in fade-in duration-500 my-8">
    <div className="w-12 h-12 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
         <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 12.75m0 0l7.5-4.5 4.885 2.932m-4.885 5.568l3-1.8m-3 1.8L9 15.75m3-3v3m0-3l-3-3m3 3l3 3" />
       </svg>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] mb-2 uppercase tracking-wide">Network Unreachable</h3>
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>
    
    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-8">
       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe: No tokens deducted</span>
    </div>

    {onRetry && (
      <button 
        onClick={onRetry}
        className="text-[10px] font-bold text-[#0B0B0B] uppercase tracking-widest hover:underline underline-offset-4 transition-all"
      >
        Retry Connection
      </button>
    )}
  </div>
);

export const isSystemBlockError = (msg: string | null): boolean => {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes('maintenance mode') || 
         lower.includes('currently paused') || 
         lower.includes('module is currently disabled');
};

export const isRateLimitError = (msg: string | null): boolean => {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes('rate limit') || 
         lower.includes('wait') || 
         lower.includes('resource-exhausted') ||
         lower.includes('too quickly');
};

export const isNetworkError = (msg: string | null): boolean => {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes('network unreachable') || 
         lower.includes('failed to fetch') || 
         lower.includes('check your connection') ||
         lower.includes('network error');
};

// 12. RESULT CONTAINER
export const ResultContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {children}
  </div>
);

// Page Title Template
export const PageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-10">
    <h1 className="text-4xl font-bold tracking-tight text-white mb-6 leading-tight">{title}</h1>
    <div className="w-12 h-[2px] bg-[#FF0000] rounded-full mb-8" />
    <p className="text-gray-500 font-medium text-xl max-w-2xl leading-relaxed">{subtitle}</p>
  </div>
);

// 13. USAGE LIMIT MODAL (BLOCKING)
export const UsageLimitModal: React.FC<{
  isOpen: boolean;
  tier: UserTier;
  reason: 'exhausted' | 'insufficient';
  onClose: () => void;
}> = ({ isOpen, tier, reason, onClose }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const isFree = tier === 'free';

  const handlePrimaryAction = () => {
    // Free users upgrade on the pricing page; paid users buy token packs in the store.
    navigate(isFree ? '/pricing' : '/store');
    onClose();
  };

  let content = {
    title: "",
    body: "",
    primaryCTA: "",
    secondaryCTA: "",
    hint: ""
  };

  if (isFree) {
    if (reason === 'exhausted') {
      content = {
        title: "You’ve used your free tokens",
        body: `You’ve reached the limit of your free tokens.\nUpgrade to Pro to get ${PRO_TOKENS} tokens every month and keep running analyses.`,
        primaryCTA: `Upgrade to Pro, $${PRO_PRICE}/month`,
        secondaryCTA: "Not now",
        hint: "Tokens are only used when analyses complete successfully."
      };
    } else {
      content = {
        title: "This analysis needs more tokens",
        body: "This tool requires more tokens than are available on the Free plan.\nUpgrade to Pro to unlock full access and monthly tokens.",
        primaryCTA: "Upgrade to Pro",
        secondaryCTA: "Go back",
        hint: ""
      };
    }
  } else {
    // Pro User
    if (reason === 'exhausted') {
      content = {
        title: "You’ve used all your tokens",
        body: "You’ve used your monthly tokens.\nTop up to keep running analyses instantly.",
        primaryCTA: "Top up tokens",
        secondaryCTA: "Wait for monthly reset",
        hint: `$${STARTER_PACK.price} = ${STARTER_PACK.tokens} tokens`
      };
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="bg-white text-[#0B0B0B] max-w-md w-full p-12 rounded-[40px] shadow-2xl relative">
        <div className="w-2 h-2 rounded-full bg-[#FF0000] mb-8" />
        <h3 className="text-2xl font-bold mb-4 tracking-tight">{content.title}</h3>
        <p className="text-gray-500 font-medium mb-10 leading-relaxed whitespace-pre-line">
          {content.body}
        </p>
        
        {content.hint && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">{content.hint}</p>
        )}

        <div className="flex flex-col gap-4">
          <PrimaryButton onClick={handlePrimaryAction} className="w-full">
            {content.primaryCTA}
          </PrimaryButton>
          <button 
            onClick={onClose}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest py-3 transition-colors"
          >
            {content.secondaryCTA}
          </button>
        </div>
      </div>
    </div>
  );
};

// 14. TOKEN STATUS BANNER (PASSIVE)
export const TokenStatusBanner: React.FC<{
  tier: UserTier;
  tokens: number;
}> = ({ tier, tokens }) => {
  const navigate = useNavigate();

  if (tier === 'free') {
    return (
      <div className="w-full bg-[#1A1A1A] border-b border-gray-800 py-3 px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          You’re on the Free plan. Upgrade to Pro to get {PRO_TOKENS} tokens every month.
        </p>
        <button
          onClick={() => navigate('/')}
          className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:text-white transition-colors"
        >
          Upgrade to Pro →
        </button>
      </div>
    );
  }

  // Pro Logic: Show only if low
  if (tier === 'pro' && tokens <= 50 && tokens > 0) {
    return (
      <div className="w-full bg-[#FF0000]/5 border-b border-[#FF0000]/10 py-3 px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
          <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest">
            You’re running low on tokens. Top up 100 tokens for $5 to avoid interruptions.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="text-[10px] font-bold text-[#0B0B0B] uppercase tracking-widest hover:opacity-60 transition-opacity underline decoration-gray-300 underline-offset-4"
        >
          Top up tokens
        </button>
      </div>
    );
  }

  return null;
};

// 15. UPGRADE CARD (DASHBOARD)
export const UpgradeCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Card className="!bg-[#FF0000] !text-white !border-none shadow-2xl shadow-[#FF0000]/20 hover:scale-[1.01] transition-transform cursor-pointer" onClick={onClick}>
    <div className="flex flex-col h-full justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] mb-8 opacity-60">Elite Intelligence</p>
        <h3 className="text-3xl font-bold tracking-tight mb-8 leading-tight">Upgrade to Pro to keep working without interruption.</h3>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-widest border-b border-white/40 pb-1">See pricing models</span>
        <div className="w-2 h-2 rounded-full bg-white animate-ping" />
      </div>
    </div>
  </Card>
);

// 15b. LOCKED FEATURE CARD (upgrade prompt shown in place of a hidden feature)
export const LockedFeatureCard: React.FC<{
  title: string;          // e.g. "Team Workspace"
  planLabel: string;      // e.g. "Team"
  description: string;    // what unlocks
  onUpgrade?: () => void;
}> = ({ title, planLabel, description, onUpgrade }) => {
  const navigate = useNavigate();
  const go = onUpgrade || (() => navigate('/pricing'));
  return (
    <div
      onClick={go}
      className="bg-[#121212] text-white p-10 rounded-[32px] border border-gray-800 relative overflow-hidden cursor-pointer hover:border-[#FF0000]/40 transition-all duration-500 group"
    >
      <div className="flex items-center gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.4em]">Locked</p>
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
      <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8">{description}</p>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF0000] border-b border-[#FF0000]/30 pb-1 group-hover:text-white transition-colors">
          Upgrade to {planLabel} →
        </span>
      </div>
    </div>
  );
};

// 16. EXPORT CONTROLS
export const ExportControls: React.FC<{
  onCopy: () => void;
  onExportText?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  isPro: boolean;
}> = ({ onCopy, onExportText, onExportCSV, onExportPDF, isPro }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // `w-fit` + no wrap gave this a ~450px intrinsic width; it renders inside a Card that has ~246px
    // of interior on a 390px screen, and Card's overflow-hidden made the last buttons unreachable.
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
      <button 
        onClick={handleCopy}
        className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors flex items-center gap-2"
      >
        {copied ? "Text Copied" : "Copy to Clipboard"}
      </button>
      
      {isPro && (
        <>
          <div className="w-[1px] h-3 bg-gray-200" />
          <button
            onClick={onExportText}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
          >
            Export TXT
          </button>
          {onExportCSV && (
            <>
              <div className="w-[1px] h-3 bg-gray-200" />
              <button
                onClick={onExportCSV}
                className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
              >
                Export CSV
              </button>
            </>
          )}
          <div className="w-[1px] h-3 bg-gray-200" />
          <button
            onClick={onExportPDF}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
          >
            Export PDF-Ready
          </button>
        </>
      )}
    </div>
  );
};

// 17. HONEYPOT COMPONENT
export const Honeypot: React.FC = () => {
  const { profile } = useAuth();
  const triggerHoneypot = (e: React.MouseEvent) => {
    e.preventDefault();
    SecurityEngine.handleHoneypotTrigger(profile);
  };

  return (
    <a 
      href="/admin/debug/logs/raw" 
      onClick={triggerHoneypot}
      style={{ display: 'none' }}
      aria-hidden="true"
      tabIndex={-1}
      className="mbos-honeypot"
    >
      Internal Logs
    </a>
  );
};

// 18. HONEYPOT FIELD
export const HoneypotField: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => (
  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
    <input
      type="text"
      name="security_validation_checksum"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// 19. TOKEN HISTORY MODAL
export const TokenHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserActionLogs(user.uid)
        .then(setLogs)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="bg-white text-[#0B0B0B] max-w-2xl w-full p-10 rounded-[40px] shadow-2xl relative max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mb-2" />
            <h3 className="text-2xl font-bold tracking-tight">Token Usage History</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-[#0B0B0B] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-grow pr-2">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-2 h-2 rounded-full bg-[#FF0000] animate-pulse mx-auto mb-4" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Records...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium">
              No token usage recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map(log => {
                const date = log.created_at ? new Date(log.created_at.toMillis()) : new Date(log.timestamp || 0);
                const isTopUp = log.action === 'token_topup';
                const isFailure = log.status === 'failed_refunded';
                
                return (
                  <div key={log.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between group hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {date.toLocaleDateString()} • {date.toLocaleTimeString()}
                      </p>
                      <p className="text-sm font-bold text-[#0B0B0B]">
                        {isTopUp ? 'Usage Credit Purchase' : log.module || 'System Action'}
                      </p>
                      <p className="text-xs text-gray-500 font-medium truncate max-w-[200px]">
                        {isTopUp ? 'Account Top-Up' : log.action || 'Analysis Execution'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      {isFailure ? (
                        <div>
                          <span className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                            Refunded
                          </span>
                          <p className="text-xs font-bold text-gray-400 line-through">
                            {log.tokens_used} Tokens
                          </p>
                        </div>
                      ) : isTopUp ? (
                        <div>
                          <p className="text-sm font-black text-green-600">
                            +{log.tokens_added || 100} Tokens
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            ${log.amount_paid || 5}.00
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-black text-[#0B0B0B]">
                          -{log.tokens_used} Tokens
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="pt-8 mt-4 border-t border-gray-100 text-center shrink-0">
          <p className="text-[10px] text-gray-400">All records are immutable and server-verified.</p>
        </div>
      </div>
    </div>
  );
};

// 20. PAYMENT HISTORY MODAL
export const PaymentHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserPaymentHistory(user.uid)
        .then(setPayments)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="bg-white text-[#0B0B0B] max-w-2xl w-full p-10 rounded-[40px] shadow-2xl relative max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mb-2" />
            <h3 className="text-2xl font-bold tracking-tight">Top-Up Receipts</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-[#0B0B0B] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-grow pr-2">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-2 h-2 rounded-full bg-[#FF0000] animate-pulse mx-auto mb-4" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Receipts...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium">
              You haven’t topped up any tokens yet.
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map(payment => {
                const date = payment.created_at ? new Date(payment.created_at.toMillis()) : new Date(0);
                const isFailed = payment.status === 'failed';
                
                return (
                  <div key={payment.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between group hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {date.toLocaleDateString()} • {date.toLocaleTimeString()}
                      </p>
                      <p className="text-sm font-bold text-[#0B0B0B]">
                        Token Top-Up
                      </p>
                      <p className="text-xs text-gray-500 font-medium truncate max-w-[200px] font-mono">
                        Ref: {payment.payment_reference || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      {isFailed ? (
                        <div>
                          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                            Failed
                          </span>
                          <p className="text-xs font-bold text-gray-400 line-through">
                            ${payment.amount_paid}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-black text-green-600">
                            +{payment.tokens_credited} Tokens
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            ${payment.amount_paid}.00 USD
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="pt-8 mt-4 border-t border-gray-100 text-center shrink-0">
          {payments.length > 0 && (
            <button
              onClick={() => downloadAsCSV('MarketBrainOS_Billing_History', paymentsToCSV(payments))}
              className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors mb-4"
            >
              Export CSV
            </button>
          )}
          <p className="text-[10px] text-gray-400 mb-1">Top-ups add extra tokens and do not affect your monthly token reset.</p>
          <p className="text-[9px] text-gray-300">Transaction records are immutable.</p>
        </div>
      </div>
    </div>
  );
};
