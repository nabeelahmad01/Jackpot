'use client';

import { useEffect, useRef } from 'react';
import { mutate } from 'swr';

/**
 * Instant admin UI updates via SSE. Polling remains as a safety net.
 *
 * @param {{ enabled?: boolean, distributorId?: string }} [options]
 */
export default function useAdminEvents(options = {}) {
  const { enabled = true, distributorId = '' } = options;
  const distRef = useRef(String(distributorId || '').trim());
  distRef.current = String(distributorId || '').trim();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let es = null;
    let stopped = false;
    let retryTimer = null;
    let retryMs = 1000;

    const refreshFromEvent = (event) => {
      const type = String(event?.type || '');
      if (!type || type === 'ping' || type === 'connected') return;

      const myDist = distRef.current;
      if (myDist) {
        const eventDist = String(event.distributorId || '').trim();
        if (eventDist && eventDist !== myDist) return;
      }

      try {
        if (type === 'coins' || type === 'stats') {
          mutate((key) => typeof key === 'string' && key.includes('/api/coins-notifications'));
        }
        if (type === 'transactions' || type === 'stats') {
          mutate(
            (key) =>
              typeof key === 'string' &&
              key.includes('/api/transactions') &&
              !key.includes('AFFILIATE_COMMISSION')
          );
        }
        if (type === 'requests' || type === 'stats') {
          mutate((key) => typeof key === 'string' && key.includes('/api/account-requests'));
        }
        if (type === 'support') {
          mutate((key) => typeof key === 'string' && key.includes('/api/support'));
        }
        if (type === 'campaigns') {
          mutate((key) => typeof key === 'string' && key.includes('/api/campaign-requests'));
        }
        mutate((key) => typeof key === 'string' && key.includes('/api/admin/stats'));
        if (myDist) {
          mutate((key) => typeof key === 'string' && key.includes('/api/distributors/stats'));
        }
      } catch (err) {
        console.warn('useAdminEvents mutate:', err?.message || err);
      }
    };

    const connect = () => {
      if (stopped) return;
      try {
        es?.close?.();
      } catch {
        /* ignore */
      }

      es = new EventSource('/api/admin/events');

      es.onopen = () => {
        retryMs = 1000;
      };

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          refreshFromEvent(data);
        } catch {
          /* ignore bad frames */
        }
      };

      es.onerror = () => {
        try {
          es?.close?.();
        } catch {
          /* ignore */
        }
        es = null;
        if (stopped) return;
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 1.5, 8000);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        es?.close?.();
      } catch {
        /* ignore */
      }
    };
  }, [enabled]);
}
