'use client';

import { useEffect } from 'react';

/**
 * Keep Android/iOS system bars solid so lobby content never shows behind the clock/battery.
 * Also marks <html> so CSS does NOT double-apply safe-area padding (StatusBar overlay
 * is off — the WebView is already laid out below the system bars).
 */
export default function NativeChrome() {
  useEffect(() => {
    let cancelled = false;

    const configure = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;

        document.documentElement.classList.add('capacitor-native');

        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#080a11' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Browser / missing plugin — nothing to do.
      }
    };

    // UA fallback before the Capacitor bridge finishes loading (Portal + player APKs).
    if (/JackpotRoyalsNative|JackpotPortalNative/i.test(navigator.userAgent || '')) {
      document.documentElement.classList.add('capacitor-native');
    }

    configure();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
