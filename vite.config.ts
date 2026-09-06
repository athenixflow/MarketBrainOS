import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// TypeScript declarations for import.meta.env
interface ImportMetaEnv {
  readonly Google_api?: string;
  readonly API_KEY?: string;
  readonly FIREBASE_API_KEY?: string;
  readonly FIREBASE_AUTH_DOMAIN?: string;
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_STORAGE_BUCKET?: string;
  readonly FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly FIREBASE_APP_ID?: string;
  readonly FIREBASE_MEASUREMENT_ID?: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    process?: {
      env: NodeJS.ProcessEnv;
    };
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // NOTE: no secret is derived from `env` here on purpose - see the define block below.

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Split heavy vendors into separately-cached chunks (§78). Route code is
          // additionally code-split via React.lazy in App.tsx.
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('@google/generative-ai')) return 'vendor-ai';
            }
          },
        },
      },
    },
    define: {
      // ⚠ SECURITY: everything in this block is INLINED INTO THE PUBLIC JS BUNDLE.
      // Only values that are public by design may appear here.
      //
      // `loadEnv(mode, cwd, '')` above uses an EMPTY prefix, so it loads *every*
      // variable from a root .env - not just VITE_* ones. Combined with an entry
      // here, that silently ships a secret to every visitor. Google_api / API_KEY
      // (the Gemini server key) were previously inlined this way; no frontend code
      // read them, so they are removed rather than left as a loaded gun. The Gemini
      // key is server-only and lives in functions/.env.
      //
      // Firebase Config - public client config, safe to expose (access is enforced
      // by firestore.rules, not by hiding these values).
      // Firebase Config - Injected from prompt requirements or env
      'process.env.FIREBASE_API_KEY': JSON.stringify(process.env.FIREBASE_API_KEY || env.FIREBASE_API_KEY || "AIzaSyBDM5em2UN034YAd-ihukHOssL_Jr4AmqU"),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || "marketbrainosweb.firebaseapp.com"),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(process.env.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || "marketbrainosweb"),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || "marketbrainosweb.firebasestorage.app"),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || "516175764122"),
      'process.env.FIREBASE_APP_ID': JSON.stringify(process.env.FIREBASE_APP_ID || env.FIREBASE_APP_ID || "1:516175764122:web:e165516d5e6fbb3f1b9d23"),
      'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.FIREBASE_MEASUREMENT_ID || env.FIREBASE_MEASUREMENT_ID || "G-JE1NN5VX00"),
      
      // Google Gemini API Key
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      // Ensure "process" is defined but do not overwrite NODE_ENV which Vite manages
      'process.env': {}
    },
  };
});