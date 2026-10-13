import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async loader on mount (and whenever `deps` change) and track its state.
 * The loader receives an AbortSignal; stale responses are ignored.
 *
 *   const { data, error, loading, reload, setData } = useAsync((signal) => api.get(..., { signal }), [id]);
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const controllerRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loader(controller.signal);
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (!controller.signal.aborted) setState((prev) => ({ ...prev, error, loading: false }));
    }
  }, deps);

  useEffect(() => {
    run();
    return () => controllerRef.current?.abort();
  }, [run]);

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
