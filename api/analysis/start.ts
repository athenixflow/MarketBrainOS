import * as admin from 'firebase-admin';

export const config = { runtime: 'nodejs' };

// --- INLINE INITIALIZATION START ---
// We inline this logic to avoid "ERR_MODULE_NOT_FOUND" for local utils during Vercel deployment isolation.

// DEFENSIVE CHECK: Ensure admin.apps exists before accessing .length to prevent crash
const apps = admin.apps || [];

if (!apps.length) {
  try {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (key) {
      // Handle both standard newlines and escaped newlines (common in Vercel/Dotenv)
      const sanitizedKey = key.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(sanitizedKey);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Fallback for environments with Application Default Credentials
      admin.initializeApp(); 
    }
  } catch (error) {
    console.error('CRITICAL: Firebase Admin Initialization Failed inside handler.', error);
  }
}

// Re-check apps length safely
const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
// --- INLINE INITIALIZATION END ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed', meta: { code: 'method_not_allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // CRITICAL CHECK: Ensure DB is connected
  if (!db) {
    console.error("Database connection missing. Check FIREBASE_SERVICE_ACCOUNT_KEY.");
    return new Response(JSON.stringify({ success: false, error: 'Server Configuration Error: Database not connected.', meta: { code: 'config_error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Safe JSON parsing
    const body = await request.json().catch(() => null);

    // DEFENSIVE VALIDATION: Check types before access
    if (!body || typeof body !== 'object') {
       return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body', meta: { code: 'invalid_json' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { module, input } = body;

    // Validate Module
    if (!module || typeof module !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Missing or invalid module identifier', meta: { code: 'invalid_module' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate Input
    if (!input) {
      return new Response(JSON.stringify({ success: false, error: 'Missing input data', meta: { code: 'invalid_input' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. FAST PERSISTENCE
    const jobRef = await db.collection('analysis_jobs').add({
      module,
      input,
      status: 'queued',
      progress: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // 2. RETURN IMMEDIATELY
    return new Response(JSON.stringify({
      success: true,
      data: {
        jobId: jobRef.id,
        status: 'queued'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Analysis Start Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Failed to initialize analysis job', meta: { code: 'init_failed' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}