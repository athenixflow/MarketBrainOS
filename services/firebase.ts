
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBDM5em2UN034YAd-ihukHOssL_Jr4AmqU",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "marketbrainosweb.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "marketbrainosweb",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "marketbrainosweb.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "516175764122",
  appId: process.env.FIREBASE_APP_ID || "1:516175764122:web:e165516d5e6fbb3f1b9d23",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-JE1NN5VX00"
};

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
  db = getFirestore(app);
  functions = getFunctions(app);
  
  // Conditional analytics initialization
  if (typeof window !== 'undefined') {
    // @ts-ignore
    analytics = getAnalytics(app);
  }
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

export { auth, googleProvider, db, functions, analytics, isFirebaseInitialized };
