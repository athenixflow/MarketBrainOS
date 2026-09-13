// AbortSignal.timeout with a fallback for engines that lack it.
//
// services/geminiService.ts called `AbortSignal.timeout(...)` directly. It is absent on Safari < 16
// (iOS 15 and earlier), Chrome < 103 and Firefox < 100, and Vite's esbuild transpiles syntax, not
// runtime APIs, so on those engines building the fetch options threw a TypeError before any request
// was made - every tool reported "Network unreachable". Kept DOM-free so scripts/runtime.test.ts
// can exercise the fallback in Node by deleting the native implementation.

const timeoutReason = (ms: number): Error => {
  // The native implementation aborts with a DOMException named TimeoutError; match it where the
  // constructor exists so callers can branch on one name.
  try {
    if (typeof DOMException === 'function') return new DOMException(`The operation timed out after ${ms}ms.`, 'TimeoutError');
  } catch { /* fall through */ }
  const e = new Error(`The operation timed out after ${ms}ms.`);
  e.name = 'TimeoutError';
  return e;
};

/** Returns a signal that aborts after `ms`, natively where available and via AbortController otherwise. */
export const timeoutSignal = (ms: number): AbortSignal => {
  const native = (AbortSignal as any).timeout;
  if (typeof native === 'function') return native.call(AbortSignal, ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(timeoutReason(ms)), ms);
  return controller.signal;
};

/**
 * True when a fetch rejection came from the signal above. Native timeouts reject with
 * `TimeoutError`; older engines that ignore `abort(reason)` reject with `AbortError`. The old code
 * checked only `AbortError`, so a real timeout on a modern browser fell through to the generic
 * "network error" message and the timeout copy was never shown.
 */
export const isTimeoutError = (e: unknown): boolean => {
  const name = (e as any)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
};
