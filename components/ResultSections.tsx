// Shared renderer for analysis result items. Each point is either a plain string (legacy/simple
// results) or a structured insight card { insight, evidence, action }. Used by ToolPage, History,
// and SharedLibrary so the detailed result layout is consistent everywhere and backward compatible.

import React from 'react';
import { ResultItem, StructuredResultItem } from '../types';

const isStructured = (item: ResultItem): item is StructuredResultItem =>
  typeof item === 'object' && item !== null && typeof (item as any).insight === 'string';

/** Plain-text form of a result item — the insight headline, or the string itself. Use in compact
 *  summary views (Dashboard, admin reports) that render one line per point, so a structured
 *  { insight, evidence, action } object is never passed to React as a child (avoids React #31). */
export const itemText = (item: ResultItem): string => asText(item);

// Defensively coerce any value to renderable text. Never returns an object, so React can never
// receive an object as a child (the cause of minified React #31). Handles strings, numbers, and
// loose AI/legacy shapes by digging out a sensible text field before falling back to "".
const asText = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return asText(v.insight ?? v.text ?? v.point ?? v.title ?? v.action ?? v.value ?? '');
  return '';
};

/** One result point — a rich card (insight → why it matters → recommended action) or a plain bullet. */
export const ResultItemCard: React.FC<{ item: ResultItem; compact?: boolean }> = ({ item, compact }) => {
  if (!isStructured(item)) {
    return (
      <div className={`flex items-start gap-3 ${compact ? 'p-4' : 'p-5'} bg-gray-50 rounded-2xl border border-gray-100`}>
        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
        <p className="text-sm text-gray-700 leading-relaxed font-medium flex-1">{asText(item)}</p>
      </div>
    );
  }
  const evidence = asText(item.evidence);
  const action = asText(item.action);
  return (
    <div className={`${compact ? 'p-4' : 'p-5'} bg-gray-50 rounded-2xl border border-gray-100`}>
      <div className="flex items-start gap-3">
        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
        <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold flex-1">{asText(item.insight)}</p>
      </div>
      {evidence && (
        <div className="mt-3 pl-[18px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Why it matters</span>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed font-medium">{evidence}</p>
        </div>
      )}
      {action && (
        <div className="mt-3 pl-[18px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#FF0000]">Do this</span>
          <p className="mt-1 text-sm text-gray-700 leading-relaxed font-semibold">{action}</p>
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
