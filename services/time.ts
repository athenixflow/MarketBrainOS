// Timestamp coercion for records whose `created_at` may be a Firestore Timestamp (server writes),
// an ISO string (client writes), a number, or missing. Several sort comparators and the ledger
// modals called `.toMillis()` unconditionally, so one string-dated record crashed the whole list.
// Kept DOM-free and Firebase-free so scripts/runtime.test.ts can cover every shape.

export const toMillis = (v: unknown): number => {
  if (v == null) return 0;
  const any = v as any;
  if (typeof any.toMillis === 'function') return any.toMillis();                 // Firestore Timestamp
  if (typeof any.seconds === 'number') return any.seconds * 1000 + Math.floor((any.nanoseconds || 0) / 1e6); // serialized Timestamp
  if (typeof any === 'number') return Number.isFinite(any) ? any : 0;
  if (any instanceof Date) return Number.isNaN(any.getTime()) ? 0 : any.getTime();
  const t = new Date(String(any)).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** A Date for display; epoch when the value is unusable rather than an "Invalid Date". */
export const toDate = (v: unknown): Date => new Date(toMillis(v));
