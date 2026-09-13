// Single source of truth for turning a result item into text.
//
// There used to be two independent implementations: asText() in components/ResultSections.tsx knew
// five key names, and itemToText()/itemToHtml() in services/exportService.ts knew three. They
// disagreed, so hardening one left the other exposed - and both returned '' for a shape neither
// recognised. That is how Conversion Doctor's "Recommended fixes" rendered as five blank bullets on
// screen AND in the exported PDF: the History normalizer passed through a raw
// { what, how, expectedResult, priority } object, and every renderer silently swallowed it.
//
// Blank output is the failure mode that hides. Nothing throws, nothing logs, the content just is not
// there. So the last resort below deliberately returns the object's own string values rather than '':
// a future field rename then shows something imperfect, which gets reported, instead of nothing.

import { ResultItem, StructuredResultItem } from '../types';

/** A rich card is only appropriate when `insight` is genuinely present. */
export const isStructuredItem = (item: ResultItem): item is StructuredResultItem =>
  typeof item === 'object' && item !== null && typeof (item as any).insight === 'string';

/** Keys that carry the headline text across the shapes this app has produced over time. */
const TEXT_KEYS = ['insight', 'text', 'point', 'title', 'action', 'value', 'what', 'blocker', 'label'];

/**
 * Coerce any value to renderable text. Never returns an object, so React cannot receive one as a
 * child (the cause of minified React #31), and never returns '' for an object that holds text.
 */
export const asText = (v: any, depth = 0): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map((x) => asText(x, depth + 1)).filter(Boolean).join(', ');
  if (typeof v !== 'object') return '';
  if (depth > 3) return '';

  for (const k of TEXT_KEYS) {
    const hit = (v as any)[k];
    if (typeof hit === 'string' && hit.trim()) return hit;
  }
  // Unrecognised shape: surface whatever text it carries rather than rendering nothing.
  const own = Object.values(v).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return own.length ? own.join(' — ') : '';
};

/** Plain-text form of a result item — the headline, or the string itself. */
export const itemText = (item: ResultItem): string => asText(item);

/**
 * Which variant won a TestLab run. Exact label equality alone is fragile: the model returns e.g.
 * "A" while winnerLabel reads "Variant A". TestLabPro grew loose/max-score fallbacks for this and
 * documented the empty " is the Projected Winner" card it caused; Workflow kept the exact match and
 * dead-ended at step 5 with "No winning variant found" after three billed tools. One resolver now.
 */
export const resolveWinner = <V extends { label?: string; score?: number }>(variants: V[] | undefined | null, winnerLabel?: string | null): V | null => {
  const list = variants || [];
  if (list.length === 0) return null;
  const target = (winnerLabel || '').trim().toLowerCase();
  if (target) {
    const exact = list.find((v) => (v.label || '').trim().toLowerCase() === target);
    if (exact) return exact;
    const loose = list.find((v) => {
      const label = (v.label || '').trim().toLowerCase();
      return !!label && (label.includes(target) || target.includes(label));
    });
    if (loose) return loose;
  }
  return list.reduce((best, v) => ((v.score || 0) > (best.score || 0) ? v : best), list[0]);
};
