/* The Gemini SDK is loaded on the first Gemini call and never named in an import, not even a type one:
   scripts/ai.test.ts imports this file in the root (Vercel) build, where functions/ packages are not
   installed (scripts/deploy.test.mjs and scripts/routes.test.mjs both enforce that). */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loadGemini = (): any => require('@google/generative-ai');

/**
 * The one place the server talks to an AI model. Which provider answers is configuration, not code:
 * `AI_PROVIDER` in functions/.env is 'gemini' (the default) or 'deepseek'. Switching back and forth is
 * an .env edit and a functions deploy.
 *
 * Added Nov 2026 when the Gemini billing account was cut off (402 credits depleted, then 403
 * outstanding balance): every analysis failed and refunded until DeepSeek was switched on.
 *
 *   Gemini   — process.env.API_KEY.          'pro' = gemini-2.5-pro, 'flash' = gemini-2.5-flash.
 *   DeepSeek — process.env.DEEPSEEK_API_KEY. Both classes = DEEPSEEK_MODEL (default deepseek-chat).
 *
 * DeepSeek's JSON mode guarantees valid JSON but not a shape, so a `geminiSchema` is only enforced by
 * Gemini; callers that depend on a shape validate the parsed result themselves (see normaliseAngleMiner).
 */

export type AiProvider = 'gemini' | 'deepseek';
export type ModelClass = 'pro' | 'flash';

export interface AiRequest {
  modelClass: ModelClass;
  systemInstruction: string;
  prompt: string;
  /** Ask for a JSON object back. The prompt must itself say "JSON" (DeepSeek's JSON mode requires it). */
  json: boolean;
  /** A Gemini `Schema` (from @google/generative-ai). Enforced by Gemini only. */
  geminiSchema?: object;
}

export const aiProvider = (): AiProvider =>
  (process.env.AI_PROVIDER || '').trim().toLowerCase() === 'deepseek' ? 'deepseek' : 'gemini';

const GEMINI_MODEL: Record<ModelClass, string> = { pro: 'gemini-2.5-pro', flash: 'gemini-2.5-flash' };
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
/* Under executeAnalysis's 300s function timeout, so a hung call fails (and refunds) instead of being killed. */
const DEEPSEEK_TIMEOUT_MS = 270_000;

let gemini: any = null;

async function viaGemini(req: AiRequest): Promise<string> {
  gemini = gemini || new (loadGemini().GoogleGenerativeAI)(process.env.API_KEY || '');
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL[req.modelClass], systemInstruction: req.systemInstruction });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
    generationConfig: req.json
      ? { responseMimeType: 'application/json', ...(req.geminiSchema ? { responseSchema: req.geminiSchema } : {}) }
      : undefined,
  });
  return result.response.text();
}

async function viaDeepSeek(req: AiRequest): Promise<string> {
  const key = (process.env.DEEPSEEK_API_KEY || '').trim();
  if (!key) throw new Error('DeepSeek: DEEPSEEK_API_KEY is not set');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEEPSEEK_TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
        messages: [
          { role: 'system', content: req.systemInstruction },
          { role: 'user', content: req.prompt },
        ],
        max_tokens: 8192,
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${body?.error?.message || res.statusText}`);
    const choice = body?.choices?.[0];
    const text = String(choice?.message?.content || '');
    /* A reply cut off at max_tokens is half a JSON object: fail (and refund) rather than parse a fragment. */
    if (choice?.finish_reason === 'length') throw new Error('DeepSeek: response truncated at max_tokens');
    if (!text.trim()) throw new Error('DeepSeek: empty response');
    return text;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`DeepSeek: no response within ${DEEPSEEK_TIMEOUT_MS / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** The model's reply as text (a JSON string when `json` is set). Throws on any provider failure. */
export const generateText = (req: AiRequest): Promise<string> =>
  aiProvider() === 'deepseek' ? viaDeepSeek(req) : viaGemini(req);

/** A human-readable model name for logs and the admin AI Ops panel. */
export const activeModelName = (modelClass: ModelClass): string =>
  aiProvider() === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim() : GEMINI_MODEL[modelClass];
