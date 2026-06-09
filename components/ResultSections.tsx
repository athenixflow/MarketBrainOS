// Shared renderer for analysis result items. Each point is either a plain string (legacy/simple
// results) or a structured insight card { insight, evidence, action }. Used by ToolPage, History,
// and SharedLibrary so the detailed result layout is consistent everywhere and backward compatible.

import React from 'react';
import { ResultItem, StructuredResultItem } from '../types';

const isStructured = (item: ResultItem): item is StructuredResultItem =>
  typeof item === 'object' && item !== null && typeof (item as any).insight === 'string';

/** One result point — a rich card (insight → why it matters → recommended action) or a plain bullet. */
export const ResultItemCard: React.FC<{ item: ResultItem; compact?: boolean }> = ({ item, compact }) => {
  if (!isStructured(item)) {
    return (
      <div className={`flex items-start gap-3 ${compact ? 'p-4' : 'p-5'} bg-gray-50 rounded-2xl border border-gray-100`}>
        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
        <p className="text-sm text-gray-700 leading-relaxed font-medium flex-1">{item}</p>
      </div>
    );
  }
  return (
    <div className={`${compact ? 'p-4' : 'p-5'} bg-gray-50 rounded-2xl border border-gray-100`}>
      <div className="flex items-start gap-3">
        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
        <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold flex-1">{item.insight}</p>
      </div>
      {item.evidence && (
        <div className="mt-3 pl-[18px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Why it matters</span>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed font-medium">{item.evidence}</p>
        </div>
      )}
      {item.action && (
        <div className="mt-3 pl-[18px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#FF0000]">Do this</span>
          <p className="mt-1 text-sm text-gray-700 leading-relaxed font-semibold">{item.action}</p>
        </div>
      )}
    </div>
  );
};

/** A list of result items for one section. */
export const ResultItemList: React.FC<{ items: ResultItem[]; compact?: boolean }> = ({ items, compact }) => {
  if (!items || items.length === 0) {
    return <p className="text-gray-400 text-sm font-medium">No items in this section.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => <ResultItemCard key={i} item={item} compact={compact} />)}
    </div>
  );
};

export default ResultItemList;
