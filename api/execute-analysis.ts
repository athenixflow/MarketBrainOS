
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  runtime: 'edge',
};

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.Google_api || '');

const systemInstruction = `
You are the MarketBrainOS Intelligence Engine.
Core Mission: Provide high-confidence marketing angles, conversion audits, and performance simulations.
`;

// --- HELPERS ---

const cleanJSON = (text: string) => {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Attempt to extract JSON if surrounded by text
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
      } catch (e2) {
        throw new Error("AI Output Malformed: Not valid JSON");
      }
    }
    throw new Error("AI Output Malformed: Not valid JSON");
  }
};

const safeStr = (val: any): string => (typeof val === 'string' ? val.trim() : '');
const safeNum = (val: any): number => (typeof val === 'number' && !isNaN(val) ? val : 0);
const safeArray = (arr: any): any[] => (Array.isArray(arr) ? arr : []);

// --- NORMALIZATION LOGIC ---

const normalizeAngleMinerResponse = (raw: any) => {
  const cleanAngle = (item: any) => {
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

  const prime = safeArray(raw?.prime).map(cleanAngle).filter(x => x !== null);
  const supporting = safeArray(raw?.supporting).map(cleanAngle).filter(x => x !== null);
  const exploratory = safeArray(raw?.exploratory).map(cleanAngle).filter(x => x !== null);
  
  const hooks = safeArray(raw?.hooks).map((h: any) => ({
    platform: safeStr(h?.platform) || 'General',
    short: safeStr(h?.short || h?.hook),
    expanded: safeStr(h?.expanded || h?.description)
  })).filter((h: any) => h.short);

  return { prime, supporting, exploratory, hooks };
};

const normalizeTestLabResponse = (raw: any) => {
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
  }).filter(x => x !== null);

  let winnerLabel = safeStr(raw?.winnerLabel || raw?.winner);
  if (variants.length > 0 && !variants.find((v: any) => v.label === winnerLabel)) {
    const sorted = [...variants].sort((a: any, b: any) => b.score - a.score);
    winnerLabel = sorted[0].label;
  }

  return {
    variants,
    winnerLabel: winnerLabel || (variants[0]?.label || 'None'),
    explanation: safeStr(raw?.explanation || raw?.analysis) || 'No specific explanation provided.'
  };
};

const normalizeAuditResponse = (raw: any) => {
  const issues = safeArray(raw?.issues).map((i: any) => {
    if (typeof i === 'string') return { blocker: i, impact: 'Medium' };
    return {
      blocker: safeStr(i?.blocker || i?.issue),
      impact: safeStr(i?.impact) || 'Medium'
    };
  }).filter((i: any) => i.blocker);

  const fixes = safeArray(raw?.fixes).map((f: any) => {
    if (typeof f === 'string') return { what: f, how: 'Review content', expectedResult: 'Improved clarity' };
    return {
      what: safeStr(f?.what || f?.action),
      how: safeStr(f?.how || f?.implementation),
      expectedResult: safeStr(f?.expectedResult || f?.result)
    };
  }).filter((f: any) => f.what);

  const rewrites = safeArray(raw?.rewrites).map((r: any) => ({
    label: safeStr(r?.label) || 'Rewrite',
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

// --- HANDLER ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { module, input } = await request.json();

    // Select Model - using 1.5-pro for reliability with standard API keys
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro", 
      systemInstruction 
    });

    let responseText = "";
    let finalOutput: any = {};

    // --- EXECUTION LOGIC ---

    if (module === 'AngleMiner_Generate') {
      const prompt = `
        Analyze: Product: ${input.product}, Industry: ${input.industry}, Target: ${input.target}, Goal: ${input.goal}, Tones: ${input.tones?.join(', ')}.
        Return strict JSON: { prime: [{title, hook, rational, score}], supporting: [...], exploratory: [...], hooks: [{platform, short, expanded}] }
      `;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      responseText = result.response.text();
      finalOutput = normalizeAngleMinerResponse(cleanJSON(responseText));
    } 
    else if (module === 'AngleMiner_Improve') {
      const result = await model.generateContent(`Refine this hook for higher conversion: "${input}"`);
      responseText = result.response.text();
      // For string improvement, we return text directly
      finalOutput = responseText.trim();
    }
    else if (module === 'TestLab_Simulation') {
      const prompt = `Compare variants for ${input.type}: ${input.variants?.join(', ')}. Return JSON: { variants: [{label, text, score}], winnerLabel, explanation }`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      responseText = result.response.text();
      finalOutput = normalizeTestLabResponse(cleanJSON(responseText));
    }
    else if (module === 'ConversionDoctor_Audit') {
      const prompt = `Audit ${input.context}: "${input.input}". Return JSON: { score, summary, issues: [{blocker, impact}], fixes: [{what, how, expectedResult}] }`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      responseText = result.response.text();
      finalOutput = normalizeAuditResponse(cleanJSON(responseText));
    }
    else if (module === 'Workflow_ImproveAssets') {
      const prompt = `Refine angle "${input.angle}" based on issues: ${input.issues?.join(', ')}. Return JSON: { headline, cta, offer }`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      responseText = result.response.text();
      const raw = cleanJSON(responseText);
      finalOutput = {
        headline: safeStr(raw?.headline),
        cta: safeStr(raw?.cta),
        offer: safeStr(raw?.offer)
      };
    }
    else {
        throw new Error(`Unknown module: ${module}`);
    }

    // --- SAFETY CHECK ---
    // If output is completely empty/invalid after normalization, throw error
    if (typeof finalOutput === 'object' && finalOutput !== null) {
       // Check keys for AngleMiner
       if (module === 'AngleMiner_Generate' && 
           !finalOutput.prime?.length && 
           !finalOutput.supporting?.length && 
           !finalOutput.exploratory?.length) {
           throw new Error("No usable insights could be extracted.");
       }
    } else if (!finalOutput) {
        throw new Error("Empty response from analysis engine.");
    }

    return new Response(JSON.stringify({ result: finalOutput }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("API Analysis Error:", error);
    return new Response(JSON.stringify({ 
      error: { message: error.message || 'Internal Analysis Error' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
