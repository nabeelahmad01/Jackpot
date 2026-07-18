import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jackpotroyals.app',
  appName: 'Jackpot Royals',
  webDir: 'capacitor-shell',
  appendUserAgent: ' JackpotRoyalsNative/1.0',
  backgroundColor: '#080a11',
  server: {
    // Load the live site directly (no splash video).
    url: 'https://jackpotroyals.com/',
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
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080a11',
      overlaysWebView: false
    }
  }
};

export default config;
