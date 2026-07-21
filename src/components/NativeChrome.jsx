'use client';

import { useEffect } from 'react';

function isPortalApp() {
  if (typeof navigator === 'undefined') return false;
  return /JackpotPortalNative/i.test(navigator.userAgent || '');
}

function portalNativeVersion() {
  const m = String(navigator.userAgent || '').match(/JackpotPortalNative\/(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function probeSafeAreaTop() {
  if (typeof document === 'undefined') return 0;
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top, 0px);';
  document.documentElement.appendChild(el);
  const h = el.getBoundingClientRect().height || 0;
  el.remove();
  return h;
}

/**
 * Keep Android/iOS system bars solid so content never shows behind the clock/battery.
 * Portal: keep admin header BELOW the status bar (battery/wifi/signal).
 *  - Portal APK 1.1+ pads the WebView natively → --admin-sat: 0
 *  - Older Portal builds get a CSS fallback (~32px) when safe-area reports 0
 */
export default function NativeChrome() {
  useEffect(() => {
    let cancelled = false;

    if (isPortalApp()) {
      document.documentElement.classList.add('admin-native-shell');
    }

    const syncAdminSat = () => {
      if (cancelled) return;
      const probed = probeSafeAreaTop();
      const ver = portalNativeVersion();
      // 1.1+ MainActivity applies real system-bar padding on the WebView.
      const nativeInsetsHandled = ver && (ver.major > 1 || ver.minor >= 1);
      const onAdmin =
        window.location.pathname.startsWith('/admin') ||
        document.querySelector('.admin-dashboard-layout');
      const androidNative =
        /Android/i.test(navigator.userAgent || '') &&
        (isPortalApp() || window.Capacitor?.isNativePlatform?.() === true);

      let px = probed;
      if (nativeInsetsHandled) {
        px = 0;
      } else if (probed < 1 && androidNative && onAdmin) {
        // Legacy Portal / overlay WebView with no CSS safe-area support.
        px = 32;
      }
      document.documentElement.style.setProperty('--admin-sat', `${Math.round(px)}px`);
    };

    const configure = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;

        if (isPortalApp() || window.location.pathname.startsWith('/admin')) {
          document.documentElement.classList.add('admin-native-shell');
        }

        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#080a11' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Browser / missing plugin — nothing to do.
      }
      syncAdminSat();
    };

    syncAdminSat();
    configure();
    const t1 = window.setTimeout(syncAdminSat, 300);
    const t2 = window.setTimeout(syncAdminSat, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}
