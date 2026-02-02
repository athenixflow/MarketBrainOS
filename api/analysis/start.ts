import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const config = { runtime: 'nodejs' };

// --- INLINE INITIALIZATION START ---
// We inline this logic to avoid "ERR_MODULE_NOT_FOUND" for local utils during Vercel deployment isolation.

if (!getApps().length) {
  try {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (key) {
      // Handle both standard newlines and escaped newlines (common in Vercel/Dotenv)
      const sanitizedKey = key.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(sanitizedKey);
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id, // Explicitly set Project ID for Vercel/Serverless
      });
    } else {
      // Fallback for environments with Application Default Credentials
      initializeApp(); 
    }
  } catch (error) {
    console.error('CRITICAL: Firebase Admin Initialization Failed inside handler.', error);
  }
}

// Re-check apps length safely
const db = getApps().length ? getFirestore() : null;
const serverTimestamp = FieldValue.serverTimestamp;
// --- INLINE INITIALIZATION END ---

export default async function handler(req: any, res: any) {
  // 1. Method Check
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed', 
      meta: { code: 'method_not_allowed' } 
    });
  }

  // 2. Critical DB Check
  if (!db) {
    console.error("Database connection missing. Check FIREBASE_SERVICE_ACCOUNT_KEY.");
    return res.status(500).json({ 
      success: false, 
      error: 'Server Configuration Error: Database not connected.', 
      meta: { code: 'config_error' } 
    });
  }

  try {
    // 3. Body Parsing (Node.js runtime provides parsed body in req.body)
    const body = req.body;

    // DEFENSIVE VALIDATION: Check types before access
    if (!body || typeof body !== 'object') {
       return res.status(400).json({ 
         success: false, 
         error: 'Invalid JSON body', 
         meta: { code: 'invalid_json' } 
       });
    }

    const { module, input } = body;

    // Validate Module
    if (!module || typeof module !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing or invalid module identifier', 
        meta: { code: 'invalid_module' } 
      });
    }

    // Validate Input
    if (!input) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing input data', 
        meta: { code: 'invalid_input' } 
      });
    }

    // 4. FAST PERSISTENCE
    const jobRef = await db.collection('analysis_jobs').add({
      module,
      input,
      status: 'queued',
      progress: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // 5. RETURN IMMEDIATELY
    return res.status(200).json({
      success: true,
      data: {
        jobId: jobRef.id,
        status: 'queued'
      }
    });

  } catch (error: any) {
    console.error("Analysis Start Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to initialize analysis job', 
      meta: { code: 'init_failed' } 
    });
  }
}