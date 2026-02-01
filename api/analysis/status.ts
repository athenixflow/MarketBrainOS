
import { db, jsonResponse, errorResponse } from '../utils';
import { doc, getDoc } from 'firebase/firestore';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  if (request.method !== 'GET') return errorResponse('Method Not Allowed', 'method_not_allowed', 405);

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) return errorResponse('Missing Job ID', 'invalid_request', 400);

    const jobRef = doc(db, 'analysis_jobs', jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) return errorResponse('Job not found', 'not_found', 404);

    const data = jobSnap.data();

    return jsonResponse({
      success: true,
      data: {
        status: data.status,
        progress: data.progress || 0,
        result: data.result || null,
        error: data.error || null
      }
    });

  } catch (error: any) {
    return errorResponse(error.message, 'status_check_failed');
  }
}
