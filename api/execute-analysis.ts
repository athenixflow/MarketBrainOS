import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: 'edge',
};

// --- CONFIGURATION ---
const ai = new GoogleGenerativeAI(process.env.API_KEY || process.env.Google_api || '');

// --- HELPERS ---

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
      // Explicit 15s timeout per attempt
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 15000);
      });
      
      const generationPromise = model.generateContent(prompt);
      const result: any = await Promise.race([generationPromise, timeoutPromise]);
      
      const response = await result.response;
      const text = response.text();
      
      if (!text) throw new Error("Empty response from model");
      return text;
      
    } catch (e: any) {
      console.warn(`Attempt ${i + 1} failed: ${e.message}`);
      lastError = e;
      
      // Stop on fatal errors (invalid API key, blocked content)
      if (e.message?.includes("API_KEY") || e.message?.includes("blocked")) {
        throw e;
      }

      if (i < retries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms...
        await wait(500 * Math.pow(2, i));
      }
    }
  }
  
  throw lastError || new Error("Analysis failed after retries");
}

// --- HANDLER ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), { status: 405 });
  }

  try {
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
      return new Response(JSON.stringify({ status: 'error', error: { message: "Invalid module" } }), { status: 400 });
    }

    // --- EXECUTION ---

    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { 
        responseMimeType: module === 'AngleMiner_Improve' ? 'text/plain' : 'application/json',
        maxOutputTokens: 1500
      }
    });

    try {
      const text = await generateContentWithRetry(model, prompt, 2); // 2 retries = 3 attempts total
      let finalOutput;

      if (module === 'AngleMiner_Improve') {
        finalOutput = text ? text.trim() : "";
        if (!finalOutput) throw new Error("Generated empty text");
      } else {
        const json = cleanJSON(text || '');
        if (!json) throw new Error("Failed to parse JSON response");
        finalOutput = normalizer(json);
      }

      // Return explicit success status
      return new Response(JSON.stringify({ 
        status: 'success',
        result: finalOutput
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });

    } catch (err: any) {
      console.error("AI Generation Error:", err);
      // Return explicit error status so UI knows to fail
      return new Response(JSON.stringify({ 
        status: 'error',
        error: { 
          message: "System busy or unresponsive. Please try again.",
          details: err.message
        } 
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      status: 'error',
      error: { message: "Server busy. Please try again." } 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
