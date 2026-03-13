import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'f.red.app',
  appName: 'Calculadora', // App Disguise (Phase F)
  webDir: 'out',
  android: {
    backgroundColor: '#0a0c0e',  // Match --bg to prevent white flash on startup
    allowMixedContent: true,     // Allow http API calls from https context
    loggingBehavior: 'none',     // Reduce log spam in production
    webContentsDebuggingEnabled: false,
  },
  server: {
    cleartext: true,             // CRITICAL: Allows HTTP API calls to 127.0.0.1 in Android 9+
    hostname: 'localhost'
  },
  ios: {
    backgroundColor: '#0a0c0e',
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,     // We control the splash manually
      backgroundColor: '#0a0c0e',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
