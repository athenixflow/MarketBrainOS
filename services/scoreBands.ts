// PRD §24 / V1 Tool Architecture — 0–100 analysis score banding.
// Single source of truth so every scored result labels consistently.

export type ScoreBand = 'Critical' | 'Weak' | 'Average' | 'Strong' | 'Excellent';

export interface ScoreBandInfo {
  band: ScoreBand;
  // Tailwind text + subtle background classes for a pill.
  textClass: string;
  bgClass: string;
}

export const getScoreBand = (score: number): ScoreBandInfo => {
  const n = Math.max(0, Math.min(100, Math.round(score || 0)));
  if (n <= 20) return { band: 'Critical', textClass: 'text-red-600', bgClass: 'bg-red-50 border-red-100' };
  if (n <= 40) return { band: 'Weak', textClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-100' };
  if (n <= 60) return { band: 'Average', textClass: 'text-yellow-600', bgClass: 'bg-yellow-50 border-yellow-100' };
  if (n <= 80) return { band: 'Strong', textClass: 'text-green-600', bgClass: 'bg-green-50 border-green-100' };
  return { band: 'Excellent', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-100' };
};
