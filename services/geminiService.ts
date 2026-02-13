
import { auth } from "./firebase";
import { 
  saveAngleMinerResult,
  saveTestLabResult,
  saveConversionDoctorResult,
  saveWorkflowRun
} from "./persistenceService";
import { AngleMinerResults, TestLabResults, AuditResult, MarketingAngle, TestLabVariant } from "../types";

export const MAX_INPUT_CHARS = 12000;

export const getFeatureMetrics = () => {
  return {
    AngleMiner: { circuitState: 'CLOSED', consecutiveFailures: 0 },
    TestLab: { circuitState: 'CLOSED', consecutiveFailures: 0 },
    ConversionDoctor: { circuitState: 'CLOSED', consecutiveFailures: 0 },
    Workflow: { circuitState: 'CLOSED', consecutiveFailures: 0 }
  };
};

export const SystemContracts: Record<string, { 
  inputValidator: (input: any) => void; 
  outputValidator: (output: any) => void; 
}> = {
  AngleMiner: {
    inputValidator: (input: any) => { if (!input) throw new Error("Invalid Input"); },
    outputValidator: (output: any) => { if (!output || !Array.isArray(output.prime)) throw new Error("Invalid Output Schema"); }
  },
  TestLab: {
    inputValidator: (input: any) => { if (!input) throw new Error("Invalid Input"); },
    outputValidator: (output: any) => { if (!output || !Array.isArray(output.variants)) throw new Error("Invalid Output Schema"); }
  },
  ConversionDoctor: {
    inputValidator: (input: any) => { if (!input) throw new Error("Invalid Input"); },
    outputValidator: (output: any) => { if (!output || typeof output.score !== 'number') throw new Error("Invalid Output Schema"); }
  },
  Workflow: {
    inputValidator: (input: any) => { if (!input) throw new Error("Invalid Input"); },
    outputValidator: (output: any) => { if (!output || !output.headline) throw new Error("Invalid Output Schema"); }
  }
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const executeAsyncJob = async (module: string, input: any): Promise<any> => {
  const user = auth.currentUser;
  if (!user) throw new Error("ERR_AUTH_REQUIRED: User must be logged in.");
  
  const token = await user.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // 1. FAST START
  let startRes;
  try {
    startRes = await fetch("/api/analysis/start", {
      method: "POST", 
      headers, 
      body: JSON.stringify({ module, input }),
      signal: AbortSignal.timeout(10000) // 10s timeout for start request
    });
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error("ERR_NETWORK_TIMEOUT: Start request timed out after 10s.");
    }
    throw new Error(`ERR_NETWORK: Failed to start analysis job. ${e.message}`);
  }
  
  if (!startRes.ok) {
     let errorMessage = "ERR_API_START_FAILED: Failed to initialize analysis job.";
     try {
       const err = await startRes.json().catch(() => ({}));
       if (err.error) errorMessage = `ERR_API_START_FAILED: ${err.error}`;
       if (err.meta?.details) errorMessage += ` Details: ${err.meta.details}`;
     } catch (e: any) {
       // Ignore JSON parsing errors
     }
     throw new Error(errorMessage);
  }
  
  let startData;
  try {
    startData = await startRes.json();
  } catch (e) {
    throw new Error("ERR_API_PARSE_FAILED: Failed to parse start response.");
  }
  
  const jobId = startData.data?.jobId;
  
  if (!jobId) throw new Error("ERR_API_NO_JOB_ID: No Job ID returned from server.");

  // 2. POLLING & EXECUTION LOOP
  let attempts = 0;
  const maxAttempts = 30; // 60s timeout
  let lastError = null;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Trigger Execution (Non-Blocking fire & forget attempt)
    // We catch errors here because the polling status check is the authority on failure
    fetch("/api/analysis/run", {
      method: "POST", 
      headers, 
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(5000) // 5s timeout for run request
    }).catch(e => console.warn("Background run trigger failed (safe to ignore):", e));

    // Wait for work to happen
    await wait(2000);

    // Check Status
    let statusRes;
    try {
      statusRes = await fetch(`/api/analysis/status?jobId=${jobId}`, { 
        headers,
        signal: AbortSignal.timeout(10000) // 10s timeout for status request
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        lastError = "ERR_NETWORK_TIMEOUT: Status check timed out after 10s.";
        continue; // Try again
      }
      lastError = `ERR_NETWORK: Failed to check status. ${e.message}`;
      continue; // Try again
    }
    
    if (statusRes.ok) {
      let statusData;
      try {
        statusData = await statusRes.json();
      } catch (e: any) {
        lastError = "ERR_API_PARSE_FAILED: Failed to parse status response.";
        continue; // Try again
      }
      
      const job = statusData.data;

      if (job.status === 'completed') {
        if (!job.result) {
          throw new Error("ERR_API_NO_RESULT: Job completed but returned no result.");
        }
        return job.result;
      }
      
      if (job.status === 'failed') {
        let errorMessage = "ERR_API_JOB_FAILED: Analysis job failed on server.";
        if (job.error) errorMessage = `ERR_API_JOB_FAILED: ${job.error}`;
        if (job.meta?.details) errorMessage += ` Details: ${job.meta.details}`;
        throw new Error(errorMessage);
      }
      
      if (job.status === 'blocked') {
        throw new Error("ERR_API_BLOCKED: Request was blocked by security engine.");
      }
    } else {
      try {
        const errorData = await statusRes.json();
        lastError = `ERR_API_STATUS_FAILED: Status check failed with ${statusRes.status}. ${errorData.error || ''}`;
      } catch (e: any) {
        lastError = `ERR_API_STATUS_FAILED: Status check failed with ${statusRes.status}.`;
      }
    }
  }

  // If we get here, we timed out
  let timeoutMessage = "ERR_TIMEOUT: Analysis timed out after 60s. Please try again.";
  if (lastError) {
    timeoutMessage += ` Last error: ${lastError}`;
  }
  throw new Error(timeoutMessage);
};

export const analyzeMarketingAngle = async (params: any, userId?: string) => {
  SystemContracts.AngleMiner.inputValidator(params);
  const result = await executeAsyncJob('AngleMiner_Generate', params);
  SystemContracts.AngleMiner.outputValidator(result);
  if (userId) await saveAngleMinerResult(userId, params.product, params.industry, params.target, result);
  return result;
};

export const improveAngle = async (text: string, userId?: string) => {
  return await executeAsyncJob('AngleMiner_Improve', text);
};

export const runTestLabComparison = async (type: string, variants: string[], userId?: string) => {
  SystemContracts.TestLab.inputValidator({ type, variants });
  const result = await executeAsyncJob('TestLab_Simulation', { type, variants });
  SystemContracts.TestLab.outputValidator(result);
  if (userId) await saveTestLabResult(userId, type, variants, result);
  return result;
};

export const auditConversion = async (input: string, context: string, userId?: string) => {
  SystemContracts.ConversionDoctor.inputValidator({ input, context });
  const result = await executeAsyncJob('ConversionDoctor_Audit', { input, context });
  SystemContracts.ConversionDoctor.outputValidator(result);
  if (userId) await saveConversionDoctorResult(userId, input, result.score, result);
  return result;
};

export const improveWorkflowAssets = async (angle: string, issues: string[], userId?: string, testScore?: number, auditScore?: number) => {
  const result = await executeAsyncJob('Workflow_ImproveAssets', { angle, issues });
  SystemContracts.Workflow.outputValidator(result);
  if (userId) await saveWorkflowRun(userId, angle, testScore || 0, auditScore || 0, result);
  return result;
};
