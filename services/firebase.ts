
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBDM5em2UN034YAd-ihukHOssL_Jr4AmqU",
  authDomain: "marketbrainosweb.firebaseapp.com",
  projectId: "marketbrainosweb",
  storageBucket: "marketbrainosweb.firebasestorage.app",
  messagingSenderId: "516175764122",
  appId: "1:516175764122:web:e165516d5e6fbb3f1b9d23",
  measurementId: "G-JE1NN5VX00"
};

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let db: Firestore;
let analytics: Analytics | null = null;
let isFirebaseInitialized = false;

try {
  // Initialize or retrieve existing app
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  db = getFirestore(app);
  // Conditional analytics initialization
  if (typeof window !== 'undefined') {
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
}

export { auth, googleProvider, db, analytics, isFirebaseInitialized };
