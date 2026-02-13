// --- CONFIGURATION & HELPERS ---

const getGeminiApiKey = () => {
  const key = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.Google_api;
  if (!key) {
    console.error("CRITICAL: API Key not found in environment variables (VITE_GEMINI_API_KEY, API_KEY, or Google_api).");
    return null;
  }
  console.log("Using API key for direct Gemini API calls");
  return key;
};

// Helper function to make direct HTTP requests to Gemini API
const callGeminiAPI = async (apiKey: string, prompt: string, model: string = 'gemini-2.5-flash') => {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2000
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract the generated text from the response
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    return data.candidates[0].content.parts[0].text;
  }
  
  throw new Error('No content returned from Gemini API');
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


// --- HANDLER ---

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Server Configuration Error: Missing API Key." 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const { module, input } = await request.json();
    
    let prompt = "";
    let normalizer = (d: any) => d;
    let responseMimeType = "application/json";

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
      responseMimeType = "text/plain";
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

    // --- EXECUTION WITH RETRY ---
    let lastError: any;
    let finalOutput: any;
    const maxRetries = 2;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        console.log(`[Gemini] Attempt ${i+1}/${maxRetries+1}...`);
        
        // Make direct API call to Gemini
        const text = await callGeminiAPI(apiKey, prompt, 'gemini-2.5-flash');
        
        if (!text) throw new Error("Received empty response from Gemini API.");
        
        if (module === 'AngleMiner_Improve') {
          finalOutput = text ? text.trim() : "";
          if (!finalOutput) throw new Error("Generated empty text");
        } else {
          const json = cleanJSON(text || '');
          if (!json) throw new Error("Failed to parse JSON response");
          finalOutput = normalizer(json);
        }
        
        // Success - break out of retry loop
        break;
        
      } catch (e: any) {
        console.error(`[Gemini] Attempt ${i + 1} failed:`, e.message);
        lastError = e;
        
        // Stop immediately on fatal auth/config errors
        if (e.message?.includes("API key") || e.message?.includes("403") || e.message?.includes("invalid")) {
          throw new Error(`Auth Error: ${e.message}`);
        }

        if (i < maxRetries) {
          const backoff = 1000 * Math.pow(2, i);
          console.log(`[Gemini] Retrying in ${backoff}ms...`);
          await wait(backoff);
        }
      }
    }
    
    if (!finalOutput) {
      throw lastError || new Error("Gemini analysis failed after multiple retries.");
    }

    // Explicit SUCCESS status with normalized schema
    return new Response(JSON.stringify({ 
      success: true,
      data: finalOutput
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

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
