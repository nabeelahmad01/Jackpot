'use client';

import { useEffect } from 'react';
import { isChunkLoadFailure } from '../lib/lazyWithRetry';

export default function ClientChunkGuard() {
  useEffect(() => {
    const handleRejection = (event) => {
      if (isChunkLoadFailure(event?.reason)) {
        event.preventDefault();
        window.location.reload();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  return null;
}
