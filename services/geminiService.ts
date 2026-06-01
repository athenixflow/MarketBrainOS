
import { auth, functionsBaseUrl } from "./firebase";
import {
  saveAngleMinerResult,
  saveTestLabResult,
  saveConversionDoctorResult,
  saveWorkflowRun,
  saveGenericAnalysis,
  createNotification
} from "./persistenceService";
import { AngleMinerResults, TestLabResults, AuditResult, MarketingAngle, TestLabVariant, ToolAnalysisResult, Scope } from "../types";

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
    outputValidator: (output: any) => { if (!output || !Array.isArray(output.angles)) throw new Error("Invalid Output Schema"); }
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

// Analysis runs synchronously on the Firebase `executeAnalysis` HTTP function,
// which owns auth, admin/maintenance gating, rate-limiting, token billing
// (deduct + auto-refund on failure), Gemini execution, and audit logging.
// We issue one authenticated POST and surface the server's error message
// verbatim so the UI error-classifiers (rate limit / maintenance / network)
// and "no tokens deducted" messaging keep working.
const ANALYSIS_TIMEOUT_MS = 70000;

const executeAsyncJob = async (module: string, input: any): Promise<any> => {
  const user = auth.currentUser;
  if (!user) throw new Error("ERR_AUTH_REQUIRED: User must be logged in.");

  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(`${functionsBaseUrl}/executeAnalysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ module, input }),
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS)
    });
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error("Network timeout: the analysis took too long to respond. Please check your connection and try again.");
    }
    throw new Error(`Network error: failed to reach the analysis engine. ${e.message || ''}`.trim());
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Analysis failed (HTTP ${res.status}). Received an unreadable response from the analysis engine.`);
  }

  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `Analysis failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }

  if (data.result === undefined || data.result === null) {
    throw new Error("Analysis completed but returned no result.");
  }

  return data.result;
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

// --- GENERIC ANALYSIS TOOLS (PRD §14–22) ---
// All §14–22 tools share the ToolAnalysisResult shape and route through the same
// job pipeline as the existing tools. `module` selects the server-side prompt.
export const runToolAnalysis = async (
  module: string,
  inputs: Record<string, string>,
  userId?: string,
  contextText?: string,
  scope?: Scope
): Promise<ToolAnalysisResult> => {
  if (!inputs || Object.keys(inputs).length === 0) throw new Error("Invalid Input");
  // Connected-ecosystem wiring: a related prior analysis is injected as `_context`,
  // which the server prompt builders treat as background, not raw input.
  const payload = contextText ? { ...inputs, _context: contextText } : inputs;
  const raw = await executeAsyncJob(module, payload);

  // Defensive normalization — server may return a partial/loose shape.
  const result: ToolAnalysisResult = {
    score: typeof raw?.score === 'number' ? raw.score : undefined,
    verdict: typeof raw?.verdict === 'string' ? raw.verdict : undefined,
    summary: typeof raw?.summary === 'string' ? raw.summary : '',
    sections: Array.isArray(raw?.sections)
      ? raw.sections
          .map((s: any) => ({
            title: typeof s?.title === 'string' ? s.title : 'Section',
            items: Array.isArray(s?.items)
              ? s.items.map((i: any) => (typeof i === 'string' ? i : (i?.text || i?.point || ''))).filter(Boolean)
              : []
          }))
          .filter((s: any) => s.items.length > 0)
      : []
  };

  if (!result.summary && result.sections.length === 0) {
    throw new Error("Invalid Output Schema");
  }

  if (userId) {
    const saved = await saveGenericAnalysis(userId, module, inputs, result, scope);
    if (saved && (saved as any).id) result.savedId = (saved as any).id;
    // §39 Analysis notification (best-effort).
    createNotification(userId, 'Analysis', 'Analysis complete', `Your ${module.replace(/_.*/, '')} analysis is ready to view.`);
  }
  return result;
};
