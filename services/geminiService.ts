
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
  if (!user) throw new Error("User must be logged in.");
  
  const token = await user.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // 1. FAST START
  const startRes = await fetch("/api/analysis/start", {
    method: "POST", headers, body: JSON.stringify({ module, input })
  });
  
  if (!startRes.ok) {
     const err = await startRes.json().catch(() => ({}));
     throw new Error(err.error || "Failed to initialize analysis job.");
  }
  
  const startData = await startRes.json();
  const jobId = startData.data?.jobId;
  
  if (!jobId) throw new Error("No Job ID returned from server.");

  // 2. POLLING & EXECUTION LOOP
  let attempts = 0;
  const maxAttempts = 30; // 60s timeout
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Trigger Execution (Non-Blocking fire & forget attempt)
    // We catch errors here because the polling status check is the authority on failure
    fetch("/api/analysis/run", {
      method: "POST", headers, body: JSON.stringify({ jobId })
    }).catch(e => console.warn("Background run trigger failed (safe to ignore):", e));

    // Wait for work to happen
    await wait(2000);

    // Check Status
    const statusRes = await fetch(`/api/analysis/status?jobId=${jobId}`, { headers });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      const job = statusData.data;

      if (job.status === 'completed') {
        if (!job.result) throw new Error("Job completed but returned no result.");
        return job.result;
      }
      
      if (job.status === 'failed') {
        throw new Error(job.error || "Analysis job failed on server.");
      }
    }
  }

  throw new Error("Analysis timed out. Please try again.");
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
