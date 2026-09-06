
import React, { useState, useEffect, useId } from 'react';
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

// ---------------------------------------------------------------------------------------------------
// SURFACE MODEL. The signed-in app is a dark shell (#0B0B0B) holding white "paper" Cards. Every primitive
// below is either paper-only, shell-only, or takes a `tone` so it can sit on either. Nothing may render
// #0B0B0B text straight onto the #0B0B0B page. Geometry follows tailwind.config.js: surfaces and controls
// are rounded-2xl, chips are rounded-full, eyebrows are tracking-widest, numbers are tabular-nums.
// ---------------------------------------------------------------------------------------------------

type Tone = 'light' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

const PRIMARY_SIZE: Record<ButtonSize, string> = {
  sm: 'px-6 py-3 text-xs',
  md: 'px-10 py-4 text-sm',
  lg: 'px-14 py-5 text-base',
};
const SECONDARY_SIZE: Record<ButtonSize, string> = {
  sm: 'px-5 py-2.5 text-[11px]',
  md: 'px-8 py-3.5 text-xs',
  lg: 'px-12 py-5 text-sm',
};

// 1. PRIMARY ACTION BUTTON
export const PrimaryButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  /** sm for in-card actions, md (default) for page actions, lg for a single hero CTA. */
  size?: ButtonSize;
}> = ({ onClick, children, disabled, className = '', type = 'button', size = 'md' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`bg-[#FF0000] text-white ${PRIMARY_SIZE[size]} font-bold rounded-2xl shadow-sm hover:bg-[#D40000] hover:shadow-xl hover:shadow-[#FF0000]/10 active:scale-[0.99] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
);

// 2. SECONDARY BUTTON. `tone="dark"` is the variant for the page background (white text, grey border);
// the default light tone is for use inside white Cards.
export const SecondaryButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  size?: ButtonSize;
  tone?: Tone;
}> = ({ onClick, children, disabled, className = '', type = 'button', size = 'md', tone = 'light' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`bg-transparent border ${SECONDARY_SIZE[size]} font-bold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed tracking-widest uppercase active:scale-[0.99] ${
      tone === 'dark'
        ? 'text-white border-gray-700 hover:border-white hover:bg-white/5'
        : 'text-[#0B0B0B] border-gray-200 hover:bg-gray-50 hover:border-gray-300'
    } ${className}`}
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
}> = ({ children, className = '', title, accent, dark, onClick }) => (
  <div
    onClick={onClick}
    className={`${dark ? 'bg-[#121212] text-white border-gray-900' : 'paper bg-[#FFFFFF] text-[#0B0B0B] border-gray-100'} p-6 sm:p-8 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.02)] border relative overflow-hidden transition-all duration-500 ${className}`}
  >
    {accent && <div className="absolute top-8 left-0 w-1 h-8 bg-[#FF0000] rounded-r-full" />}
    {title && (
      <div className="flex items-center gap-4 mb-6">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] flex-shrink-0" />
        <h2 className={`text-sm font-bold uppercase tracking-widest ${dark ? 'text-white/90' : 'text-[#0B0B0B]/80'}`}>{title}</h2>
      </div>
    )}
    {children}
  </div>
);

// 4. SCORE / INTELLIGENCE INDICATOR
export const IntelligenceIndicator: React.FC<{ score: number }> = ({ score }) => (
  <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full border border-gray-100 bg-white shadow-sm font-bold text-xs text-[#0B0B0B] tracking-widest uppercase tabular-nums">
    <div className="flex h-2 w-2 relative">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0000] opacity-30"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0000]"></span>
    </div>
    Intelligence Grade: {score}
  </div>
);

// 5. TABS. `tone="dark"` (default) sits on the page; `tone="light"` sits inside a white Card.
// The rail scrolls horizontally on narrow screens instead of wrapping, so 5+ tabs stay on one line.
export const Tabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  tone?: Tone;
  className?: string;
}> = ({ tabs, activeTab, onTabChange, tone = 'dark', className = '' }) => (
  <div
    role="tablist"
    className={`flex gap-6 border-b ${tone === 'dark' ? 'border-gray-900/50' : 'border-gray-100'} mb-8 overflow-x-auto no-scrollbar ${className}`}
  >
    {tabs.map((tab) => {
      const active = activeTab === tab;
      return (
        <button
          key={tab}
          role="tab"
          aria-selected={active}
          onClick={() => onTabChange(tab)}
          className={`pb-4 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${
            active
              ? tone === 'dark' ? 'text-white' : 'text-[#0B0B0B]'
              : tone === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {tab}
          {active && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />}
        </button>
      );
    })}
  </div>
);

// Shared field chrome for Input and Select. Geometry matches components/auth/AuthField.
const fieldClasses = (tone: Tone, error?: boolean) =>
  `w-full min-w-0 border px-4 py-3.5 rounded-2xl outline-none transition-all text-[15px] focus:ring-4 focus:ring-[#FF0000]/10 focus:border-[#FF0000] disabled:opacity-50 ${
    tone === 'dark'
      ? `bg-[#121212] text-white placeholder:text-gray-500 ${error ? 'border-red-500/60' : 'border-gray-800'}`
      : `bg-[#FBFBFB] text-[#0B0B0B] placeholder:text-gray-500 ${error ? 'border-red-300' : 'border-gray-200'}`
  }`;

const FieldLabel: React.FC<{ htmlFor: string; label?: string; right?: React.ReactNode; tone: Tone }> = ({ htmlFor, label, right, tone }) => {
  if (!label && !right) return null;
  return (
    <div className="flex items-center justify-between gap-4 mb-2">
      {label ? (
        <label htmlFor={htmlFor} className={`text-[11px] font-bold tracking-widest uppercase ${tone === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}
        </label>
      ) : <span />}
      {right}
    </div>
  );
};

// 6. INPUT FIELDS
export const Input: React.FC<{
  /** Optional only for search boxes that carry their meaning in the placeholder; pass `ariaLabel` then. */
  label?: string;
  ariaLabel?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  multiline?: boolean;
  error?: string;
  /** Helper text or a char counter under the field. Replaces the old `-mt-4 mb-6` hack at call sites. */
  hint?: React.ReactNode;
  /** Something small to the right of the label, e.g. a mode pill. */
  labelRight?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  /** Defaults to "text". MUST be set to "password" for secrets, or the value renders in clear text. */
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search';
  autoComplete?: string;
  maxLength?: number;
  /** Removes the bottom margin for fields inside a grid or a toolbar. */
  compact?: boolean;
  tone?: Tone;
  className?: string;
}> = ({ label, ariaLabel, placeholder, value, onChange, multiline, error, hint, labelRight, disabled, name, type = 'text', autoComplete, maxLength, compact, tone = 'light', className = '' }) => {
  const id = useId();
  // The bottom margin is mb-6, not mb-12: the old 48px was un-overridable and every consumer cancelled
  // it with a -mt-10 hack, which in one case dragged the char counter on top of its own helper text.
  return (
    <div className={`flex flex-col ${compact ? '' : 'mb-6'} ${className}`}>
      <FieldLabel htmlFor={id} label={label} right={labelRight} tone={tone} />
      {multiline ? (
        <textarea
          id={id}
          name={name}
          disabled={disabled}
          maxLength={maxLength}
          aria-label={label ? undefined : ariaLabel || placeholder}
          aria-invalid={!!error}
          className={`${fieldClasses(tone, !!error)} min-h-[150px] leading-relaxed`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e)}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          disabled={disabled}
          maxLength={maxLength}
          aria-label={label ? undefined : ariaLabel || placeholder}
          aria-invalid={!!error}
          className={fieldClasses(tone, !!error)}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e)}
        />
      )}
      {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
      {hint && !error && <div className={`mt-2 text-xs leading-relaxed ${tone === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{hint}</div>}
    </div>
  );
};

// 6b. SELECT. Same geometry as Input; replaces the 19 raw <select> elements that each had their own.
export const Select: React.FC<{
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
  name?: string;
  compact?: boolean;
  tone?: Tone;
  className?: string;
}> = ({ label, ariaLabel, value, onChange, options, disabled, name, compact, tone = 'light', className = '' }) => {
  const id = useId();
  return (
    <div className={`flex flex-col ${compact ? '' : 'mb-6'} ${className}`}>
      <FieldLabel htmlFor={id} label={label} tone={tone} />
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClasses(tone)} appearance-none pr-11 cursor-pointer`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 ${tone === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
};

// 6c. CHECKBOX
export const Checkbox: React.FC<{
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  tone?: Tone;
  className?: string;
}> = ({ label, checked, onChange, disabled, tone = 'light', className = '' }) => (
  <label className={`inline-flex items-center gap-3 text-sm font-medium cursor-pointer select-none ${tone === 'dark' ? 'text-gray-300' : 'text-[#0B0B0B]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded accent-[#FF0000]" />
    {label}
  </label>
);

// 7. SECTION HEADER. Pass `onDark` when it sits on the page background rather than inside a Card;
// without it the title was #0B0B0B on #0B0B0B (AngleMinerX / TestLabPro result headings were invisible).
export const SectionHeader: React.FC<{ title: string; subtitle?: string; onDark?: boolean; className?: string }> = ({ title, subtitle, onDark, className = '' }) => (
  <div className={`mb-8 mt-12 ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      <div className="w-8 h-[2px] bg-[#FF0000] rounded-full flex-shrink-0" />
      <h3 className={`text-xl font-bold uppercase tracking-widest ${onDark ? 'text-white' : 'text-[#0B0B0B]'}`}>{title}</h3>
    </div>
    {subtitle && <p className={`font-medium text-base ml-12 ${onDark ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</p>}
  </div>
);

// 7b. SECTION LABEL. The small eyebrow above a group of cards on the page (Dashboard "AI Insights").
// One style for all of them instead of the six hand-rolled variants that used to exist.
export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string; action?: React.ReactNode }> = ({ children, className = '', action }) => (
  <div className={`flex items-center justify-between gap-4 mb-6 ${className}`}>
    <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{children}</h2>
    {action}
  </div>
);

// 8. EMPTY STATE. Renders inside whatever paper surface it is placed on; `card` wraps it in a white Card
// for the pages that show it directly on the dark background.
export const EmptyState: React.FC<{
  message: string;
  submessage?: string;
  action?: React.ReactNode;
  card?: boolean;
  className?: string;
}> = ({ message, submessage, action, card, className = '' }) => {
  const body = (
    <div className={`py-16 flex flex-col items-center justify-center text-center animate-in fade-in duration-500 ${className}`}>
      <div className="w-12 h-12 bg-[#F9F9F9] border border-gray-100 rounded-full mb-8 flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full opacity-30" />
      </div>
      <h3 className="text-xl font-bold text-gray-400 mb-3">{message}</h3>
      {submessage && <p className="text-gray-400/60 text-sm max-w-xs leading-relaxed">{submessage}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
  return card ? <Card>{body}</Card> : body;
};

// 8b. PERMISSION DENIED. Replaces the plain <p>You don't have permission…</p> lines in the org hubs.
export const PermissionDenied: React.FC<{ message?: string; submessage?: string; card?: boolean }> = ({
  message = 'You do not have access to this section',
  submessage = 'Ask an owner or admin of this workspace to grant you the right role.',
  card = true,
}) => {
  const body = (
    <div className="py-16 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
      <div className="w-12 h-12 bg-[#F9F9F9] border border-gray-100 rounded-full mb-8 flex items-center justify-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-400 mb-3">{message}</h3>
      <p className="text-gray-400/60 text-sm max-w-xs leading-relaxed">{submessage}</p>
    </div>
  );
  return card ? <Card>{body}</Card> : body;
};

// 8c. SKELETON. A loading placeholder shaped like the content it stands in for. Use instead of a bare
// "Loading…" line inside cards and lists.
export const Skeleton: React.FC<{ className?: string; tone?: Tone }> = ({ className = 'h-4 w-full', tone = 'light' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-2xl ${tone === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} ${className}`} />
);

// 8d. BADGE / PILL
export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'neutral' | 'red' | 'green' | 'blue' | 'yellow' | 'dark';
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'bg-gray-100 text-gray-500',
    red: 'bg-red-50 text-[#FF0000]',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-700',
    dark: 'bg-[#1A1A1A] text-gray-300 border border-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

// 8e. STAT / KPI TILE. One implementation for Dashboard, TokenStore and BillingCenter.
export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  size?: 'md' | 'lg';
  className?: string;
}> = ({ label, value, sub, tone = 'light', size = 'md', className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tone === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
    <p className={`${size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} font-black tracking-tight tabular-nums leading-none ${tone === 'dark' ? 'text-white' : 'text-[#0B0B0B]'}`}>{value}</p>
    {sub && <div className={`mt-2 text-xs font-medium ${tone === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{sub}</div>}
  </div>
);

// 8f. COMING SOON. Single source (Settings and the admin primitives used to carry identical copies).
export const ComingSoon: React.FC<{ label?: string; className?: string }> = ({ label = 'Coming soon', className = '' }) => (
  <Badge tone="neutral" className={className}>{label}</Badge>
);

// 9. LOADING / PROCESSING STATE
export const LoadingState: React.FC<{
  message?: string;
  isTakingLong?: boolean;
  onCancel?: () => void;
}> = ({ message = 'Analyzing...', isTakingLong, onCancel }) => (
  <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
    <div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mb-6 animate-pulse" />
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">{message}</span>
    {isTakingLong && (
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in">
        This is taking longer than usual. Still working…
      </p>
    )}
    {onCancel && (
      <button
        onClick={onCancel}
        className="mt-8 text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors"
      >
        Cancel and retry
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
  action?: { label: string; onClick: () => void };
  className?: string;
}> = ({ message, action, className = '' }) => (
  <div
    role="alert"
    className={`rounded-2xl bg-[#B91C1C] px-4 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 animate-in fade-in duration-300 ${className}`}
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

// 10b. SUCCESS MESSAGE. The counterpart to ErrorMessage for "Saved." style confirmations, so pages stop
// colouring a <p> by string equality.
export const SuccessMessage: React.FC<{ message: string; className?: string }> = ({ message, className = '' }) => (
  <div role="status" className={`rounded-2xl bg-green-50 border border-green-100 px-4 py-3 flex items-center gap-3 animate-in fade-in duration-300 ${className}`}>
    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
    <p className="text-[13px] font-medium text-green-700">{message}</p>
  </div>
);

// Shared shell for the four result-blocking states below. Solid light panels so they read as paper on the
// dark page (the old 30-50% tints turned near-black there, with #0B0B0B text on top).
const StatePanel: React.FC<{
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ bg, border, iconBg, iconColor, icon, title, children }) => (
  <div className={`paper py-12 px-6 sm:px-8 rounded-2xl ${bg} border ${border} flex flex-col items-center text-center animate-in fade-in duration-500 my-8`}>
    <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-full flex items-center justify-center mb-6 shadow-sm`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">{icon}</svg>
    </div>
    <h3 className="text-lg font-bold text-[#0B0B0B] mb-2 uppercase tracking-wide">{title}</h3>
    {children}
  </div>
);

const NoTokensChip: React.FC<{ className?: string }> = ({ className = 'mb-8' }) => (
  <div className={`flex items-center gap-3 px-5 py-2.5 bg-white rounded-full border border-gray-100 shadow-sm ${className}`}>
    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">No tokens were deducted</span>
  </div>
);

// 11. ANALYSIS FAILURE STATE (SERVER / TOKENS)
export const AnalysisFailureState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <StatePanel
    bg="bg-red-50" border="border-red-100" iconBg="bg-red-100" iconColor="text-red-500"
    icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />}
    title="Analysis interrupted"
  >
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>
    <NoTokensChip />
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:text-[#D40000] hover:underline underline-offset-4 transition-all"
      >
        Adjust inputs and retry
      </button>
    )}
  </StatePanel>
);

// 11b. SYSTEM BLOCK STATE (MAINTENANCE / PAUSE)
export const SystemBlockState: React.FC<{ message: string }> = ({ message }) => (
  <StatePanel
    bg="bg-yellow-50" border="border-yellow-100" iconBg="bg-yellow-100" iconColor="text-yellow-600"
    icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />}
    title="Analysis unavailable"
  >
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>
    <NoTokensChip className="mb-6" />
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Please check back shortly.</p>
  </StatePanel>
);

// 11c. RATE LIMIT STATE (COOLDOWN)
export const RateLimitState: React.FC<{ message: string }> = ({ message }) => (
  <StatePanel
    bg="bg-blue-50" border="border-blue-100" iconBg="bg-blue-100" iconColor="text-blue-600"
    icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />}
    title="Cooldown active"
  >
    <p className="text-sm font-medium text-gray-500 mb-2">You’re making requests too quickly.</p>
    <p className="text-xs text-gray-400 mb-8 max-w-md leading-relaxed">
      {message.toLowerCase().includes('wait') || message.toLowerCase().includes('limit')
        ? message
        : 'To keep the platform stable, we limit how often complex analyses can run.'}
    </p>
    <NoTokensChip className="mb-6" />
    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Please try again in a moment.</p>
  </StatePanel>
);

// 11d. NETWORK ERROR STATE (CONNECTIVITY/CORS)
export const NetworkErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <StatePanel
    bg="bg-gray-50" border="border-gray-200" iconBg="bg-gray-200" iconColor="text-gray-500"
    icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 12.75m0 0l7.5-4.5 4.885 2.932m-4.885 5.568l3-1.8m-3 1.8L9 15.75m3-3v3m0-3l-3-3m3 3l3 3" />}
    title="Network unreachable"
  >
    <p className="text-sm font-medium text-gray-500 mb-8 max-w-md leading-relaxed">{message}</p>
    <NoTokensChip />
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-[10px] font-bold text-[#0B0B0B] uppercase tracking-widest hover:underline underline-offset-4 transition-all"
      >
        Retry connection
      </button>
    )}
  </StatePanel>
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

// Page Title Template. The one header pattern for every signed-in page: title, red rule, description,
// and an optional action slot that wraps under the title on narrow screens.
export const PageHeader: React.FC<{ title: string; subtitle: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
    <div className="min-w-0">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5 leading-tight">{title}</h1>
      <div className="w-12 h-[2px] bg-[#FF0000] rounded-full mb-6" />
      <p className="text-gray-500 font-medium text-lg sm:text-xl max-w-2xl leading-relaxed">{subtitle}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
  </div>
);

// 12b. MODAL SHELL. Escape closes, backdrop click closes, background scroll is locked while open.
// UsageLimitModal and the ledger modals below are built on it; nothing should hand-roll a fixed overlay.
export const Modal: React.FC<{
  open?: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Set when the body should scroll inside the dialog (long lists). */
  scrollBody?: boolean;
}> = ({ open = true, onClose, title, size = 'md', children, footer, scrollBody }) => {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }[size];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`paper bg-white text-[#0B0B0B] ${width} w-full p-6 sm:p-8 rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300`}
      >
        {title && (
          <div className="flex justify-between items-start gap-6 mb-6 shrink-0">
            <div className="min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mb-3" />
              <h3 id={titleId} className="text-2xl font-bold tracking-tight">{title}</h3>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 -m-2 text-gray-400 hover:text-[#0B0B0B] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className={scrollBody ? 'overflow-y-auto flex-grow min-h-0 pr-1' : ''}>{children}</div>
        {footer && <div className="pt-6 mt-6 border-t border-gray-100 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

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

  let content = { title: '', body: '', primaryCTA: '', secondaryCTA: '', hint: '' };

  if (isFree) {
    if (reason === 'exhausted') {
      content = {
        title: 'You’ve used your free tokens',
        body: `Your Free allowance is a one-time balance and does not refill.\nUpgrade to Pro to get ${PRO_TOKENS} tokens every month and keep running analyses.`,
        primaryCTA: `Upgrade to Pro, $${PRO_PRICE}/month`,
        secondaryCTA: 'Not now',
        hint: 'Tokens are only used when analyses complete successfully.',
      };
    } else {
      content = {
        title: 'This analysis needs more tokens',
        body: 'This tool requires more tokens than are available on the Free plan.\nUpgrade to Pro to unlock full access and monthly tokens.',
        primaryCTA: 'Upgrade to Pro',
        secondaryCTA: 'Go back',
        hint: '',
      };
    }
  } else if (reason === 'exhausted') {
    content = {
      title: 'You’ve used all your tokens',
      body: 'You’ve used your monthly tokens.\nTop up to keep running analyses instantly.',
      primaryCTA: 'Top up tokens',
      secondaryCTA: 'Wait for monthly reset',
      hint: `$${STARTER_PACK.price} = ${STARTER_PACK.tokens} tokens`,
    };
  } else {
    content = {
      title: 'This analysis needs more tokens',
      body: 'Your balance is below the cost of this tool.\nTop up to run it now.',
      primaryCTA: 'Top up tokens',
      secondaryCTA: 'Go back',
      hint: `$${STARTER_PACK.price} = ${STARTER_PACK.tokens} tokens`,
    };
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="w-2 h-2 rounded-full bg-[#FF0000] mb-8" />
      <h3 className="text-2xl font-bold mb-4 tracking-tight">{content.title}</h3>
      <p className="text-gray-500 font-medium mb-8 leading-relaxed whitespace-pre-line">{content.body}</p>
      {content.hint && (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">{content.hint}</p>
      )}
      <div className="flex flex-col gap-4">
        <PrimaryButton onClick={handlePrimaryAction} className="w-full">{content.primaryCTA}</PrimaryButton>
        <button
          onClick={onClose}
          className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest py-3 transition-colors"
        >
          {content.secondaryCTA}
        </button>
      </div>
    </Modal>
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
      <div className="w-full bg-[#1A1A1A] border border-gray-800 rounded-2xl py-3 px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          You’re on the Free plan. Upgrade to Pro to get {PRO_TOKENS} tokens every month.
        </p>
        <button
          onClick={() => navigate('/pricing')}
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
      <div className="w-full bg-[#1A1A1A] border border-[#FF0000]/30 rounded-2xl py-3 px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
          <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest">
            You’re running low on tokens. Top up {STARTER_PACK.tokens} tokens for ${STARTER_PACK.price} to avoid interruptions.
          </p>
        </div>
        <button
          onClick={() => navigate('/store')}
          className="text-[10px] font-bold text-white uppercase tracking-widest hover:text-[#FF0000] transition-colors"
        >
          Top up tokens →
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
        <p className="text-[10px] font-bold uppercase tracking-widest mb-8 opacity-60">Pro plan</p>
        <h3 className="text-3xl font-bold tracking-tight mb-8 leading-tight">Upgrade to Pro to keep working without interruption.</h3>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-widest border-b border-white/40 pb-1">See plans and pricing</span>
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
      className="bg-[#121212] text-white p-6 sm:p-8 rounded-2xl border border-gray-800 relative overflow-hidden cursor-pointer hover:border-[#FF0000]/40 transition-all duration-500 group"
    >
      <div className="flex items-center gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Locked</p>
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
  /** dark = on the page background (AngleMinerX / TestLabPro headers); light = inside a Card. */
  tone?: Tone;
}> = ({ onCopy, onExportText, onExportCSV, onExportPDF, isPro, tone = 'light' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btn = tone === 'dark'
    ? 'text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors'
    : 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';
  const divider = tone === 'dark' ? 'w-[1px] h-3 bg-gray-800' : 'w-[1px] h-3 bg-gray-200';

  return (
    // `w-fit` + no wrap gave this a ~450px intrinsic width; it renders inside a Card that has ~246px
    // of interior on a 390px screen, and Card's overflow-hidden made the last buttons unreachable.
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-2xl border ${tone === 'dark' ? 'bg-[#121212] border-gray-800' : 'bg-gray-50/50 border-gray-100'}`}>
      <button onClick={handleCopy} className={`${btn} flex items-center gap-2`}>
        {copied ? 'Text copied' : 'Copy to clipboard'}
      </button>

      {isPro && (
        <>
          <div className={divider} />
          <button onClick={onExportText} className={btn}>Export TXT</button>
          {onExportCSV && (
            <>
              <div className={divider} />
              <button onClick={onExportCSV} className={btn}>Export CSV</button>
            </>
          )}
          <div className={divider} />
          <button onClick={onExportPDF} className={btn}>Export PDF</button>
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

// 19/20. LEDGER MODALS. Token usage and top-up receipts share one modal; the two used to be 95%
// identical copies. Row shape is the same as LedgerRow used by Settings and BillingCenter.
export const LedgerRow: React.FC<{
  when: Date;
  title: string;
  detail?: React.ReactNode;
  right: React.ReactNode;
}> = ({ when, title, detail, right }) => (
  <div className="p-5 sm:p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-6 hover:bg-gray-100 transition-colors">
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
        {when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-sm font-bold text-[#0B0B0B] truncate">{title}</p>
      {detail && <p className="text-xs text-gray-500 font-medium truncate">{detail}</p>}
    </div>
    <div className="text-right shrink-0 tabular-nums">{right}</div>
  </div>
);

const LedgerModal: React.FC<{ kind: 'tokens' | 'payments'; onClose: () => void }> = ({ kind, onClose }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = kind === 'tokens'
      ? getUserActionLogs(user.uid).then(setLogs)
      : getUserPaymentHistory(user.uid).then(setPayments);
    load
      .catch(() => setError('We could not load these records. Please try again.'))
      .finally(() => setLoading(false));
  }, [user, kind]);

  const isTokens = kind === 'tokens';
  const count = isTokens ? logs.length : payments.length;

  return (
    <Modal
      onClose={onClose}
      title={isTokens ? 'Token usage history' : 'Top-up receipts'}
      scrollBody
      footer={
        <div className="text-center">
          {!isTokens && payments.length > 0 && (
            <button
              onClick={() => downloadAsCSV('MarketBrainOS_Billing_History', paymentsToCSV(payments))}
              className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors mb-3"
            >
              Export CSV
            </button>
          )}
          <p className="text-[10px] text-gray-400">
            {isTokens ? 'All records are server-verified.' : 'Top-ups add extra tokens that never expire.'}
          </p>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <ErrorMessage message={error} />
      ) : count === 0 ? (
        <div className="py-16 text-center text-gray-400 font-medium">
          {isTokens ? 'No token usage recorded yet.' : 'You haven’t topped up any tokens yet.'}
        </div>
      ) : isTokens ? (
        <div className="space-y-3">
          {logs.map((log) => {
            const date = log.created_at ? new Date(log.created_at.toMillis()) : new Date(log.timestamp || 0);
            const isTopUp = log.action === 'token_topup';
            const isFailure = log.status === 'failed_refunded';
            return (
              <LedgerRow
                key={log.id}
                when={date}
                title={isTopUp ? 'Token purchase' : log.module || 'System action'}
                detail={isTopUp ? 'Account top-up' : log.action || 'Analysis'}
                right={
                  isFailure ? (
                    <div>
                      <Badge tone="neutral" className="mb-1">Refunded</Badge>
                      <p className="text-xs font-bold text-gray-400 line-through">{log.tokens_used} tokens</p>
                    </div>
                  ) : isTopUp ? (
                    <div>
                      <p className="text-sm font-black text-green-600">+{log.tokens_added ?? STARTER_PACK.tokens} tokens</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${log.amount_paid ?? STARTER_PACK.price}.00</p>
                    </div>
                  ) : (
                    <p className="text-sm font-black text-[#0B0B0B]">-{log.tokens_used} tokens</p>
                  )
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const date = payment.created_at ? new Date(payment.created_at.toMillis()) : new Date(0);
            const isFailed = payment.status === 'failed';
            return (
              <LedgerRow
                key={payment.id}
                when={date}
                title="Token top-up"
                detail={<span className="font-mono">Ref: {payment.payment_reference || 'N/A'}</span>}
                right={
                  isFailed ? (
                    <div>
                      <Badge tone="red" className="mb-1">Failed</Badge>
                      <p className="text-xs font-bold text-gray-400 line-through">${payment.amount_paid}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-black text-green-600">+{payment.tokens_credited} tokens</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${payment.amount_paid}.00 USD</p>
                    </div>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export const TokenHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => <LedgerModal kind="tokens" onClose={onClose} />;
export const PaymentHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => <LedgerModal kind="payments" onClose={onClose} />;
