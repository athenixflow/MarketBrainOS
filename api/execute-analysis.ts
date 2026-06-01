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

const ANGLE_TYPE_SET = ['Emotional', 'Fear', 'Aspiration', 'Curiosity', 'Authority', 'Differentiation', 'Story', 'Contrarian'];

const normalizeAngleMinerResponse = (raw: any) => {
  const cleanAngle = (item: any) => {
    if (!item) return null;
    const hook = safeStr(item.hook || item.angle || item.text);
    if (!hook) return null;
    const rawType = safeStr(item.type);
    const type = ANGLE_TYPE_SET.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Emotional';
    return {
      type,
      title: safeStr(item.title) || 'Insight',
      hook,
      rational: safeStr(item.rational || item.reason) || 'AI Analysis',
      score: safeNum(item.score) || 80,
      improved: safeStr(item.improved),
      improving: !!item.improving
    };
  };

  // Accept the new flat `angles` shape, or fall back to legacy prime/supporting/exploratory.
  const source = Array.isArray(raw?.angles)
    ? raw.angles
    : [...safeArray(raw?.prime), ...safeArray(raw?.supporting), ...safeArray(raw?.exploratory)];
  const angles = source.map(cleanAngle).filter((x: any) => x !== null);

  const hooks = safeArray(raw?.hooks).map((h: any) => ({
    platform: safeStr(h?.platform) || 'General',
    short: safeStr(h?.short || h?.hook),
    expanded: safeStr(h?.expanded || h?.description)
  })).filter((h: any) => h.short);

  return { angles, hooks };
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


// --- PRD §14–22 GENERIC TOOL PROMPTS ---

interface ToolPromptConfig {
  instruction: string;
  sections: string[];
  scored: boolean;
}

const TOOL_PROMPTS: Record<string, ToolPromptConfig> = {
  'StrategyLab_Analyze': {
    instruction: "Evaluate whether the described idea/initiative is worth pursuing. Assess feasibility, opportunity, risk, competition, and execution difficulty.",
    sections: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats', 'Recommendation'],
    scored: true,
  },
  'OfferAnalyzer_Analyze': {
    instruction: "Assess how compelling this offer is. Evaluate value perception, pricing logic, competitive position, and clarity/appeal.",
    sections: ['Offer Breakdown', 'Improvement Opportunities', 'Pricing Feedback', 'Action Steps'],
    scored: true,
  },
  'AudienceIntel_Analyze': {
    instruction: "Analyze the target audience. Map demographics, psychographics, pain points, desires, objections, and buying motivations.",
    sections: ['Primary Persona', 'Secondary Personas', 'Pain Points', 'Desires & Motivations', 'Opportunity Map'],
    scored: false,
  },
  'MarketIntel_Analyze': {
    instruction: "Analyze the market for opportunities. Cover trends, market size, emerging opportunities, gaps, and threats.",
    sections: ['Market Overview', 'Trend Report', 'Opportunity Report', 'Risk Areas', 'Recommendations'],
    scored: false,
  },
  'Competitor_Analyze': {
    instruction: "Compare the business against its competitors. Identify strengths, weaknesses, market position, and differentiation.",
    sections: ['Competitor Summary', 'Comparison Matrix', 'Advantage Opportunities', 'Differentiation'],
    scored: false,
  },
  'Messaging_Analyze': {
    instruction: "Evaluate how effectively this messaging persuades. Assess clarity, persuasion, trust, emotion, and credibility.",
    sections: ['Messaging Review', 'Problem Areas', 'Optimization Suggestions'],
    scored: true,
  },
  'ContentStrategy_Analyze': {
    instruction: "Build a content strategy. Define content pillars, topic ideas, themes, and distribution.",
    sections: ['Content Roadmap', 'Content Pillars', 'Topic Ideas', 'Publishing Strategy', 'Growth Opportunities'],
    scored: false,
  },
  'Campaign_Analyze': {
    instruction: "Audit this campaign and find ways to improve performance. Identify weaknesses, optimizations, and scaling opportunities.",
    sections: ['Campaign Audit', 'Weaknesses', 'Improvement Plan', 'Scaling Strategy'],
    scored: true,
  },
  'Growth_Analyze': {
    instruction: "Identify where the business can grow fastest. Surface growth opportunities, expansion ideas, and revenue opportunities.",
    sections: ['Growth Audit', 'Opportunity Map', 'Revenue Expansion Plan', 'Strategic Recommendations'],
    scored: true,
  },
  'Workflow_Analyze': {
    instruction: "Analyze the described business workflow/process. Identify where time, money, and effort are wasted: bottlenecks, inefficiencies, redundancies, and automation opportunities.",
    sections: ['Bottlenecks', 'Inefficiencies', 'Redundancies', 'Automation Opportunities'],
    scored: false,
  },
};

// Canonical universal result sections (PRD §23 / V1 Tool Architecture). `summary`
// carries the Executive Summary; these eight follow in this exact order for every tool.
const UNIVERSAL_SECTIONS = [
  'Key Findings', 'Strengths', 'Weaknesses', 'Opportunities',
  'Risks', 'Recommendations', 'Action Plan', 'Next Steps'
];

const buildToolPrompt = (cfg: ToolPromptConfig, input: any): string => {
  const { _context, ...cleanInput } = (input || {});
  return [
    "Return strictly valid JSON. No prose outside JSON.",
    `Task: ${cfg.instruction}`,
    `Inputs: ${JSON.stringify(cleanInput).slice(0, 4000)}`,
    _context ? `Use this related prior analysis as supporting context — build on it, do not just repeat it: ${String(_context).slice(0, 3000)}` : "",
    cfg.scored ? "Include a numeric 'score' (0-100) and a short 'verdict' label." : "",
    `Provide a 'summary' (the Executive Summary) plus a 'sections' array that includes EVERY one of these sections, in this exact order: ${UNIVERSAL_SECTIONS.join(', ')}.`,
    "Each section: {title: string, items: string[]} with 3-6 specific, actionable items. Tailor the content of each section to the task above.",
    "Schema: {score?:number, verdict?:string, summary:string, sections:[{title:string, items:string[]}]}"
  ].filter(Boolean).join(" ");
};

const normalizeToolResult = (raw: any) => ({
  score: safeNum(raw?.score),
  verdict: safeStr(raw?.verdict),
  summary: safeStr(raw?.summary || raw?.overview),
  sections: safeArray(raw?.sections).map((s: any) => ({
    title: safeStr(s?.title) || 'Section',
    items: safeArray(s?.items)
      .map((i: any) => (typeof i === 'string' ? i.trim() : safeStr(i?.text || i?.point || i?.item)))
      .filter(Boolean)
  })).filter((s: any) => s.items.length > 0)
});


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
        `Product Name: ${(input.productName || '').slice(0,200)}`,
        `Description: ${(input.product || '').slice(0,800)}`,
        `Market: ${input.market || input.industry}`,
        `Audience: ${input.target}`,
        "Generate angles across these 8 types: Emotional, Fear, Aspiration, Curiosity, Authority, Differentiation, Story, Contrarian (at least one of each).",
        "Schema: {angles:[{type,title,hook,rational,score}],hooks:[{platform,short,expanded}]}"
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
    else if (TOOL_PROMPTS[module]) {
      prompt = buildToolPrompt(TOOL_PROMPTS[module], input);
      normalizer = normalizeToolResult;
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
