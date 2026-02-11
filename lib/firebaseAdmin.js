import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize only if not already initialized
if (!getApps().length) {
  try {
    // Attempt to load service account from env
    const key = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      // Sanitize newlines which might be escaped in Vercel env vars
      const sanitizedKey = key.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(sanitizedKey);
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else {
      // Attempt Application Default Credentials
      initializeApp();
    }
  } catch (error) {
    console.error('Firebase Admin Legacy Init Error:', error);
  }
}

// Export a compatibility object that mimics the old default export
// This allows legacy files like api/users.js to continue working (admin.auth())
// without causing "admin.initializeApp is not a function" errors.
const auth = getApps().length ? getAuth() : { listUsers: async () => ({ users: [] }) };

export default {
  auth: () => auth,
  apps: getApps()
};