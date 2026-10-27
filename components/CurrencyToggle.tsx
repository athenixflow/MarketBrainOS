/**
 * Naira / Dollars, the same control on Pricing, the Token Store and the plan panel. The store and
 * panel used a 10px "₦ / $" pair that was hard to hit on a phone. A Nigerian buyer who picks dollars
 * is told the charge is in USD (founder decision D1): checkout pins billing_currency, so it is.
 */
import React from 'react';
import { Currency, defaultCurrency } from '../services/billing';
import { usdChargeNote } from '../services/planActions';

const CurrencyToggle: React.FC<{
  value: Currency;
  onChange: (c: Currency) => void;
  /** dark: on the page background; light: inside a white Card. */
  tone?: 'dark' | 'light';
  className?: string;
}> = ({ value, onChange, tone = 'dark', className = '' }) => {
  const note = usdChargeNote(defaultCurrency(), value);
  const border = tone === 'dark' ? 'border-gray-800' : 'border-gray-200';
  const on = tone === 'dark' ? 'bg-white text-[#0B0B0B]' : 'bg-[#0B0B0B] text-white';
  const off = tone === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-[#0B0B0B]';
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <div className="flex" role="group" aria-label="Currency">
        {(['NGN', 'USD'] as Currency[]).map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-pressed={value === c}
            className={`min-h-9 px-5 py-2 text-[11px] font-bold uppercase tracking-widest border ${border} first:rounded-l-xl last:rounded-r-xl transition-colors ${value === c ? on : off}`}>
            {c === 'NGN' ? '₦ Naira' : '$ Dollars'}
          </button>
        ))}
      </div>
      {note && <span className={`text-[11px] font-bold uppercase tracking-widest ${tone === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{note}</span>}
    </div>
  );
};

export default CurrencyToggle;
