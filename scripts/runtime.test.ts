// Pure runtime helpers that guard against engine differences. Runs in `npm run build`;
// `npm run test:runtime` runs it alone.

import { timeoutSignal, isTimeoutError } from '../services/timeoutSignal';
import { resolveWinner } from '../services/resultItems';
import { toMillis, toDate } from '../services/time';

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const abortsWithin = (signal: AbortSignal, ms: number): Promise<{ aborted: boolean; reason: any; elapsed: number }> =>
  new Promise((resolve) => {
    const start = Date.now();
    const timer = setTimeout(() => resolve({ aborted: false, reason: null, elapsed: Date.now() - start }), ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve({ aborted: true, reason: signal.reason, elapsed: Date.now() - start }); }, { once: true });
  });

const main = async () => {
  // ---- timeoutSignal -------------------------------------------------------------------------
  console.log('TIMEOUT SIGNAL:');
  const nativeTimeout = (AbortSignal as any).timeout;
  ok(typeof nativeTimeout === 'function', 'this Node has native AbortSignal.timeout (so the deletion below is a real test)');

  // Native path.
  {
    const r = await abortsWithin(timeoutSignal(30), 500);
    ok(r.aborted, `native: aborts (${r.elapsed}ms)`);
    ok(isTimeoutError(r.reason), `native: reason is recognised as a timeout (${r.reason?.name})`);
  }

  // Fallback path: what Safari < 16 sees. Delete the native implementation for the duration.
  delete (AbortSignal as any).timeout;
  try {
    ok(typeof (AbortSignal as any).timeout === 'undefined', 'AbortSignal.timeout removed for the fallback test');
    let threw = '';
    let signal: AbortSignal | null = null;
    try { signal = timeoutSignal(30); } catch (e: any) { threw = e.message; }
    ok(!threw && !!signal, 'fallback: creating the signal does not throw', threw);
    if (signal) {
      const r = await abortsWithin(signal, 500);
      ok(r.aborted, `fallback: aborts (${r.elapsed}ms)`);
      ok(isTimeoutError(r.reason), `fallback: reason is recognised as a timeout (${r.reason?.name})`);
    }
    const noAbort = await abortsWithin(timeoutSignal(300), 60);
    ok(!noAbort.aborted, 'fallback: does not abort before its deadline');
  } finally {
    (AbortSignal as any).timeout = nativeTimeout;
  }

  console.log('\nTIMEOUT ERROR DETECTION:');
  ok(isTimeoutError({ name: 'TimeoutError' }), 'TimeoutError (modern engines) is a timeout');
  ok(isTimeoutError({ name: 'AbortError' }), 'AbortError (engines that ignore abort(reason)) is a timeout');
  ok(!isTimeoutError(new TypeError('Failed to fetch')), 'a network failure is not a timeout');
  ok(!isTimeoutError(undefined), 'undefined is not a timeout');

  // ---- resolveWinner ------------------------------------------------------------------------
  console.log('\nWINNER RESOLUTION:');
  const variants = [
    { label: 'Variant A', text: 'a', score: 61 },
    { label: 'Variant B', text: 'b', score: 84 },
    { label: 'Variant C', text: 'c', score: 72 },
  ];
  ok(resolveWinner(variants, 'Variant B')?.label === 'Variant B', 'exact label match');
  ok(resolveWinner(variants, 'B')?.label === 'Variant B', 'model returned "B" for "Variant B" (the documented mismatch)');
  ok(resolveWinner(variants, 'variant b ')?.label === 'Variant B', 'case and whitespace do not matter');
  ok(resolveWinner(variants, 'Variant Z')?.label === 'Variant B', 'unknown label falls back to the highest score');
  ok(resolveWinner(variants, '')?.label === 'Variant B', 'empty label falls back to the highest score');
  ok(resolveWinner(variants, undefined)?.label === 'Variant B', 'missing label falls back to the highest score');
  ok(resolveWinner([], 'A') === null, 'no variants gives null');
  ok(resolveWinner(undefined, 'A') === null, 'undefined variants gives null');
  ok(resolveWinner([{ label: 'Only', text: 'x', score: 0 }], 'nope')?.label === 'Only', 'a single zero-score variant still wins');

  // ---- toMillis ------------------------------------------------------------------------------
  console.log('\nTIMESTAMP COERCION:');
  const iso = '2026-09-13T10:00:00.000Z';
  const ms = Date.parse(iso);
  ok(toMillis({ toMillis: () => ms }) === ms, 'Firestore Timestamp (toMillis)');
  ok(toMillis({ seconds: Math.floor(ms / 1000), nanoseconds: 0 }) === ms, 'serialized Timestamp ({seconds, nanoseconds})');
  ok(toMillis(iso) === ms, 'ISO string');
  ok(toMillis(ms) === ms, 'number passes through');
  ok(toMillis(new Date(ms)) === ms, 'Date instance');
  ok(toMillis(undefined) === 0 && toMillis(null) === 0, 'missing value is epoch, not a crash');
  ok(toMillis('not a date') === 0, 'garbage string is epoch, not NaN');
  ok(!Number.isNaN(toDate('garbage').getTime()), 'toDate never yields an Invalid Date');

  console.log(failures === 0 ? '\nPASS — runtime guards behave.' : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
