import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'f.red.app',
  appName: 'RED',
  webDir: 'out',
  android: {
    backgroundColor: '#0b141a',
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#0b141a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
