// Guards the admin audit chain (found by the e2e launch suite, Oct 2026).
//
// The admin portal showed "Chain: Error" permanently. The server hashed JSON.stringify(entry) in its
// own key order; the browser re-hashed the document Firestore returned, whose fields come back in a
// different order, so no entry ever matched. The previous hash was also read outside a transaction,
// so two admin actions at once could both link to the same parent and fork the chain.
//
// Now both sides hash a canonical (sorted-key) form, the server appends inside a transaction on a
// head document, and entries carry a sequence number the verifier walks.
//
// Runs in `npm run build`. `npm run test:audit` runs it alone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const server = await import('../functions/src/audit');
const client = await import('../services/auditChain');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* In-memory Firestore with transactions that run one at a time, which is what Firestore's
   optimistic retry guarantees for two transactions touching the same head document. */
const fakeDb = () => {
  const store = new Map<string, Record<string, any>>();
  let ids = 0;
  let queue = Promise.resolve();
  const ref = (p: string) => ({ path: p });
  return {
    store,
    collection: (c: string) => ({ doc: (id?: string) => ref(`${c}/${id ?? `auto${++ids}`}`) }),
    runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const run = queue.then(() => fn({
        get: async (r: { path: string }) => ({ exists: store.has(r.path), data: () => store.get(r.path) }),
        set: (r: { path: string }, d: Record<string, any>) => { store.set(r.path, JSON.parse(JSON.stringify(d))); },
      }));
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
};

/* What Firestore hands back: the same fields, in another order (here: reversed, nested too). */
const reorder = (v: any): any => Array.isArray(v) ? v.map(reorder)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v;
const entry = (n: number) => ({
  admin_uid: 'adm1', admin_email: 'ops@example.com', action_type: 'ADJUST_TOKENS', target: `user${n}`,
  metadata: { amount: n * 10, reason: 'support', nested: { b: 2, a: 1 } }, timestamp: `2026-10-27T10:00:0${n}.000Z`,
});
const docs = (db: ReturnType<typeof fakeDb>): Record<string, any>[] => [...db.store.entries()]
  .filter(([p]) => p.startsWith(`${server.AUDIT_LOGS}/`)).map(([p, d]) => ({ id: p.split('/')[1], ...d }));

// 0. The bug, reproduced: an insertion-order hash does not survive Firestore's reordering.
{
  const e = entry(1);
  const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  ok(h(JSON.stringify(e)) !== h(JSON.stringify(reorder(e))), 'CONTROL: the old JSON.stringify hash changes when the fields come back reordered');
}

// 1. Canonical form is the same on both sides and ignores key order.
{
  const e = entry(2);
  ok(server.canonicalJson(e) === server.canonicalJson(reorder(e)), 'server canonical form ignores key order (nested included)');
  ok(client.canonicalJson(e) === server.canonicalJson(e), 'client and server produce the same canonical string');
  ok(server.canonicalJson({ a: 1, b: undefined }) === '{"a":1}', 'undefined fields are left out (Firestore drops them too)');
}

// 2. Entries the server writes verify in the browser, even reordered.
{
  const db = fakeDb();
  for (let i = 1; i <= 3; i++) await server.appendAuditEntry(db as any, entry(i));
  const read = docs(db).map(reorder);
  const res = await client.verifyAuditChain(read);
  ok(res.valid && res.verified === 3 && res.legacy === 0, 'three server-written entries verify after reordering', JSON.stringify(res));
  const tampered = read.map((d) => d.seq === 2 ? { ...d, metadata: { ...d.metadata, amount: 9999 } } : d);
  const bad = await client.verifyAuditChain(tampered);
  ok(!bad.valid && bad.failedSeq === 2, 'an edited entry is caught at its sequence number', JSON.stringify(bad));
  const gap = await client.verifyAuditChain(read.filter((d) => d.seq !== 2));
  ok(!gap.valid, 'a deleted entry is caught (the next one no longer links)', JSON.stringify(gap));
}

// 3. Two admin actions at once do not fork the chain.
{
  const db = fakeDb();
  await Promise.all([server.appendAuditEntry(db as any, entry(1)), server.appendAuditEntry(db as any, entry(2))]);
  const d = docs(db).sort((a, b) => a.seq - b.seq);
  ok(d.map((x) => x.seq).join(',') === '1,2', 'concurrent writes get consecutive sequence numbers', d.map((x) => x.seq).join(','));
  ok(d[1]?.previous_hash === d[0]?.hash, 'the second links to the first');
  ok(db.store.get(`${server.AUDIT_HEAD}`)?.seq === 2, 'the head document records the last entry');
}

// 4. Entries from before this change are reported as legacy, not as a broken chain.
{
  const db = fakeDb();
  await server.appendAuditEntry(db as any, entry(5));
  const legacy = { id: 'old1', ...entry(1), hash: 'f'.repeat(64), previous_hash: '0'.repeat(64) };
  const res = await client.verifyAuditChain([legacy, ...docs(db)]);
  ok(res.valid && res.legacy === 1 && res.verified === 1, 'a pre-change entry is counted as legacy and does not fail the check', JSON.stringify(res));
}

// 5. The real writer and the real check use these modules.
{
  const index = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
  const body = index.slice(index.indexOf('const logAdminAudit'), index.indexOf('const logAdminAudit') + 600);
  ok(/appendAuditEntry\(db,/.test(body) && !/orderBy\('timestamp', 'desc'\)\.limit\(1\)/.test(body), 'logAdminAudit appends through appendAuditEntry (no unlocked read of the last hash)');
  const engine = fs.readFileSync(path.join(root, 'services', 'securityEngine.ts'), 'utf8');
  ok(/verifyAuditChain\(/.test(engine) && !/JSON\.stringify\(contentObj\)/.test(engine), 'the browser check uses verifyAuditChain, not an insertion-order JSON.stringify');
}

console.log(failures ? `\nFAILED — ${failures} assertion(s).` : '\nPASS — admin audit entries verify where they are read, and cannot fork.');
process.exit(failures ? 1 : 0);
