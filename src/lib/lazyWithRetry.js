import { lazy } from 'react';

function isChunkLoadError(error) {
  const message = error?.message || String(error || '');
  return (
    error?.name === 'ChunkLoadError' ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  );
}

export function lazyWithRetry(importFn, retries = 2) {
  return lazy(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error;
        if (isChunkLoadError(error) && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          continue;
        }
        if (isChunkLoadError(error)) {
          window.location.reload();
        }
        throw error;
      }
    }
    throw lastError;
  });
}

export function isChunkLoadFailure(error) {
  return isChunkLoadError(error);
}
