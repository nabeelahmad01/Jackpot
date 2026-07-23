'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function usePollingSWR(key, intervalMs, options = {}) {
  const [visible, setVisible] = useState(true);
  const keepFastWhenHidden = options.refreshWhenHidden === true;

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Background tabs: keep near-live when refreshWhenHidden is set (Portal APK /
  // coins staff alerts). Otherwise only mild slowdown — never 10s+ lag.
  let refreshInterval = 0;
  if (intervalMs > 0) {
    if (visible || keepFastWhenHidden) {
      refreshInterval = intervalMs;
    } else {
      refreshInterval = Math.max(intervalMs * 2, Math.min(4000, intervalMs * 3));
    }
  }

  return useSWR(key, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: intervalMs > 0 ? Math.min(800, Math.floor(intervalMs / 2)) : 5000,
    keepPreviousData: true,
    ...options
  });
}
