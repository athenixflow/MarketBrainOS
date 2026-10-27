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

console.log(failed ? `\nFAILED — ${failed} assertion(s).` : '\nPASS — account rules agree across screens.');
process.exit(failed ? 1 : 0);
