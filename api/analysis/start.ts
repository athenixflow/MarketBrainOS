
import { db, jsonResponse, errorResponse } from '../utils';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  if (request.method !== 'POST') return errorResponse('Method Not Allowed', 'method_not_allowed', 405);

  try {
    const { module, input } = await request.json();

    if (!module || !input) return errorResponse('Missing module or input', 'invalid_request', 400);

    // Create Job
    const jobRef = await addDoc(collection(db, 'analysis_jobs'), {
      module,
      input,
      status: 'queued',
      progress: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    return jsonResponse({
      success: true,
      data: {
        jobId: jobRef.id,
        status: 'queued'
      }
    });

  } catch (error: any) {
    return errorResponse(error.message || 'Failed to start analysis', 'start_failed');
  }
}
