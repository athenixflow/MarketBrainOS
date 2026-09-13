// Pure runtime helpers that guard against engine differences. Runs in `npm run build`;
// `npm run test:runtime` runs it alone.

import { timeoutSignal, isTimeoutError } from '../services/timeoutSignal';

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

  console.log(failures === 0 ? '\nPASS — runtime guards behave.' : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
