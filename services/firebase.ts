import * as firebaseApp from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getAnalytics, setAnalyticsCollectionEnabled, Analytics } from 'firebase/analytics';

const initializeApp = (firebaseApp as any).initializeApp;
const getApps = (firebaseApp as any).getApps;
const getApp = (firebaseApp as any).getApp;
type FirebaseApp = any;

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBDM5em2UN034YAd-ihukHOssL_Jr4AmqU",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "marketbrainosweb.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "marketbrainosweb",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "marketbrainosweb.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "516175764122",
  appId: process.env.FIREBASE_APP_ID || "1:516175764122:web:e165516d5e6fbb3f1b9d23",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-JE1NN5VX00"
};

// Base URL for HTTP (onRequest) Cloud Functions, e.g. `executeAnalysis`.
// Derived from the project config; overridable via env for non-default regions
// or local emulators. (`process.env` is polyfilled to `{}` by vite, so a missing
// override reads as undefined rather than throwing.)
const functionsRegion = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';
export const functionsBaseUrl =
  (process.env.FIREBASE_FUNCTIONS_URL as string | undefined) ||
  `https://${functionsRegion}-${firebaseConfig.projectId}.cloudfunctions.net`;

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let db: Firestore;
let functions: Functions;
let analytics: Analytics | null = null;
let isFirebaseInitialized = false;

try {
  // Initialize or retrieve existing app
  // @ts-ignore
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  
  // Initialize Firestore with ignoreUndefinedProperties so writes never throw when a field is
  // undefined (Firestore rejects undefined by default — e.g. non-scored tools save result.score
  // as undefined). This applies to every client write app-wide. initializeFirestore must run
  // before any getFirestore(); fall back to getFirestore() if it was already started (e.g. HMR),
  // so a double-init doesn't trip the outer mock fallback below.
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app);
  }

  functions = getFunctions(app);

  // Analytics is NOT started here. getAnalytics() loads gtag and fires a page_view on the spot, which
  // is a non-essential cookie set before anyone agreed to it. It starts only via enableAnalytics()
  // below — on load when a stored consent says yes, otherwise from the consent banner.
  isFirebaseInitialized = true;

} catch (error) {
  console.error("Firebase Initialization Failed:", error);
  
  // Create robust mocks to prevent app crash (White Screen of Death)
  const noop = () => {};
  const asyncReject = () => Promise.reject(new Error("Firebase not initialized. Check API configuration."));
  
  // Mock Auth to allow UI to render without crashing
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => { cb(null); return noop; },
    signOut: asyncReject,
    signInWithEmailAndPassword: asyncReject,
    createUserWithEmailAndPassword: asyncReject,
    signInWithPopup: asyncReject,
    updateProfile: asyncReject,
  } as unknown as Auth;

  googleProvider = new GoogleAuthProvider();
  
  // Mock DB
  db = {} as unknown as Firestore;
  
  // Mock Functions
  functions = {} as unknown as Functions;
}

// --- Analytics consent gate ---------------------------------------------------------------------
// The stored choice is the enforcement point: nothing analytics-related runs unless it says yes.
// Key/value are read by scripts/browser-harness.ts too — change both together.
export const CONSENT_STORAGE_KEY = 'mbos_consent';
export const CONSENT_ANALYTICS_YES = 'analytics:yes';
export const CONSENT_ANALYTICS_NO = 'analytics:no';

/** The persisted consent choice, or null when the visitor has not decided (or storage is blocked). */
export const readStoredConsent = (): string | null => {
  try { return localStorage.getItem(CONSENT_STORAGE_KEY); } catch { return null; }
};

/** Start Firebase Analytics (once) and turn collection on. Safe to call repeatedly. */
export const enableAnalytics = (): void => {
  if (!isFirebaseInitialized || typeof window === 'undefined') return;
  try {
    if (!analytics) analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
  } catch (error) {
    // Analytics is optional; an ad-blocker or unsupported environment must never break the app.
    console.warn('Analytics could not be enabled:', error);
  }
};

/** Stop collection. A no-op when analytics was never started (nothing was ever sent). */
export const disableAnalytics = (): void => {
  if (!analytics) return;
  try { setAnalyticsCollectionEnabled(analytics, false); } catch { /* already off */ }
};

// Honour a previous choice on every load; anything other than an explicit yes means stay off.
if (readStoredConsent() === CONSENT_ANALYTICS_YES) enableAnalytics();

export { auth, googleProvider, db, functions, analytics, isFirebaseInitialized };
// functionsBaseUrl is exported at its declaration above.