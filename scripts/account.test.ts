/**
 * Account rules that must agree across screens.
 *   npx tsx scripts/account.test.ts
 *
 * PASSWORDS: sign-up, the Settings change and the email reset each had their own length check (none,
 * 6 and 8), so a password Settings accepted was one the reset page refused. All three now read
 * config/auth.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASSWORD_MIN, passwordProblem } from '../config/auth';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
let failed = 0;
const ok = (cond: boolean, msg: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failed++;
};

console.log('ONE PASSWORD RULE:');
ok(PASSWORD_MIN === 8, 'the minimum is 8 characters');
ok(passwordProblem('1234567') !== null && passwordProblem('12345678') === null, 'passwordProblem refuses 7 and accepts 8');
const CHOOSERS = ['pages/Auth.tsx', 'pages/Settings.tsx', 'pages/AuthAction.tsx'];
for (const f of CHOOSERS) {
  const text = read(f);
  ok(/\bpasswordProblem\(/.test(text), `${f} checks a new password with passwordProblem`);
  /* `.length > 0` is "is it filled in", not a length rule. */
  const literal = text.match(/\.length\s*(<|<=|>=|>)\s*\d+[^\n]*/g)?.filter((l) => /pwd|password/i.test(l) && !/^\.length\s*>\s*0\b/.test(l)) ?? [];
  ok(literal.length === 0, `${f} has no length rule of its own`, literal.join(' | '));
  const said = text.match(/At least \d+ characters/g) ?? [];
  ok(said.every((s) => s === `At least ${PASSWORD_MIN} characters`) && !/At least 6 characters/.test(text), `${f} never tells the user a different minimum`, said.join(', '));
}
const signup = read('pages/Auth.tsx');
ok(/mode === 'signup'[\s\S]{0,200}passwordProblem\(password\)/.test(signup), 'sign-up refuses a short password before creating the account');
ok(!/mode === 'signin'[^\n]*passwordProblem/.test(signup), 'sign-in does not check the length (older accounts keep working)');

/*
 * INVITATIONS NEED A VERIFIED EMAIL, AND THE PAGES SAY SO. The rules only let a verified address
 * read its invitations, so an unverified invitee saw an empty Team/Agency/Enterprise page with no
 * reason, and the verify link only ever came once, in the welcome email.
 */
console.log('\nUNVERIFIED INVITEES ARE TOLD WHY, AND CAN GET A NEW LINK:');
for (const f of ['pages/TeamWorkspace.tsx', 'pages/AgencyHub.tsx', 'pages/EnterpriseSuite.tsx']) {
  ok(/<VerifyEmailNotice onVerified=\{/.test(read(f)), `${f} shows the verify-email notice (which re-loads invitations once verified)`);
}
const notice = read('components/VerifyEmailNotice.tsx');
ok(/user\.emailVerified\) return null/.test(notice) && /callResendVerification\(/.test(notice) && /getIdToken\(true\)/.test(notice),
  'the notice hides once verified, resends the link, and refreshes the token after "I\'ve verified"');
const fnIndex = read('functions/src/index.ts');
const resend = fnIndex.slice(fnIndex.indexOf('export const resendVerification'), fnIndex.indexOf('export const resendVerification') + 1200);
ok(/underLimit\('verify_email'/.test(resend) && /sendTemplate\(email, 'verifyEmail'/.test(resend), 'resendVerification is rate-limited and sends the verify template');

/*
 * SIGNING IN RETURNS YOU TO THE PAGE YOU ASKED FOR. Every guard sent a signed-out visitor to a bare
 * /auth and every sign-in path went to `/`, so a link to /billing or a tool landed on the dashboard.
 * The guards now pass ?next=, and only a path on this site is honoured (no open redirect).
 */
console.log('\nSIGNING IN RETURNS YOU TO THE PAGE YOU ASKED FOR:');
const { safeNext } = await import('../config/auth');
ok(safeNext('/billing') === '/billing' && safeNext('/conversion-doctor?x=1#a') === '/conversion-doctor?x=1#a', 'safeNext keeps an app path with its query');
ok([null, '', 'billing', '//evil.example', '/\\evil.example', 'https://evil.example/x', 'javascript:alert(1)', '/auth', '/auth?next=/x']
  .every((v) => safeNext(v as any) === null), 'safeNext refuses other sites, protocol-relative and scheme URLs, and /auth itself');
/* Parser differentials: the raw string starts with one slash, but URL normalisation turns it into
   "//host" or reaches /auth. The returned value is checked, not just the input. */
ok(['/.//evil.example', '/x/..//evil.example', '/%2F/evil.example', '/./auth', '/x/../auth?next=/y', '/\tevil', '/a\\b']
  .every((v) => { const r = safeNext(v); return r === null || (!r.startsWith('//') && !/^\/auth\b/.test(r)); }), 'normalised forms cannot become //host or /auth');
const app = read('App.tsx');
ok(!/<Navigate to="\/auth"/.test(app) && /<SignInFirst \/>/.test(app), 'App.tsx guards send signed-out visitors through SignInFirst (?next=), never a bare /auth');
const auth = read('pages/Auth.tsx');
ok(!/navigate\('\/'\)/.test(auth) && /safeNext\(/.test(auth), 'every sign-in path in Auth.tsx goes to safeNext(next), falling back to /');

/* THE GREETING USES THE PERSON'S NAME. It used the email's local part, so a plus-address greeted
   "Welcome back, jane+work". The first name wins; otherwise the local part without its +tag. */
console.log('\nTHE DASHBOARD GREETS PEOPLE BY NAME:');
const { greetingName } = await import('../config/auth');
ok(greetingName({ first_name: 'Ada', email: 'ada+e2e@example.com' }) === 'Ada', 'the first name wins');
ok(greetingName({ first_name: '  ', email: 'jane.doe+work@example.com' }) === 'jane.doe', 'without one, the email local part minus its +tag');
ok(greetingName(null) === 'there' && greetingName({ email: '+x@example.com' }) === 'there', 'nothing usable falls back to "there"');
ok(/greetingName\(profile\)/.test(read('pages/Dashboard.tsx')), 'the dashboard greeting uses greetingName');

console.log(failed ? `\nFAILED — ${failed} assertion(s).` : '\nPASS — account rules agree across screens.');
process.exit(failed ? 1 : 0);
