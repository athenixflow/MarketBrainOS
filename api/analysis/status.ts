import { createClient } from '@supabase/supabase-js';
import { sendJson, sendError } from '../utils';

export const config = { runtime: 'nodejs' };

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Supabase URL or Service Role Key not found in environment variables.');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendError(res, 'Method Not Allowed', 'method_not_allowed', 405);

  if (!supabase) {
    return sendError(res, 'Server Configuration Error: Database not connected.', 'config_error', 500);
  }

  try {
    const { jobId } = req.query;

    if (!jobId) return sendError(res, 'Missing Job ID', 'invalid_request', 400);

    // Get job from job_queue table
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) return sendError(res, 'Job not found', 'not_found', 404);

    return sendJson(res, {
      success: true,
      data: {
        status: job.status,
        progress: 0, // Supabase doesn't track progress, so we return 0
        result: job.result || null,
        error: job.error || null
      }
    });

  } catch (error: any) {
    return sendError(res, error.message, 'status_check_failed');
  }
}
