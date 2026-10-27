/**
 * Browser side of the admin audit chain (functions/src/audit.ts writes it). The hash is recomputed
 * from the canonical form, so the order Firestore returns fields in does not matter, and entries
 * are walked by sequence number, not by timestamp.
 *
 * Entries written before the chain was fixed (no `chain` field) were hashed in an order that cannot
 * be reproduced from the stored document. They are counted as legacy rather than failing the check.
 */
const GENESIS = '0'.repeat(64);
const CHAIN_VERSION = 2;

/** Must match canonicalJson in functions/src/audit.ts (scripts/audit.test.ts compares them). */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).filter((k) => (value as any)[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`;
};

const sha256 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export interface ChainResult {
  valid: boolean;
  /** Entries checked (chain version 2). */
  verified: number;
  /** Entries from before the fix, not checkable. */
  legacy: number;
  /** Sequence number of the first entry that failed. */
  failedSeq?: number;
}

/**
 * Checks a window of entries (the portal loads the newest ones, so the first loaded entry's parent
 * may not be loaded; every link inside the window is checked, and seq 1 must link to the genesis).
 */
export async function verifyAuditChain(logs: Record<string, any>[]): Promise<ChainResult> {
  const chained = logs.filter((l) => l.chain === CHAIN_VERSION).sort((a, b) => a.seq - b.seq);
  const legacy = logs.length - chained.length;
  for (let i = 0; i < chained.length; i++) {
    const { id, hash, previous_hash, ...content } = chained[i];
    const parent = i > 0 ? chained[i - 1] : null;
    if (parent && chained[i].seq !== parent.seq + 1) return { valid: false, verified: i, legacy, failedSeq: chained[i].seq };
    if (parent && previous_hash !== parent.hash) return { valid: false, verified: i, legacy, failedSeq: chained[i].seq };
    if (!parent && chained[i].seq === 1 && previous_hash !== GENESIS) return { valid: false, verified: i, legacy, failedSeq: 1 };
    if (await sha256(canonicalJson(content) + previous_hash) !== hash) return { valid: false, verified: i, legacy, failedSeq: chained[i].seq };
  }
  return { valid: true, verified: chained.length, legacy };
}
