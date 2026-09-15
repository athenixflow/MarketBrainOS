// Form-level mode switch (NOT navigation - that is `Tabs` in UI.tsx). Radio semantics so a screen reader
// announces "1 of 2, checked". Pill geometry follows ScopeSwitcher. On a 390px phone the Card interior is
// 294px, so below `sm` the control is full-width with `flex-1` segments and 10px labels.
// Lives in its own file only because UI.tsx was under parallel edit; it belongs after `Tabs` there.

import React from 'react';

export const SegmentedControl = <T extends string>({ options, value, onChange, label, className = '' }: {
  options: Array<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  /** Accessible group name, e.g. "How to add this member". */
  label: string;
  className?: string;
}) => (
  <div role="radiogroup" aria-label={label} className={`flex w-full sm:inline-flex sm:w-auto p-1 rounded-full bg-gray-100 ${className}`}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/40 ${
            active ? 'bg-white text-[#0B0B0B] shadow-sm' : 'text-gray-500 hover:text-[#0B0B0B]'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
