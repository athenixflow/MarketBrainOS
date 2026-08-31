// Firestore rules tests for the ownership-stamp fix (canStampAs).
//
// Runs ENTIRELY against the local emulator - no project reads/writes, nothing billable.
// The emulator host is forced below and initializeTestEnvironment refuses to talk to production,
// so this can never touch the real marketbrainosweb data.
//
//   npx firebase emulators:exec --only firestore "node scripts/rules.test.mjs"
//
// What it proves:
//   1. The vulnerability is closed - a non-member cannot stamp another tenant's container.
//   2. The fix does not lock out legitimate users - real members still write normally.
//   3. Reads are unchanged.

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

const OWNER = 'user_owner';       // member of workspace_A
const OUTSIDER = 'user_outsider'; // member of nothing
const WS = 'workspace_A';
const AGENCY = 'agency_A';
const ENTERPRISE = 'ent_A';

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};

const stamp = (uid, visibility, extra = {}) => ({
  creator_user_id: uid,
  user_id: uid,
  visibility_type: visibility,
  workspace_id: null, agency_id: null, client_id: null, enterprise_id: null,
  module: 'StrategyLab_Analyze',
  result: { summary: 'test' },
  timestamp: new Date().toISOString(),
  ...extra,
});

// RULES_FILE lets us run the suite against the PRE-FIX rules as a negative control: the five attack
// cases must FAIL there, otherwise the tests are not actually detecting the vulnerability.
const RULES_FILE = process.env.RULES_FILE || 'firestore.rules';
const testEnv = await initializeTestEnvironment({
  projectId: 'rules-test-local',
  firestore: { rules: readFileSync(RULES_FILE, 'utf8'), host: '127.0.0.1', port: 8080 },
});

// Seed membership docs using the `${containerId}_${uid}` convention the rules depend on.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'workspace_members', `${WS}_${OWNER}`), { uid: OWNER, container_id: WS, role: 'owner', status: 'active' });
  await setDoc(doc(db, 'agency_members', `${AGENCY}_${OWNER}`), { uid: OWNER, container_id: AGENCY, role: 'agency_owner', status: 'active' });
  await setDoc(doc(db, 'enterprise_members', `${ENTERPRISE}_${OWNER}`), { uid: OWNER, container_id: ENTERPRISE, role: 'enterprise_owner', status: 'active' });
});

const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();

console.log('\nTHE VULNERABILITY (these must all be DENIED):');

await check('outsider cannot stamp an analysis into a workspace they are not in', () =>
  assertFails(setDoc(doc(outsiderDb, 'tool_analysis_results', 'atk1'),
    stamp(OUTSIDER, 'team', { workspace_id: WS }))));

await check('outsider cannot stamp an analysis into an agency they are not in', () =>
  assertFails(setDoc(doc(outsiderDb, 'tool_analysis_results', 'atk2'),
    stamp(OUTSIDER, 'client', { agency_id: AGENCY, client_id: 'client_1' }))));

await check('outsider cannot stamp an analysis into an enterprise they are not in', () =>
  assertFails(setDoc(doc(outsiderDb, 'tool_analysis_results', 'atk3'),
    stamp(OUTSIDER, 'enterprise', { enterprise_id: ENTERPRISE }))));

await check('outsider cannot plant a REPORT in another tenant workspace', () =>
  assertFails(setDoc(doc(outsiderDb, 'reports', 'atk4'),
    { ...stamp(OUTSIDER, 'team', { workspace_id: WS }), title: 'Planted', report_type: 'analysis', content: {}, created_at: new Date().toISOString() })));

await check('outsider cannot plant a REPORT in another tenant enterprise', () =>
  assertFails(setDoc(doc(outsiderDb, 'reports', 'atk5'),
    { ...stamp(OUTSIDER, 'enterprise', { enterprise_id: ENTERPRISE }), title: 'Planted', report_type: 'analysis', content: {}, created_at: new Date().toISOString() })));

console.log('\nNO LOCKOUT (these must all be ALLOWED):');

await check('member writes a team-scoped analysis', () =>
  assertSucceeds(setDoc(doc(ownerDb, 'tool_analysis_results', 'ok1'),
    stamp(OWNER, 'team', { workspace_id: WS }))));

await check('member writes a client-scoped analysis', () =>
  assertSucceeds(setDoc(doc(ownerDb, 'tool_analysis_results', 'ok2'),
    stamp(OWNER, 'client', { agency_id: AGENCY, client_id: 'client_1' }))));

await check('member writes an enterprise-scoped analysis', () =>
  assertSucceeds(setDoc(doc(ownerDb, 'tool_analysis_results', 'ok3'),
    stamp(OWNER, 'enterprise', { enterprise_id: ENTERPRISE }))));

await check('any user writes a PRIVATE analysis (personal scope)', () =>
  assertSucceeds(setDoc(doc(outsiderDb, 'tool_analysis_results', 'ok4'),
    stamp(OUTSIDER, 'private'))));

await check('member saves a team-scoped report (the new Save as report action)', () =>
  assertSucceeds(setDoc(doc(ownerDb, 'reports', 'ok5'),
    { ...stamp(OWNER, 'team', { workspace_id: WS }), title: 'Q3', report_type: 'analysis', content: {}, created_at: new Date().toISOString() })));

await check('any user saves a PRIVATE report', () =>
  assertSucceeds(setDoc(doc(outsiderDb, 'reports', 'ok6'),
    { ...stamp(OUTSIDER, 'private'), title: 'Mine', report_type: 'analysis', content: {}, created_at: new Date().toISOString() })));

console.log('\nREADS UNCHANGED:');

await check('member can read a team-scoped analysis in their workspace', () =>
  assertSucceeds(getDoc(doc(ownerDb, 'tool_analysis_results', 'ok1'))));

await check('outsider cannot read another tenant team-scoped analysis', () =>
  assertFails(getDoc(doc(outsiderDb, 'tool_analysis_results', 'ok1'))));

await testEnv.cleanup();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
