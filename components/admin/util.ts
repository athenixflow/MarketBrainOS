// Small shared helpers for the admin sections.

// Normalize the various timestamp shapes in the data (Firestore Timestamp with toMillis(),
// ISO string, epoch millis, or a {seconds} object) to epoch millis. Returns 0 when unknown.
export const tsToMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = new Date(v).getTime(); return isNaN(t) ? 0 : t; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

export const fmtDate = (v: any): string => {
  const t = tsToMillis(v);
  return t ? new Date(t).toLocaleDateString() : '—';
};

export const fmtDateTime = (v: any): string => {
  const t = tsToMillis(v);
  return t ? new Date(t).toLocaleString() : '—';
};

export const money = (n: number): string =>
  `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
