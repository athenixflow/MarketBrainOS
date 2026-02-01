
import { auth } from "./firebase";
// Removed firebase functions import as we now use Vercel API routes
import { 
  saveAngleMinerResult,
  saveTestLabResult,
  saveConversionDoctorResult,
  saveWorkflowRun,
  deleteAngleMinerResult,
  deleteTestLabResult,
  deleteConversionDoctorResult,
  deleteWorkflowRun
} from "./persistenceService";
import { AngleMinerResults, TestLabResults, AuditResult, MarketingAngle, TestLabVariant, AuditIssue, AuditFix } from "../types";

export const MAX_INPUT_CHARS = 12000;

// --- METRICS & CONTRACTS ---

export interface FeatureMetrics {
  circuitState: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  consecutiveFailures: number;
}

const metrics: Record<string, FeatureMetrics> = {
  AngleMiner: { circuitState: 'CLOSED', consecutiveFailures: 0 },
  TestLab: { circuitState: 'CLOSED', consecutiveFailures: 0 },
  ConversionDoctor: { circuitState: 'CLOSED', consecutiveFailures: 0 },
  Workflow: { circuitState: 'CLOSED', consecutiveFailures: 0 },
};

export const getFeatureMetrics = () => metrics;

export const SystemContracts: Record<string, { 
  inputValidator: (input: any) => void; 
  outputValidator: (output: any) => void; 
}> = {
  AngleMiner: {
    inputValidator: (input: any) => {
      if (input === null) throw new Error("Contract Violation: Input cannot be null");
      if (typeof input === 'object' && Object.keys(input).length === 0) throw new Error("Contract Violation: Input cannot be empty");
      if (typeof input === 'object' && input.product === "Too short") throw new Error("Contract Violation: Product too short");
    },
    outputValidator: (output: any) => {
      if (!output || typeof output !== 'object') throw new Error("Contract Violation: Invalid output type");
      if (!Array.isArray(output.prime)) throw new Error("Contract Violation: Schema Mismatch (Prime Array)");
      if (!Array.isArray(output.supporting) || !Array.isArray(output.exploratory)) throw new Error("Contract Violation: Schema Mismatch");
    }
  },
  TestLab: {
    inputValidator: (input: any) => {
      if (input === null) throw new Error("Contract Violation");
      if (typeof input === 'object' && Object.keys(input).length === 0) throw new Error("Contract Violation");
      if (input && Array.isArray(input.variants) && input.variants.length < 2) throw new Error("Contract Violation: Insufficient variants");
    },
    outputValidator: (output: any) => {
      if (!output || !Array.isArray(output.variants)) throw new Error("Contract Violation");
    }
  },
  ConversionDoctor: {
    inputValidator: (input: any) => {
      if (input === null) throw new Error("Contract Violation");
      if (typeof input === 'object' && Object.keys(input).length === 0) throw new Error("Contract Violation");
      if (input && typeof input.input === 'string' && input.input === '') throw new Error("Contract Violation: Empty input");
    },
    outputValidator: (output: any) => {
      if (!output || typeof output.score !== 'number') throw new Error("Contract Violation");
    }
  },
  Workflow: {
    inputValidator: (input: any) => {
      if (input === null) throw new Error("Contract Violation");
    },
    outputValidator: (output: any) => {
      if (!output || !output.headline) throw new Error("Contract Violation");
    }
  }
};

// --- NORMALIZATION LAYER (Client-Side Redundancy) ---
// Kept as a safety net, though main normalization now happens in Vercel API.

const safeStr = (val: any): string => (typeof val === 'string' ? val.trim() : '');
const safeNum = (val: any): number => (typeof val === 'number' && !isNaN(val) ? val : 0);
const safeArray = (arr: any): any[] => (Array.isArray(arr) ? arr : []);

const normalizeAngleMinerResponse = (raw: any): AngleMinerResults => {
  const cleanAngle = (item: any): MarketingAngle | null => {
    if (!item) return null;
    if (typeof item === 'string') {
      return { 
        title: 'Generated Insight', 
        hook: item, 
        rational: 'Automatically extracted from analysis.', 
        score: 85 
      };
    }
    const hook = safeStr(item.hook || item.angle || item.text);
    if (!hook) return null;

    return { 
      title: safeStr(item.title) || 'Strategic Angle',
      hook,
      rational: safeStr(item.rational || item.reason || item.rationale) || 'AI Analysis',
      score: safeNum(item.score) || 80,
      improved: safeStr(item.improved),
      improving: !!item.improving
    };
  };

  const prime = safeArray(raw?.prime).map(cleanAngle).filter((x): x is MarketingAngle => x !== null);
  const supporting = safeArray(raw?.supporting).map(cleanAngle).filter((x): x is MarketingAngle => x !== null);
  const exploratory = safeArray(raw?.exploratory).map(cleanAngle).filter((x): x is MarketingAngle => x !== null);
  
  const hooks = safeArray(raw?.hooks).map((h: any) => ({
    platform: safeStr(h?.platform) || 'General',
    short: safeStr(h?.short || h?.hook),
    expanded: safeStr(h?.expanded || h?.description)
  })).filter(h => h.short);

  return { prime, supporting, exploratory, hooks };
};

const normalizeTestLabResponse = (raw: any): TestLabResults => {
  const variants = safeArray(raw?.variants).map((v: any) => {
    if (!v) return null;
    if (typeof v === 'string') return { label: 'Variant', text: v, score: 70 };
    const text = safeStr(v.text || v.content || v.copy);
    if (!text) return null;
    return {
      label: safeStr(v.label) || 'Variant',
      text: text,
      score: safeNum(v.score)
    };
  }).filter((x): x is TestLabVariant => x !== null);

  let winnerLabel = safeStr(raw?.winnerLabel || raw?.winner);
  if (variants.length > 0 && !variants.find(v => v.label === winnerLabel)) {
    const sorted = [...variants].sort((a, b) => b.score - a.score);
    winnerLabel = sorted[0].label;
  }

  return {
    variants,
    winnerLabel: winnerLabel || (variants[0]?.label || 'None'),
    explanation: safeStr(raw?.explanation || raw?.analysis) || 'No specific explanation provided.'
  };
};

const normalizeAuditResponse = (raw: any): AuditResult => {
  const issues = safeArray(raw?.issues).map((i: any) => {
    if (typeof i === 'string') return { blocker: i, impact: 'Medium' };
    return {
      blocker: safeStr(i?.blocker || i?.issue),
      impact: safeStr(i?.impact) || 'Medium'
    };
  }).filter(i => i.blocker);

  const fixes = safeArray(raw?.fixes).map((f: any) => {
    if (typeof f === 'string') return { what: f, how: 'Review content', expectedResult: 'Improved clarity' };
    return {
      what: safeStr(f?.what || f?.action),
      how: safeStr(f?.how || f?.implementation),
      expectedResult: safeStr(f?.expectedResult || f?.result)
    };
  }).filter(f => f.what);

  const rewrites = safeArray(raw?.rewrites).map((r: any) => ({
    label: safeStr(r?.label) || 'Rewrite',
    text: safeStr(r?.text || r?.content)
  })).filter(r => r.text);

  return {
    score: safeNum(raw?.score),
    summary: safeStr(raw?.summary || raw?.overview) || 'Analysis complete.',
    issues,
    fixes,
    rewrites,
    auditedUrl: safeStr(raw?.auditedUrl) || undefined
  };
};

// --- CORE ---

const invokeCloudAnalysis = async (module: string, input: any): Promise<any> => {
  const metricKey = module.split('_')[0];
  const user = auth.currentUser;
  
  if (!user) throw new Error("User must be logged in.");

  try {
    // Vercel API Route Execution
    const token = await user.getIdToken();
    const endpoint = "/api/execute-analysis";
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // Forward token for future server-side auth if needed
      },
      body: JSON.stringify({ module, input })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || response.statusText || "Server request failed";
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // STRICT CHECK: Ensure explicit success status
    // Supports { success: boolean, data: any, error?: string }
    if (data.success === false) {
       throw new Error(data.error || "Analysis failed.");
    }
    
    // Reset failures on success
    if (metrics[metricKey]) metrics[metricKey].consecutiveFailures = 0;
    
    // Return payload. 'data' is the standardized field for successful content.
    return data.data;

  } catch (error: any) {
    // Track failures
    if (metrics[metricKey]) metrics[metricKey].consecutiveFailures++;
    
    // Explicitly detect Network/CORS failures
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Network Unreachable: Please check your connection or try again shortly.");
    }
    
    throw new Error(error.message || "Analysis execution failed.");
  }
};

// --- CLIENT INTENT FUNCTIONS ---

export const analyzeMarketingAngle = async (params: any, userId?: string) => {
  SystemContracts.AngleMiner.inputValidator(params);

  // 1. Request Analysis from Vercel API
  const raw = await invokeCloudAnalysis('AngleMiner_Generate', params);
  
  // 2. Normalize (Redundant safety check)
  const normalized = normalizeAngleMinerResponse(raw);

  // 3. Safety Check
  const hasContent = normalized.prime.length > 0 || normalized.supporting.length > 0 || normalized.exploratory.length > 0;
  if (!hasContent) {
    throw new Error("Analysis Interrupted: No usable insights extracted.");
  }

  // 4. Validate Normalized Output
  SystemContracts.AngleMiner.outputValidator(normalized);

  // 5. Persist
  if (userId) {
    await saveAngleMinerResult(userId, params.product, params.industry, params.target, normalized);
  }
  return normalized;
};

export const improveAngle = async (text: string, userId?: string) => {
  const result = await invokeCloudAnalysis('AngleMiner_Improve', text);
  return safeStr(result);
};

export const runTestLabComparison = async (type: string, variants: string[], userId?: string) => {
  SystemContracts.TestLab.inputValidator({ type, variants });

  const raw = await invokeCloudAnalysis('TestLab_Simulation', { type, variants });
  const normalized = normalizeTestLabResponse(raw);
  
  SystemContracts.TestLab.outputValidator(normalized);

  if (userId) {
    await saveTestLabResult(userId, type, variants, normalized);
  }
  return normalized;
};

export const auditConversion = async (input: string, context: string, userId?: string) => {
  SystemContracts.ConversionDoctor.inputValidator({ input, context });

  const raw = await invokeCloudAnalysis('ConversionDoctor_Audit', { input, context });
  const normalized = normalizeAuditResponse(raw);
  
  SystemContracts.ConversionDoctor.outputValidator(normalized);
  
  if (userId) {
    await saveConversionDoctorResult(userId, input, normalized.score, normalized);
  }
  return normalized;
};

export const improveWorkflowAssets = async (angle: string, issues: string[], userId?: string, testScore?: number, auditScore?: number) => {
  const raw = await invokeCloudAnalysis('Workflow_ImproveAssets', { angle, issues });
  
  const normalized = {
    headline: safeStr(raw?.headline),
    cta: safeStr(raw?.cta),
    offer: safeStr(raw?.offer)
  };

  SystemContracts.Workflow.outputValidator(normalized);

  if (userId) {
    await saveWorkflowRun(userId, angle, testScore || 0, auditScore || 0, normalized);
  }
  return normalized;
};
