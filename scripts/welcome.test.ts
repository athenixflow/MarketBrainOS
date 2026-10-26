// Guards new-signup profiles against the welcome email (found by the e2e launch suite, Oct 2026).
//
// The welcome path used to write users/{uid}.welcome_sent with merge. When it ran before the browser
// created the profile — which on a normal signup it did every time — the document existed with only
// that flag, the browser's create-if-missing did nothing, and the account had no email, no tier and
// no free tokens: a new user who could not run a single tool, invisible in the admin directory.
//
// Runs in `npm run build`. `npm run test:welcome` runs it alone.

const { claimWelcome, releaseWelcome, WELCOME_FLAGS } = await import('../functions/src/email/welcome');
const { DEFAULT_PRICING_CONFIG } = await import('../config/pricingConfig');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* In-memory Firestore with the Admin SDK's create() semantics (ALREADY_EXISTS = code 6). */
const fakeDb = () => {
  const store = new Map<string, Record<string, any>>();
  const ref = (path: string) => ({
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    create: async (d: Record<string, any>) => {
      if (store.has(path)) throw Object.assign(new Error('6 ALREADY_EXISTS: Document already exists'), { code: 6 });
      store.set(path, { ...d });
    },
    delete: async () => { store.delete(path); },
  });
  return { store, collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }) };
};

/* The browser's profile create (services/persistenceService.ts ensureUserProfile), reduced to the
   decision that matters: it only writes when the document does not exist yet. */
const browserCreatesProfile = (db: ReturnType<typeof fakeDb>, uid: string) => {
  if (db.store.has(`users/${uid}`)) return false;
  db.store.set(`users/${uid}`, { email: 'new@example.com', tier: 'free', role: 'user', tokens: DEFAULT_PRICING_CONFIG.plans.free.monthlyTokens });
  return true;
};

// 1. The real-world ordering: the welcome runs BEFORE the browser creates the profile.
{
  const db = fakeDb();
  ok(await claimWelcome(db, 'u1'), 'first welcome claim succeeds');
  ok(!db.store.has('users/u1'), 'claiming the welcome does not create users/{uid}',
    `users/u1 = ${JSON.stringify(db.store.get('users/u1'))}`);
  ok(browserCreatesProfile(db, 'u1'), 'the browser can still create the full profile afterwards');
  const p = db.store.get('users/u1') || {};
  ok(p.tier === 'free' && typeof p.tokens === 'number' && !!p.email, 'the profile has email, tier and tokens');
  ok(db.store.has(`${WELCOME_FLAGS}/u1`), `the flag lives in ${WELCOME_FLAGS}/{uid}`);
}

// 2. Once only, even with the auth trigger and the callable both firing.
{
  const db = fakeDb();
  const results = await Promise.all([claimWelcome(db, 'u2'), claimWelcome(db, 'u2')]);
  ok(results.filter(Boolean).length === 1, 'two racing claims: exactly one wins', JSON.stringify(results));
  ok(!(await claimWelcome(db, 'u2')), 'a later claim is refused');
}

// 3. Accounts welcomed before the flag moved are not welcomed twice.
{
  const db = fakeDb();
  db.store.set('users/u3', { email: 'old@example.com', welcome_sent: true });
  ok(!(await claimWelcome(db, 'u3')), 'a profile carrying the old welcome_sent flag is not re-sent');
}

// 4. A failed send gives the claim back so a retry can send.
{
  const db = fakeDb();
  await claimWelcome(db, 'u4');
  await releaseWelcome(db, 'u4');
  ok(await claimWelcome(db, 'u4'), 'after a release the welcome can be claimed again');
}

// 5. The call site: index.ts must not write the welcome flag into the profile any more.
{
  const src = (await import('node:fs')).readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('async function sendWelcomeOnce'), src.indexOf('export const onUserCreated'));
  ok(fn.length > 0 && !/collection\('users'\)/.test(fn), 'sendWelcomeOnce does not touch users/{uid}');
  ok(/claimWelcome\(/.test(fn), 'sendWelcomeOnce claims through claimWelcome');
}

console.log(failures ? `\n${failures} welcome check(s) FAILED` : '\nAll welcome checks passed');
process.exit(failures ? 1 : 0);
