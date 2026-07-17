'use client';

import { useEffect } from 'react';

/**
 * Keep Android/iOS system bars solid so lobby content never shows behind the clock/battery.
 */
export default function NativeChrome() {
  useEffect(() => {
    let cancelled = false;

    const configure = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;

        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#080a11' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Browser / missing plugin — nothing to do.
      }
    };

    configure();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
