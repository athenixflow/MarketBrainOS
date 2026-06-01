import React, { useState } from 'react';
import { FaqItem } from '../config/marketingContent';

const FaqAccordion: React.FC<{ items: FaqItem[] }> = ({ items }) => {
  const [open, setOpen] = useState<number>(-1);
  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="border border-gray-800 rounded-2xl bg-[#0F0F0F] overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 text-left px-7 py-6 hover:bg-gray-900/30 transition-colors"
            >
              <span className="text-white font-bold text-base md:text-lg">{item.q}</span>
              <span className={`text-[#FF0000] text-2xl font-light shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>+</span>
            </button>
            {isOpen && (
              <div className="px-7 pb-7 -mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-gray-500 leading-relaxed font-medium">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
