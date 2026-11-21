import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-loading hook: runs `load(signal)` whenever `deps` change.
//   data     last successful result (kept while reloading, so the page doesn't flash)
//   error    ApiError from the last attempt, or null
//   loading  true while a request is in flight
//   reload() runs it again; setData() lets a page replace the data after a save
// Older requests are aborted when a newer one starts, so a slow response for an
// old filter can never overwrite the results for the current one.
export function useApi(load, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const controllerRef = useRef(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadRef.current(controller.signal);
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) return;
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((data) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload: run, setData };
}

// Returns `value` only after it has stopped changing for `ms` (for search boxes).
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
