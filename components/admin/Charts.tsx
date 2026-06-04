// Hand-rolled, dependency-free SVG charts for the admin dashboard. Themed to the app palette
// (#FF0000 accent on white cards). Intentionally lightweight — line/area, bars, and a donut —
// enough for growth/revenue/consumption visuals without pulling in a charting library.

import React from 'react';

export interface Point { label: string; value: number; }

const RED = '#FF0000';

// Line + area chart over an evenly-spaced series.
export const LineChart: React.FC<{ data: Point[]; height?: number; color?: string; valueFormat?: (n: number) => string }> =
  ({ data, height = 160, color = RED, valueFormat }) => {
    const w = 600;
    const h = height;
    const pad = 8;
    if (data.length === 0) return <div className="py-12 text-center text-sm text-gray-300 font-medium">No data yet.</div>;
    const max = Math.max(1, ...data.map(d => d.value));
    const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
    const y = (v: number) => pad + (h - pad * 2) * (1 - v / max);
    const pts = data.map((d, i) => `${pad + i * stepX},${y(d.value)}`);
    const linePath = `M ${pts.join(' L ')}`;
    const areaPath = `M ${pad},${h - pad} L ${pts.join(' L ')} L ${pad + (data.length - 1) * stepX},${h - pad} Z`;
    const last = data[data.length - 1];
    return (
      <div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
          <defs>
            <linearGradient id="adminAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#adminAreaFill)" />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {data.length > 1 && <circle cx={pad + (data.length - 1) * stepX} cy={y(last.value)} r={4} fill={color} />}
        </svg>
        <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          <span>{data[0].label}</span>
          <span>{valueFormat ? valueFormat(last.value) : last.value}</span>
          <span>{last.label}</span>
        </div>
      </div>
    );
  };

// Horizontal bars (ranked list).
export const BarChart: React.FC<{ data: Point[]; max?: number; valueFormat?: (n: number) => string }> = ({ data, max, valueFormat }) => {
  if (data.length === 0) return <div className="py-8 text-center text-sm text-gray-300 font-medium">No data yet.</div>;
  const top = max || Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-4">
      {data.map(d => (
        <div key={d.label}>
          <div className="flex justify-between text-xs font-bold text-[#0B0B0B] mb-1.5">
            <span className="truncate pr-3">{d.label}</span>
            <span className="text-gray-400 shrink-0">{valueFormat ? valueFormat(d.value) : d.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-[#FF0000] rounded-full" style={{ width: `${Math.round((d.value / top) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Donut for a small categorical breakdown.
export const DonutChart: React.FC<{ data: Point[]; size?: number }> = ({ data, size = 160 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const palette = ['#FF0000', '#0B0B0B', '#9CA3AF', '#FCA5A5', '#D1D5DB', '#6B7280'];
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  if (total === 0) return <div className="py-8 text-center text-sm text-gray-300 font-medium">No data yet.</div>;
  return (
    <div className="flex items-center gap-8 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * c;
            const seg = (
              <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={palette[i % palette.length]} strokeWidth={16}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return seg;
          })}
        </g>
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
            <span className="text-xs font-bold text-[#0B0B0B]">{d.label}</span>
            <span className="text-[10px] font-bold text-gray-400">{d.value} ({total ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Inline mini sparkline.
export const Sparkline: React.FC<{ values: number[]; width?: number; height?: number; color?: string }> =
  ({ values, width = 120, height = 32, color = RED }) => {
    if (values.length < 2) return null;
    const max = Math.max(1, ...values);
    const stepX = width / (values.length - 1);
    const pts = values.map((v, i) => `${i * stepX},${height - (height - 3) * (v / max) - 1.5}`).join(' L ');
    return (
      <svg width={width} height={height} className="overflow-visible">
        <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

// --- helpers: bucket timestamped records into the last N days for growth charts ---
export const bucketByDay = (timestamps: number[], days = 14): Point[] => {
  const now = new Date();
  const buckets: Point[] = [];
  const counts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    counts[key] = 0;
    buckets.push({ label: key, value: 0 });
  }
  timestamps.forEach(ts => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (key in counts) counts[key]++;
  });
  return buckets.map(b => ({ label: b.label, value: counts[b.label] || 0 }));
};

// Cumulative variant (for total-growth lines).
export const cumulativeByDay = (timestamps: number[], days = 14, baseline = 0): Point[] => {
  const daily = bucketByDay(timestamps, days);
  let running = baseline;
  return daily.map(d => { running += d.value; return { label: d.label, value: running }; });
};
