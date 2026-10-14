import { useCallback, useEffect, useRef, useState } from 'react';
import { auditsApi } from '../api/endpoints.js';
import { isAuditActive } from '../lib/score.js';

const POLL_MS = 2000;
const MAX_STREAM_ERRORS = 3;

/**
 * Load an audit and keep it live while it runs.
 * Live updates come from the Server-Sent Events stream; if that isn't available
 * (old proxy, network trouble) it falls back to polling the status endpoint.
 * Once the audit finishes, the full result is loaded once.
 */
export function useAudit(auditId) {
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null); // 'stream' | 'polling' | null
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
    let source = null;

    const finish = () => {
      setLive(null);
      loadFull(signal).catch((err) => err.name !== 'AbortError' && setError(err));
    };

    const poll = async () => {
      setLive('polling');
      try {
        const { audit: status } = await auditsApi.status(auditId, { signal });
        setAudit((prev) => ({ ...prev, ...status }));
        if (isAuditActive(status)) timer.current = setTimeout(poll, POLL_MS);
        else finish();
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err.status === 0) timer.current = setTimeout(poll, POLL_MS * 3); // offline: keep trying, slower
        else setError(err);
      }
    };

    const stream = () => {
      if (typeof EventSource === 'undefined') return poll();
      let errors = 0;
      source = new EventSource(auditsApi.eventsUrl(auditId), { withCredentials: true });
      setLive('stream');
      source.addEventListener('progress', (event) => {
        errors = 0;
        setAudit((prev) => ({ ...prev, ...JSON.parse(event.data) }));
      });
      source.addEventListener('done', () => {
        source.close();
        finish();
      });
      source.onerror = () => {
        // EventSource reconnects by itself; give up on it only if it keeps failing.
        errors += 1;
        if (source.readyState === EventSource.CLOSED || errors >= MAX_STREAM_ERRORS) {
          source.close();
          poll();
        }
      };
    };

    setLoading(true);
    setError(null);
    loadFull(signal)
      .then((full) => isAuditActive(full) && stream())
      .catch((err) => err.name !== 'AbortError' && setError(err))
      .finally(() => !signal.aborted && setLoading(false));

    return () => {
      controller.abort();
      source?.close();
      clearTimeout(timer.current);
    };
  }, [auditId, loadFull]);

  return { audit, error, loading, live };
}
