import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

// --- CONFIGURATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.Google_api || '' });

const systemInstruction = "You are MarketBrainOS. Output strict JSON only. No markdown. No commentary.";

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

  // Ensure arrays are never empty to match schema requirements
  if (prime.length === 0) prime.push({ 
    title: 'No Data', 
    hook: 'Analysis yielded no prime angles.', 
    rational: 'Try different inputs.', 
    score: 0,
    improved: '',
    improving: false
  });
  
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

// --- TIMEOUT WRAPPER ---

const withTimeout = async (promise: Promise<any>, ms: number, fallback: any) => {
  let timer: any;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __TIMEOUT__: true, ...fallback }), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (e) {
    clearTimeout(timer);
    // On hard error (e.g. API quota), return fallback too to prevent crash
    console.error("AI Execution Error:", e);
    return { __ERROR__: true, ...fallback };
  }
};

// --- HANDLER ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), { status: 405 });
  }

  try {
    const { module, input } = await request.json();
    
    let prompt = "";
    let normalizer = (d: any) => d;
    let fallback: any = {};

    // --- SETUP MODULE CONFIGS ---

    if (module === 'AngleMiner_Generate') {
      prompt = `JSON. Product:${(input.product || '').slice(0,800)}. Ind:${input.industry}. Tgt:${input.target}. Out:{prime:[{title,hook,rational,score}],supporting:[{title,hook,rational,score}],exploratory:[{title,hook,rational,score}],hooks:[{platform,short,expanded}]}`;
      normalizer = normalizeAngleMinerResponse;
      fallback = { prime: [{title:'System Busy',hook:'High traffic. Please retry.',rational:'Timeout',score:0}], supporting:[], exploratory:[], hooks:[] };
    } 
    else if (module === 'AngleMiner_Improve') {
      prompt = `Refine hook for conversion: "${(input || '').slice(0,300)}"`;
      normalizer = (d: any) => d; // Plain text
      fallback = input; // Return original if fail
    }
    else if (module === 'TestLab_Simulation') {
      prompt = `JSON. Compare ${input.type}. Variants:${(input.variants || []).join('|').slice(0,1000)}. Out:{variants:[{label,text,score}],winnerLabel,explanation}`;
      normalizer = normalizeTestLabResponse;
      fallback = { variants: input.variants?.map((v:string, i:number) => ({label:\`Variant \${i+1}\`, text:v, score:0})) || [], winnerLabel:'None', explanation:'System timed out.' };
    }
    else if (module === 'ConversionDoctor_Audit') {
      prompt = `JSON. Audit ${input.context}. Content:${(input.input || '').slice(0,1500)}. Out:{score,summary,issues:[{blocker,impact}],fixes:[{what,how,expectedResult}]}`;
      normalizer = normalizeAuditResponse;
      fallback = { score:0, summary:'Analysis timed out due to high load.', issues:[], fixes:[] };
    }
    else if (module === 'Workflow_ImproveAssets') {
      prompt = `JSON. Refine "${(input.angle || '').slice(0,300)}". Issues:${(input.issues || []).join('|').slice(0,500)}. Out:{headline,cta,offer}`;
      normalizer = (raw: any) => ({ headline: safeStr(raw?.headline), cta: safeStr(raw?.cta), offer: safeStr(raw?.offer) });
      fallback = { headline:'Analysis Timeout', cta:'Retry', offer:'Retry' };
    }
    else {
      return new Response(JSON.stringify({ error: { message: "Invalid module" } }), { status: 400 });
    }

    // --- EXECUTION ---

    const aiPromise = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: module === 'AngleMiner_Improve' ? 'text/plain' : 'application/json',
        maxOutputTokens: 1500
      }
    });

    // 8-second hard timeout
    const resultRaw = await withTimeout(aiPromise, 8000, fallback);

    let finalOutput;
    
    if (resultRaw.__TIMEOUT__ || resultRaw.__ERROR__) {
      finalOutput = module === 'AngleMiner_Improve' ? fallback : normalizer(fallback);
    } else {
      const text = resultRaw.text;
      if (module === 'AngleMiner_Improve') {
        finalOutput = text ? text.trim() : fallback;
      } else {
        const json = cleanJSON(text || '');
        if (!json) {
          finalOutput = normalizer(fallback); // JSON parse failed -> return fallback
        } else {
          finalOutput = normalizer(json);
        }
      }
    }

    return new Response(JSON.stringify({ 
      result: finalOutput, 
      status: resultRaw.__TIMEOUT__ ? 'timeout' : resultRaw.__ERROR__ ? 'error' : 'success' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    // Ultimate safety net
    return new Response(JSON.stringify({ 
      error: { message: "Server busy. Please try again." } 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
