'use client';

import { useEffect } from 'react';

function isPortalApp() {
  if (typeof navigator === 'undefined') return false;
  return /JackpotPortalNative/i.test(navigator.userAgent || '');
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
 * Portal: header MUST sit below the status bar. WebView padding is unreliable on
 * Android 14/15, so we always apply a real --admin-sat (never force 0).
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
      const onAdmin =
        window.location.pathname.startsWith('/admin') ||
        document.querySelector('.admin-dashboard-layout');
      const androidNative =
        /Android/i.test(navigator.userAgent || '') &&
        (isPortalApp() || window.Capacitor?.isNativePlatform?.() === true);

      let px = probed;
      // Portal / Android admin: env(safe-area) is often 0 while the status bar
      // still overlays the WebView — force a real offset so the logo is visible.
      if (probed < 1 && androidNative && (isPortalApp() || onAdmin)) {
        px = 40;
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
        // Plugin may settle after first paint — re-apply offset.
        syncAdminSat();
      } catch {
        // Browser / missing plugin — nothing to do.
      }
      syncAdminSat();
    };

    syncAdminSat();
    configure();
    const t1 = window.setTimeout(syncAdminSat, 300);
    const t2 = window.setTimeout(syncAdminSat, 1000);
    const t3 = window.setTimeout(syncAdminSat, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return null;
}
