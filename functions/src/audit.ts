/**
 * The admin audit chain: each entry carries the hash of the one before it, so an edited or deleted
 * entry breaks every link after it.
 *
 * Two things made the old chain report "Error" forever. It hashed JSON.stringify(entry) in this
 * file's key order, and the browser re-hashed the document Firestore returned, whose fields come
 * back in another order. And it read the last hash outside a transaction, so two admin actions at
 * once could link to the same parent. Entries are now hashed in a canonical form (keys sorted, at
 * every depth) that services/auditChain.ts reproduces, and appended inside a transaction on a head
 * document that holds the last hash and sequence number. scripts/audit.test.ts checks both.
 */
import * as crypto from 'crypto';

export const AUDIT_LOGS = 'admin_audit_logs';
export const AUDIT_HEAD = 'admin_audit_meta/head';
export const GENESIS = '0'.repeat(64);
/** Entries written by this version carry chain: 2; older ones have no `chain` and are legacy. */
export const CHAIN_VERSION = 2;

/** JSON with object keys sorted at every depth and undefined values left out (as Firestore stores them). */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).filter((k) => (value as any)[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`;
};

export const auditHash = (content: Record<string, unknown>, prevHash: string): string =>
  crypto.createHash('sha256').update(canonicalJson(content) + prevHash).digest('hex');

export interface AuditEntry {
  admin_uid: string;
  admin_email: string;
  action_type: string;
  target: string;
  metadata?: unknown;
  timestamp: string;
}

/* The slice of the Admin SDK this needs, so the guard test can pass an in-memory fake. */
interface Ref { path?: string }
interface Tx {
  get(ref: Ref): Promise<{ exists: boolean; data(): Record<string, any> | undefined }>;
  set(ref: Ref, data: Record<string, any>): unknown;
}
export interface AuditDb {
  collection(name: string): { doc(id?: string): Ref };
  runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Appends one entry after the current head, atomically. Returns the entry's sequence number. */
export async function appendAuditEntry(db: AuditDb, entry: AuditEntry): Promise<number> {
  const [headCol, headId] = AUDIT_HEAD.split('/');
  const headRef = db.collection(headCol).doc(headId);
  return db.runTransaction(async (tx) => {
    const head = await tx.get(headRef);
    const prev = head.exists ? head.data()! : {};
    const seq = (Number(prev.seq) || 0) + 1;
    const previous_hash = typeof prev.lastHash === 'string' ? prev.lastHash : GENESIS;
    const content = { ...entry, seq, chain: CHAIN_VERSION };
    const hash = auditHash(content, previous_hash);
    /* Firestore drops undefined with ignoreUndefinedProperties; strip it here too so what is stored
       is exactly what was hashed. */
    tx.set(db.collection(AUDIT_LOGS).doc(), JSON.parse(JSON.stringify({ ...content, hash, previous_hash })));
    tx.set(headRef, { lastHash: hash, seq });
    return seq;
  });
}
