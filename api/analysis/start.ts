
import { db, serverTimestamp, sendJson, sendError } from '../utils';

// Force Node.js runtime for Admin SDK
export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendError(res, 'Method Not Allowed', 'method_not_allowed', 405);

  try {
    const { module, input } = req.body;

    if (!module || !input) {
      return sendError(res, 'Missing module or input', 'invalid_request', 400);
    }

    // 1. FAST PERSISTENCE (Admin SDK)
    const jobRef = await db.collection('analysis_jobs').add({
      module,
      input,
      status: 'queued',
      progress: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // 2. RETURN IMMEDIATELY
    return sendJson(res, {
      success: true,
      data: {
        jobId: jobRef.id,
        status: 'queued'
      }
    });

  } catch (error: any) {
    console.error("Analysis Start Error:", error);
    return sendError(res, error.message || 'Failed to initialize analysis job', 'init_failed');
  }
}
