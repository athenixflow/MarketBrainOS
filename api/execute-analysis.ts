import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION & HELPERS ---

const getAIClient = () => {
  // Get API key from environment variables
  const key = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.Google_api;
  if (!key) {
    console.error("CRITICAL: API Key not found in environment variables (VITE_GEMINI_API_KEY, API_KEY, or Google_api).");
    return null;
  }
  
  // Get project ID from environment variables
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  
  if (projectId) {
    console.log("Using API key with project ID:", projectId);
    return new GoogleGenerativeAI(key);
  } else {
    console.warn("No project ID found, using API key only (may cause authentication issues)");
    return new GoogleGenerativeAI(key);
  }
};

const cleanJSON = (text: string) => {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
};

const safeStr = (val: any): string => (typeof val === 'string' ? val.trim() : '');
const safeNum = (val: any): number => (typeof val === 'number' && !isNaN(val) ? val : 0);
const safeArray = (arr: any): any[] => (Array.isArray(arr) ? arr : []);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- NORMALIZERS ---

const normalizeAngleMinerResponse = (raw: any) => {
  const cleanAngle = (item: any) => {
    if (!item) return null;
    const hook = safeStr(item.hook || item.angle || item.text);
    if (!hook) return null;
    return { 
      title: safeStr(item.title) || 'Insight',
      hook,
      rational: safeStr(item.rational || item.reason) || 'AI Analysis',
      score: safeNum(item.score) || 80,
      improved: safeStr(item.improved),
      improving: !!item.improving
    };
  };

  const prime = safeArray(raw?.prime).map(cleanAngle).filter((x: any) => x !== null);
  const supporting = safeArray(raw?.supporting).map(cleanAngle).filter((x: any) => x !== null);
  const exploratory = safeArray(raw?.exploratory).map(cleanAngle).filter((x: any) => x !== null);
  const hooks = safeArray(raw?.hooks).map((h: any) => ({
    platform: safeStr(h?.platform) || 'General',
    short: safeStr(h?.short || h?.hook),
    expanded: safeStr(h?.expanded || h?.description)
  })).filter((h: any) => h.short);

  return { prime, supporting, exploratory, hooks };
};

const normalizeTestLabResponse = (raw: any) => {
  const variants = safeArray(raw?.variants).map((v: any) => ({
    label: safeStr(v.label) || 'Variant',
    text: safeStr(v.text || v.content || v.copy) || 'No text',
    score: safeNum(v.score)
  })).filter((v: any) => v.text !== 'No text');

  let winnerLabel = safeStr(raw?.winnerLabel || raw?.winner);
  if (variants.length > 0 && !variants.find((v: any) => v.label === winnerLabel)) {
    winnerLabel = variants[0].label;
  }

  return {
    variants,
    winnerLabel: winnerLabel || 'None',
    explanation: safeStr(raw?.explanation || raw?.analysis) || 'Analysis complete.'
  };
};

const normalizeAuditResponse = (raw: any) => {
  const issues = safeArray(raw?.issues).map((i: any) => ({
    blocker: safeStr(i?.blocker || i?.issue),
    impact: safeStr(i?.impact) || 'Medium'
  })).filter((i: any) => i.blocker);

  const fixes = safeArray(raw?.fixes).map((f: any) => ({
    what: safeStr(f?.what || f?.action),
    how: safeStr(f?.how || f?.implementation),
    expectedResult: safeStr(f?.expectedResult || f?.result)
  })).filter((f: any) => f.what);

  const rewrites = safeArray(raw?.rewrites).map((r: any) => ({
    label: safeStr(r?.label),
    text: safeStr(r?.text || r?.content)
  })).filter((r: any) => r.text);

  return {
    score: safeNum(raw?.score),
    summary: safeStr(raw?.summary || raw?.overview) || 'Analysis complete.',
    issues,
    fixes,
    rewrites,
    auditedUrl: safeStr(raw?.auditedUrl) || undefined
  };
};

// --- EXECUTION WITH RETRY ---

async function generateContentWithRetry(model: any, prompt: string, retries = 2) {
  let lastError: any;
  
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`[Gemini] Attempt ${i+1}/${retries+1}...`);
      
      // Explicit 20s timeout per attempt
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request Timed Out (20s limit)")), 20000);
      });
      
      const generationPromise = model.generateContent(prompt);
      const result: any = await Promise.race([generationPromise, timeoutPromise]);
      
      const response = await result.response;
      const text = response.text();
      
      if (!text) throw new Error("Received empty response from Gemini model.");
      return text;
      
    } catch (e: any) {
      console.error(`[Gemini] Attempt ${i + 1} failed:`, e.message);
      lastError = e;
      
      // Stop immediately on fatal auth/config errors
      if (e.message?.includes("API key") || e.message?.includes("403") || e.message?.includes("invalid")) {
        throw new Error(`Auth Error: ${e.message}`);
      }

      if (i < retries) {
        const backoff = 1000 * Math.pow(2, i);
        console.log(`[Gemini] Retrying in ${backoff}ms...`);
        await wait(backoff);
      }
    }
  }
  
  throw lastError || new Error("Gemini analysis failed after multiple retries.");
}

// --- HANDLER ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const ai = getAIClient();
    if (!ai) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Server Configuration Error: Missing API Key." 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const { module, input } = await request.json();
    
    let prompt = "";
    let normalizer = (d: any) => d;

    // --- SETUP MODULE CONFIGS ---

    if (module === 'AngleMiner_Generate') {
      prompt = [
        "Return strictly valid JSON.",
        `Product: ${(input.product || '').slice(0,800)}`,
        `Industry: ${input.industry}`,
        `Target: ${input.target}`,
        "Schema: {prime:[{title,hook,rational,score}],supporting:[{title,hook,rational,score}],exploratory:[{title,hook,rational,score}],hooks:[{platform,short,expanded}]}"
      ].join(" ");
      normalizer = normalizeAngleMinerResponse;
    } 
    else if (module === 'AngleMiner_Improve') {
      prompt = `Refine hook for conversion: "${(input || '').slice(0,300)}"`;
      normalizer = (d: any) => d; 
    }
    else if (module === 'TestLab_Simulation') {
      const variantsSafe = (input.variants || []).join('|').slice(0,1000);
      prompt = [
        "Return strictly valid JSON.",
        `Compare Type: ${input.type}`,
        `Variants: ${variantsSafe}`,
        "Schema: {variants:[{label,text,score}],winnerLabel,explanation}"
      ].join(" ");
      normalizer = normalizeTestLabResponse;
    }
    else if (module === 'ConversionDoctor_Audit') {
      prompt = [
        "Return strictly valid JSON.",
        `Audit Context: ${input.context}`,
        `Content: ${(input.input || '').slice(0,1500)}`,
        "Schema: {score,summary,issues:[{blocker,impact}],fixes:[{what,how,expectedResult}]}"
      ].join(" ");
      normalizer = normalizeAuditResponse;
    }
    else if (module === 'Workflow_ImproveAssets') {
      const issuesSafe = (input.issues || []).join('|').slice(0,500);
      prompt = [
        "Return strictly valid JSON.",
        `Refine Angle: "${(input.angle || '').slice(0,300)}"`,
        `Issues to fix: ${issuesSafe}`,
        "Schema: {headline,cta,offer}"
      ].join(" ");

      normalizer = (raw: any) => ({ headline: safeStr(raw?.headline), cta: safeStr(raw?.cta), offer: safeStr(raw?.offer) });
    }
    else {
      return new Response(JSON.stringify({ success: false, error: "Invalid module" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // --- EXECUTION ---

    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { 
        responseMimeType: module === 'AngleMiner_Improve' ? 'text/plain' : 'application/json',
        maxOutputTokens: 2000
      }
    });

    try {
      const text = await generateContentWithRetry(model, prompt, 1); 
      let finalOutput;

      if (module === 'AngleMiner_Improve') {
        finalOutput = text ? text.trim() : "";
        if (!finalOutput) throw new Error("Generated empty text");
      } else {
        const json = cleanJSON(text || '');
        if (!json) throw new Error("Failed to parse JSON response");
        finalOutput = normalizer(json);
      }

      // Explicit SUCCESS status with normalized schema
      return new Response(JSON.stringify({ 
        success: true,
        data: finalOutput
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });

    } catch (err: any) {
      console.error("AI Generation Critical Failure:", err);
      // Return detailed error for debugging purposes in this context
      return new Response(JSON.stringify({ 
        success: false,
        error: "AI Analysis Unavailable",
        meta: { 
          details: err.message,
          code: 'ai_unavailable'
        } 
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

  } catch (error: any) {
    console.error("Unhandled Server Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: "Internal Server Error", 
      meta: { details: error.message } 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
