// Guards an analysis run against two things the pages used to get wrong.
//
// 1. "Cancel and retry" only hid the spinner. The request kept running, the server billed it, and
//    setResults() fired when it eventually resolved - a stale result popping in under whatever the
//    user had moved on to. `stopWaiting` now invalidates the run so its result is dropped.
//
// 2. ToolPage is one component instance shared by every generic tool route. Switching tools mid-run
//    reset the form but not the run, so tool A's result landed under tool B's title and B's Delete
//    removed A's record. The same token check drops it.
//
// `inFlight` stays true until the abandoned request actually settles, and the Run buttons honour
// it, so stopping and immediately re-running cannot bill twice. The first run's tokens are spent
// either way - the server did the work - and the pages say so.

import { useCallback, useRef, useState } from 'react';

export const useRunGuard = () => {
  const counter = useRef(0);
  const pending = useRef(0);
  const [inFlight, setInFlight] = useState(false);

  /** Call at the start of a run; keep the token to check against after every await. */
  const start = useCallback((): number => {
    pending.current += 1;
    setInFlight(true);
    return ++counter.current;
  }, []);

  /** Call in `finally`, whether or not the run is still current. */
  const settle = useCallback(() => {
    pending.current = Math.max(0, pending.current - 1);
    if (pending.current === 0) setInFlight(false);
  }, []);

  const isCurrent = useCallback((token: number) => token === counter.current, []);

  /** Drop whatever the outstanding run produces; it still counts as in flight until it settles. */
  const stopWaiting = useCallback(() => { counter.current += 1; }, []);

  return { start, settle, isCurrent, stopWaiting, inFlight };
};

/** Shown under a Run button while an abandoned run is still finishing. */
export const IN_FLIGHT_NOTE = 'Your previous run is still finishing on the server and its tokens are spent. You can start another once it completes.';
