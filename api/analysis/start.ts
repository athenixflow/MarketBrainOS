import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' };

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Supabase URL or Service Role Key not found in environment variables.');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

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
  if (!supabase) {
    console.error("Database connection missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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

    // 4. FAST PERSISTENCE - Insert into job_queue table
    const { data, error } = await supabase
      .from('job_queue')
      .insert([{
        module,
        input,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      throw new Error(`Database Error: ${error.message}`);
    }

    // 5. RETURN IMMEDIATELY
    return res.status(200).json({
      success: true,
      data: {
        jobId: data.id,
        status: 'pending'
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
