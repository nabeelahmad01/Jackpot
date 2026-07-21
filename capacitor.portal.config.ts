import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Staff-only native app ("Jackpot Portal").
 * Separate from the player APK (android/ + capacitor.config.ts) — never sync this
 * config into the player android/ folder.
 */
const config: CapacitorConfig = {
  appId: 'com.jackpotroyals.portal',
  appName: 'Jackpot Portal',
  webDir: 'capacitor-shell',
  appendUserAgent: ' JackpotPortalNative/1.2',
  backgroundColor: '#080a11',
  android: {
    path: 'android-portal'
  },
  server: {
    // Staff login lives on /admin (same form for super admin + staff roles).
    url: 'https://jackpotroyals.com/admin',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['jackpotroyals.com', '*.jackpotroyals.com'],
    errorPath: 'offline.html'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#080a11',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      // Immersive/fullscreen splash leaves content under the status bar on Android.
      splashFullScreen: false,
      splashImmersive: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080a11',
      overlaysWebView: false
    }
  }
};

export default config;
