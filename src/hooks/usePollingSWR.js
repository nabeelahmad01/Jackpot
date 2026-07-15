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

  return useSWR(key, fetcher, {
    refreshInterval: visible && intervalMs > 0 ? intervalMs : 0,
    revalidateOnFocus: true,
    dedupingInterval: intervalMs > 0 ? Math.min(2000, Math.floor(intervalMs / 2)) : 5000,
    ...options
  });
}
