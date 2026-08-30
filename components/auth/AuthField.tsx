// Form controls for the auth surface. These replace the shared UI.Input on auth screens because that
// component renders no `type` attribute (so password values were displayed in clear text) and carries
// a rounded-[32px] / p-8 geometry that reads as oversized in a real form.
//
// Every control here: label above the field, helper/error below, WCAG-AA contrast on white, a proper
// input type + autoComplete so password managers and browser autofill work.
import React, { useId, useState } from 'react';

const FIELD_BASE =
  'w-full bg-white border rounded-2xl px-4 py-3.5 text-[15px] text-[#0B0B0B] placeholder:text-gray-500 outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

export const AuthField: React.FC<{
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  /** Optional control rendered to the right of the label, e.g. a "Forgot password?" link. */
  action?: React.ReactNode;
  autoFocus?: boolean;
}> = ({ label, type = 'text', value, onChange, placeholder, autoComplete, disabled, error, action, autoFocus }) => {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && reveal ? 'text' : type;

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <label htmlFor={id} className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          {label}
        </label>
        {action}
      </div>

      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_BASE} ${isPassword ? 'pr-12' : ''} ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
              : 'border-gray-200 hover:border-gray-300 focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10'
          }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((s) => !s)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-gray-400 hover:text-[#0B0B0B] hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
              {reveal ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="mt-2 text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

/** Four-segment strength meter. Shown only once the user starts typing a new password. */
export const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const score = Math.min(
    4,
    (password.length >= 8 ? 1 : 0) +
      (/[A-Z]/.test(password) ? 1 : 0) +
      (/[0-9]/.test(password) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 1 : 0),
  );
  const weak = password.length < 8;
  const label = weak ? 'Too short' : ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const tone = weak || score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-400' : 'bg-green-500';

  return (
    <div className="-mt-2 mb-5">
      <div className="flex gap-1.5" role="presentation">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${!weak && i < score ? tone : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="mt-2 text-[12px] font-medium text-gray-500">
        Password strength: <span className="text-[#0B0B0B] font-bold">{label}</span>
      </p>
    </div>
  );
};

/** Inline status block for form-level errors and confirmations. */
export const FormAlert: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`mb-5 rounded-2xl px-4 py-3.5 text-[13px] font-medium leading-relaxed border ${
      tone === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-800'
    }`}
  >
    {children}
  </div>
);

/** Google identity provider button. Marked-up as a real button with the official wordmark colours. */
export const GoogleButton: React.FC<{ onClick: () => void; disabled?: boolean; label: string }> = ({
  onClick,
  disabled,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-[#0B0B0B] py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-50 hover:border-gray-400 active:scale-[0.99] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 01-.35-2.11c0-.73.13-1.44.35-2.11V7.05H2.18a11 11 0 000 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 00-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" />
    </svg>
    {label}
  </button>
);

/** Labelled hairline divider used between the provider button and the email form. */
export const OrDivider: React.FC<{ label?: string }> = ({ label = 'or' }) => (
  <div className="relative flex items-center py-6">
    <div className="flex-grow border-t border-gray-200" />
    <span className="flex-shrink-0 mx-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    <div className="flex-grow border-t border-gray-200" />
  </div>
);
