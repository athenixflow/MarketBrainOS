
import { db, serverTimestamp, getAIClient, cleanJSON, sendJson, sendError } from '../utils';

export const config = { runtime: 'nodejs' };

// --- Normalizers ---
const safeStr = (val: any) => (typeof val === 'string' ? val.trim() : '');
const safeNum = (val: any) => (typeof val === 'number' && !isNaN(val) ? val : 0);
const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);

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
  return { 
    prime: safeArray(raw?.prime).map(cleanAngle).filter((x:any)=>x),
    supporting: safeArray(raw?.supporting).map(cleanAngle).filter((x:any)=>x),
    exploratory: safeArray(raw?.exploratory).map(cleanAngle).filter((x:any)=>x),
    hooks: safeArray(raw?.hooks).map((h:any) => ({
      platform: safeStr(h?.platform) || 'General',
      short: safeStr(h?.short || h?.hook),
      expanded: safeStr(h?.expanded || h?.description)
    })).filter((h:any) => h.short)
  };
};

const normalizeTestLabResponse = (raw: any) => {
  const variants = safeArray(raw?.variants).map((v: any) => ({
    label: safeStr(v.label) || 'Variant',
    text: safeStr(v.text || v.content || v.copy) || 'No text',
    score: safeNum(v.score)
  })).filter((v: any) => v.text !== 'No text');
  let winnerLabel = safeStr(raw?.winnerLabel || raw?.winner);
  if (variants.length > 0 && !variants.find((v: any) => v.label === winnerLabel)) winnerLabel = variants[0].label;
  return { variants, winnerLabel: winnerLabel || 'None', explanation: safeStr(raw?.explanation || raw?.analysis) || 'Analysis complete.' };
};

const normalizeAuditResponse = (raw: any) => {
  return {
    score: safeNum(raw?.score),
    summary: safeStr(raw?.summary || raw?.overview) || 'Analysis complete.',
    issues: safeArray(raw?.issues).map((i: any) => ({ blocker: safeStr(i?.blocker || i?.issue), impact: safeStr(i?.impact) || 'Medium' })).filter((i: any) => i.blocker),
    fixes: safeArray(raw?.fixes).map((f: any) => ({ what: safeStr(f?.what || f?.action), how: safeStr(f?.how || f?.implementation), expectedResult: safeStr(f?.expectedResult || f?.result) })).filter((f: any) => f.what),
    rewrites: safeArray(raw?.rewrites).map((r: any) => ({ label: safeStr(r?.label), text: safeStr(r?.text || r?.content) })).filter((r: any) => r.text),
    auditedUrl: safeStr(raw?.auditedUrl) || undefined
  };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendError(res, 'Method Not Allowed', 'method_not_allowed', 405);

  try {
    const { jobId } = req.body;
    if (!jobId) return sendError(res, 'Missing Job ID', 'invalid_request', 400);

    const jobRef = db.collection('analysis_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) return sendError(res, 'Job not found', 'not_found', 404);
    const job = jobSnap.data()!;

    if (job.status === 'completed' || job.status === 'failed') {
      return sendJson(res, { success: true, data: { status: job.status } });
    }

    // Lock Job
    await jobRef.update({ status: 'running', updated_at: serverTimestamp() });

    const ai = getAIClient();
    if (!ai) throw new Error("AI Client Configuration Missing");

    const { module, input } = job;
    let prompt = "";
    let normalizer = (d: any) => d;

    // AI Configuration
    if (module === 'AngleMiner_Generate') {
      prompt = `Return strictly valid JSON. Product: ${(input.product || '').slice(0,800)}. Industry: ${input.industry}. Target: ${input.target}. Schema: {prime:[{title,hook,rational,score}],supporting:[{title,hook,rational,score}],exploratory:[{title,hook,rational,score}],hooks:[{platform,short,expanded}]}`;
      normalizer = normalizeAngleMinerResponse;
    } 
    else if (module === 'AngleMiner_Improve') {
      prompt = `Refine hook for conversion: "${(input || '').slice(0,300)}"`;
    }
    else if (module === 'TestLab_Simulation') {
      const variantsSafe = (input.variants || []).join('|').slice(0,1000);
      prompt = `Return strictly valid JSON. Compare Type: ${input.type}. Variants: ${variantsSafe}. Schema: {variants:[{label,text,score}],winnerLabel,explanation}`;
      normalizer = normalizeTestLabResponse;
    }
    else if (module === 'ConversionDoctor_Audit') {
      prompt = `Return strictly valid JSON. Audit Context: ${input.context}. Content: ${(input.input || '').slice(0,1500)}. Schema: {score,summary,issues:[{blocker,impact}],fixes:[{what,how,expectedResult}]}`;
      normalizer = normalizeAuditResponse;
    }
    else if (module === 'Workflow_ImproveAssets') {
       const issuesSafe = (input.issues || []).join('|').slice(0,500);
       prompt = `Return strictly valid JSON. Refine Angle: "${(input.angle || '').slice(0,300)}". Issues to fix: ${issuesSafe}. Schema: {headline,cta,offer}`;
       normalizer = (raw: any) => ({ headline: safeStr(raw?.headline), cta: safeStr(raw?.cta), offer: safeStr(raw?.offer) });
    }

    // EXECUTION: Bounded Timeout (8 seconds)
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: 'application/json' }});
    
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), 8500));
    
    const result: any = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);

    const text = result.response.text();
    let finalOutput;

    if (module === 'AngleMiner_Improve') {
      finalOutput = text ? text.trim() : "";
    } else {
      const json = cleanJSON(text || '');
      if (!json) throw new Error("Failed to parse JSON response");
      finalOutput = normalizer(json);
    }

    // Save Result
    await jobRef.update({
      status: 'completed',
      result: finalOutput,
      updated_at: serverTimestamp()
    });

    return sendJson(res, { success: true, data: { status: 'completed' } });

  } catch (error: any) {
    if (error.message === 'AI_TIMEOUT') {
      // Don't fail the job, just let it stay running for next polling cycle to retry
      return sendJson(res, { success: true, data: { status: 'running' } });
    }

    // Real Failure
    try {
       const { jobId } = req.body;
       if(jobId) {
          await db.collection('analysis_jobs').doc(jobId).update({
            status: 'failed',
            error: error.message,
            updated_at: serverTimestamp()
          });
       }
    } catch(e) {}

    return sendError(res, error.message, 'execution_failed');
  }
}
