'use client';

import { useEffect } from 'react';
import {
  canHistoryGoBack,
  installHistoryDepthTracker,
  runNativeBackHandlers,
  tryCloseTopOverlay,
  tryStepUpNestedRoute
} from '../lib/nativeBack';

/**
 * Android system / gesture back for Capacitor (Player + Portal + Distributor).
 * Order: close modal → page handlers → history.back → nested route step-up → exit.
 */
export default function NativeBackButton() {
  useEffect(() => {
    let cancelled = false;
    let removeListener = null;

    const handleBack = async () => {
      if (tryCloseTopOverlay()) return;
      if (runNativeBackHandlers()) return;

      if (canHistoryGoBack()) {
        window.history.back();
        return;
      }

      // Cold deep-link / refresh on a nested screen — go to app home first.
      if (tryStepUpNestedRoute()) return;

      try {
        const { App } = await import('@capacitor/app');
        await App.exitApp();
      } catch {
        // Browser or plugin missing — nothing else to do.
      }
    };

    installHistoryDepthTracker();

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;

        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', () => {
          handleBack();
        });
        removeListener = () => {
          handle?.remove?.();
        };
      } catch {
        // Not Capacitor.
      }
    };

    setup();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  return null;
}
