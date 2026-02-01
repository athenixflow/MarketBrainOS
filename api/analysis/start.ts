
import { db, jsonResponse, errorResponse } from '../utils';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  if (request.method !== 'POST') return errorResponse('Method Not Allowed', 'method_not_allowed', 405);

  try {
    const body = await request.json().catch(() => null);
    
    if (!body || !body.module || !body.input) {
      return errorResponse('Missing module or input', 'invalid_request', 400);
    }

    const { module, input } = body;

    // 1. FAST PERSISTENCE ONLY
    // No AI calls. No validation logic. No processing.
    const jobRef = await addDoc(collection(db, 'analysis_jobs'), {
      module,
      input,
      status: 'queued',
      progress: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // 2. RETURN IMMEDIATELY (< 200ms goal)
    return jsonResponse({
      success: true,
      data: {
        jobId: jobRef.id,
        status: 'queued'
      }
    });

  } catch (error: any) {
    console.error("Analysis Start Error:", error);
    return errorResponse(error.message || 'Failed to initialize analysis job', 'init_failed');
  }
}
