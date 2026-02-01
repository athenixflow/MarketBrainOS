
import { db, sendJson, sendError } from '../utils';

export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendError(res, 'Method Not Allowed', 'method_not_allowed', 405);

  if (!db) {
    return sendError(res, 'Server Configuration Error: Database not connected.', 'config_error', 500);
  }

  try {
    const { jobId } = req.query;

    if (!jobId) return sendError(res, 'Missing Job ID', 'invalid_request', 400);

    const jobRef = db.collection('analysis_jobs').doc(jobId as string);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) return sendError(res, 'Job not found', 'not_found', 404);

    const data = jobSnap.data()!;

    return sendJson(res, {
      success: true,
      data: {
        status: data.status,
        progress: data.progress || 0,
        result: data.result || null,
        error: data.error || null
      }
    });

  } catch (error: any) {
    return sendError(res, error.message, 'status_check_failed');
  }
}
