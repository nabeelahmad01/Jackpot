'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function usePollingSWR(key, intervalMs, options = {}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Keep a slower poll in background tabs so new requests still surface.
  const refreshInterval =
    intervalMs > 0
      ? (visible ? intervalMs : Math.max(intervalMs * 2, 6000))
      : 0;

  return useSWR(key, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: intervalMs > 0 ? Math.min(1500, Math.floor(intervalMs / 2)) : 5000,
    keepPreviousData: true,
    ...options
  });
}
