
import React, { useState } from 'react';
import { SecurityEngine } from '../services/securityEngine';
import { useAuth } from '../context/AuthContext';

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
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  accent?: boolean;
  onClick?: () => void;
}> = ({ children, className, title, accent, onClick }) => (
  <div onClick={onClick} className={`bg-[#FFFFFF] text-[#0B0B0B] p-12 rounded-[40px] shadow-[0_15px_50px_rgba(0,0,0,0.02)] border border-gray-50/50 relative overflow-hidden transition-all duration-500 ${className}`}>
    {accent && <div className="absolute top-12 left-0 w-1 h-8 bg-[#FF0000] rounded-r-full" />}
    {title && (
      <div className="flex items-center gap-4 mb-10">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
        <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] opacity-80 uppercase tracking-[0.1em]">{title}</h2>
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
  <div className="flex gap-12 border-b border-gray-100 mb-12 overflow-x-auto no-scrollbar">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => onTabChange(tab)}
        className={`pb-5 text-xs font-bold uppercase tracking-widest transition-all relative ${
          activeTab === tab 
            ? 'text-[#0B0B0B]' 
            : 'text-gray-400 hover:text-gray-600'
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
}> = ({ label, placeholder, value, onChange, multiline, error, disabled, name }) => (
  <div className="flex flex-col mb-12">
    <label className="text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40">{label}</label>
    {multiline ? (
      <textarea
        name={name}
        disabled={disabled}
        className={`bg-[#FBFBFB] border ${error ? 'border-[#FF0000]/20' : 'border-gray-100'} p-8 rounded-[32px] focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 outline-none min-h-[180px] transition-all text-lg text-[#0B0B0B] placeholder:text-gray-300 leading-relaxed disabled:opacity-50`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e)}
      />
    ) : (
      <input
        name={name}
        disabled={disabled}
        className={`bg-[#FBFBFB] border ${error ? 'border-[#FF0000]/20' : 'border-gray-100'} p-8 rounded-[32px] focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 outline-none transition-all text-lg text-[#0B0B0B] placeholder:text-gray-300 disabled:opacity-50`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e)}
      />
    )}
    {error && <p className="mt-4 text-[10px] font-bold text-[#FF0000] uppercase tracking-widest opacity-60">{error}</p>}
  </div>
);

// 7. SECTION HEADER COMPONENT
export const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-12 mt-16">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-8 h-[2px] bg-[#FF0000] rounded-full" />
      <h3 className="text-xl font-bold tracking-tight text-[#0B0B0B] uppercase tracking-[0.2em]">{title}</h3>
    </div>
    {subtitle && <p className="text-gray-400 font-medium text-base ml-12">{subtitle}</p>}
  </div>
);

// 8. EMPTY STATE COMPONENT
export const EmptyState: React.FC<{ message: string; submessage?: string }> = ({ message, submessage }) => (
  <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in duration-1000">
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

// 10. ERROR MESSAGE COMPONENT
export const ErrorMessage: React.FC<{ 
  message: string; 
  action?: { label: string; onClick: () => void } 
}> = ({ message, action }) => (
  <div className="py-16 px-12 rounded-[40px] bg-gray-50/50 border border-gray-100 flex flex-col items-center text-center animate-in fade-in duration-500">
    <div className="w-1.5 h-1.5 bg-gray-200 rounded-full mb-8" />
    <p className="text-base font-medium text-gray-500 mb-8 max-w-sm leading-relaxed">{message}</p>
    {action && (
      <button 
        onClick={action.onClick}
        className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/10 pb-1"
      >
        {action.label}
      </button>
    )}
  </div>
);

// 11. RESULT CONTAINER
export const ResultContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-24 space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
    {children}
  </div>
);

// Page Title Template
export const PageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-24">
    <h1 className="text-4xl font-bold tracking-tight text-white mb-6 leading-tight">{title}</h1>
    <div className="w-12 h-[2px] bg-[#FF0000] rounded-full mb-8" />
    <p className="text-gray-500 font-medium text-xl max-w-2xl leading-relaxed">{subtitle}</p>
  </div>
);

// 12. TOKEN NOTICE COMPONENT
export const TokenNotice: React.FC<{ 
  tier: 'free' | 'pro'; 
  onUpgrade?: () => void;
  onContinue?: () => void;
}> = ({ tier, onUpgrade, onContinue }) => (
  <div className="py-24 px-12 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mb-10" />
    {tier === 'free' ? (
      <>
        <p className="text-2xl font-bold text-[#0B0B0B] mb-12 max-w-md leading-relaxed">
          You’ve used your free analysis credits. Upgrade to Pro to continue running analyses.
        </p>
        <div className="flex flex-col md:flex-row gap-6">
          <PrimaryButton onClick={onUpgrade}>Upgrade to Pro</PrimaryButton>
          <button 
            onClick={onContinue}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors py-4 px-10"
          >
            Continue exploring
          </button>
        </div>
      </>
    ) : (
      <p className="text-2xl font-bold text-[#0B0B0B] mb-4 max-w-md leading-relaxed">
        You’ve reached your monthly analysis allowance. Your usage resets next month.
      </p>
    )}
  </div>
);

// 13. TOKEN WARNING COMPONENT (SUBTLE)
export const TokenWarning: React.FC = () => (
  <div className="flex items-center justify-center gap-4 py-8 animate-in fade-in duration-1000">
    <div className="w-1 h-1 rounded-full bg-[#FF0000] animate-pulse" />
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
      You’re approaching your monthly usage limit.
    </p>
  </div>
);

// 14. UPGRADE CARD (DASHBOARD)
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

// 15. EXPORT CONTROLS
export const ExportControls: React.FC<{
  onCopy: () => void;
  onExportText?: () => void;
  onExportPDF?: () => void;
  isPro: boolean;
}> = ({ onCopy, onExportText, onExportPDF, isPro }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-8 py-8 px-10 bg-gray-50/50 rounded-2xl border border-gray-100 w-fit">
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

// 16. HONEYPOT COMPONENT
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

// 17. HONEYPOT FIELD
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
