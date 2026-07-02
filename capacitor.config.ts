import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jackpotentry.app',
  appName: 'Jackpot Entry',
  webDir: 'out',
  server: {
    // Apni live netlify/vercel website link yahan dalein. 
    // Is se user ke phone par app automatic update ho jayegi jab aap site deploy karenge.
    url: 'https://your-live-netlify-website.netlify.app',
    cleartext: true
  }
};

export default config;
