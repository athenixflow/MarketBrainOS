
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the codebase usage
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Firebase Config - Injected from prompt requirements or env
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || "AIzaSyBDM5em2UN034YAd-ihukHOssL_Jr4AmqU"),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN || "marketbrainosweb.firebaseapp.com"),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID || "marketbrainosweb"),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET || "marketbrainosweb.firebasestorage.app"),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID || "516175764122"),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID || "1:516175764122:web:e165516d5e6fbb3f1b9d23"),
      'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(env.FIREBASE_MEASUREMENT_ID || "G-JE1NN5VX00"),
      // Ensure "process" is defined but do not overwrite NODE_ENV which Vite manages
      'process.env': {}
    },
  };
});
