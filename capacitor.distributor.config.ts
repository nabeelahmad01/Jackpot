import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Distributor-only native app ("Jackpot Distributor").
 * Separate from the player APK (android/) and staff Portal APK (android-portal/).
 * Never sync this config into those folders.
 */
const config: CapacitorConfig = {
  appId: 'com.jackpotroyals.distributor',
  appName: 'Jackpot Distributor',
  webDir: 'capacitor-shell',
  appendUserAgent: ' JackpotDistributorNative/1.0',
  backgroundColor: '#080a11',
  android: {
    path: 'android-distributor'
  },
  server: {
    // Distributor login + dashboard.
    url: 'https://jackpotroyals.com/distributor',
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
