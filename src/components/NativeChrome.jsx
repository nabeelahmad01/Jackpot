'use client';

import { useEffect } from 'react';

function isPortalApp() {
  if (typeof navigator === 'undefined') return false;
  return /JackpotPortalNative/i.test(navigator.userAgent || '');
}

/**
 * Keep Android/iOS system bars solid so lobby content never shows behind the clock/battery.
 * Portal APK also gets an early admin-native-shell class (player APK is never tagged).
 */
export default function NativeChrome() {
  useEffect(() => {
    let cancelled = false;

    // Portal-only: apply before StatusBar async work so the header doesn't jump.
    if (isPortalApp()) {
      document.documentElement.classList.add('admin-native-shell');
    }

    const configure = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;

        if (isPortalApp()) {
          document.documentElement.classList.add('admin-native-shell');
        }

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
      // Do not remove admin-native-shell here if Portal — AdminDashboard also manages it.
    };
  }, []);

  return null;
}
