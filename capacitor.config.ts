import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jackpotroyals.app',
  appName: 'Jackpot Royals',
  webDir: 'capacitor-shell',
  appendUserAgent: ' JackpotRoyalsNative/1.0',
  backgroundColor: '#080a11',
  server: {
    // No remote url at launch — local shell plays splash video first, then opens the live site.
    // This avoids MediaPlayer + remote WebView fighting (which was crashing the app).
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['jackpotroyals.com', '*.jackpotroyals.com'],
    errorPath: 'offline.html'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
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
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
