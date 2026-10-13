import { useCallback, useEffect, useRef, useState } from 'react';
import { auditsApi } from '../api/endpoints.js';
import { isAuditActive } from '../lib/score.js';

const POLL_MS = 2000;

/**
 * Load an audit and, while it's queued/running, poll the lightweight status
 * endpoint; once it finishes, load the full result once.
 * (Phase 3 can switch this to Server-Sent Events without changing callers.)
 */
export function useAudit(auditId) {
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const loadFull = useCallback(
    async (signal) => {
      const { audit: full } = await auditsApi.get(auditId, { signal });
      setAudit(full);
      return full;
    },
    [auditId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const poll = async () => {
      try {
        const { audit: status } = await auditsApi.status(auditId, { signal });
        if (isAuditActive(status)) {
          setAudit((prev) => ({ ...prev, ...status }));
          timer.current = setTimeout(poll, POLL_MS);
        } else {
          await loadFull(signal);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        // Transient network errors: keep polling, but slower.
        if (err.status === 0) timer.current = setTimeout(poll, POLL_MS * 3);
        else setError(err);
      }
    };

    setLoading(true);
    setError(null);
    loadFull(signal)
      .then((full) => {
        if (isAuditActive(full)) timer.current = setTimeout(poll, POLL_MS);
      })
      .catch((err) => err.name !== 'AbortError' && setError(err))
      .finally(() => !signal.aborted && setLoading(false));

    return () => {
      controller.abort();
      clearTimeout(timer.current);
    };
  }, [auditId, loadFull]);

  return { audit, error, loading };
}
