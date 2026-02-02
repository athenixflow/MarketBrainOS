import { db, serverTimestamp } from '../utils';

export const config = { runtime: 'nodejs' };

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
    const { module, input } = await request.json();

    if (!module || !input) {
      return new Response(JSON.stringify({ success: false, error: 'Missing module or input', meta: { code: 'invalid_request' } }), {
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