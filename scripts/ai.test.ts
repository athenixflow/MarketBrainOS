// Guards the AI provider switch (functions/src/ai.ts) — added Nov 2026 when the Gemini billing account
// was cut off and every analysis failed until DeepSeek was switched on.
//
// What must hold whichever provider answers:
// - AI_PROVIDER picks the provider; anything but 'deepseek' means Gemini, so a typo cannot silently
//   point production at a provider nobody configured.
// - The DeepSeek request is the documented OpenAI-style call with JSON mode on, and a reply cut off at
//   max_tokens, an HTTP error or a missing key is an ERROR (the run refunds), never a half-parsed result.
// - No server code calls the Gemini SDK directly any more: one helper, one switch.
// - AngleMiner's channel check holds for a provider that does not enforce the schema.
//
// Runs in `npm run build`. Makes no network call: fetch is replaced for the duration.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiProvider, generateText } from '../functions/src/ai';
import { normaliseAngleMiner } from '../functions/src/angleMiner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
const rejects = async (p: Promise<unknown>, re: RegExp) => {
  try { await p; return false; } catch (e: any) { return re.test(String(e?.message || e)); }
};

const env = { ...process.env };
const realFetch = globalThis.fetch;
let sent: { url: string; init: any } | null = null;
const reply = (status: number, body: unknown) => {
  globalThis.fetch = (async (url: any, init: any) => {
    sent = { url: String(url), init };
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
};
const req = { modelClass: 'pro' as const, systemInstruction: 'SYS', prompt: 'Return strict JSON: { a }', json: true };

(async () => {
  console.log('PROVIDER SWITCH:');
  delete process.env.AI_PROVIDER;
  ok(aiProvider() === 'gemini', 'no AI_PROVIDER means Gemini (the existing behaviour)');
  process.env.AI_PROVIDER = ' DeepSeek ';
  ok(aiProvider() === 'deepseek', "AI_PROVIDER 'deepseek' (any case, spaces trimmed) selects DeepSeek");
  process.env.AI_PROVIDER = 'deepsek';
  ok(aiProvider() === 'gemini', 'a misspelt provider falls back to Gemini rather than an unconfigured one');

  console.log('\nDEEPSEEK CALL:');
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  delete process.env.DEEPSEEK_MODEL;
  reply(200, { choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }] });
  const text = await generateText(req);
  const body = JSON.parse(sent!.init.body);
  ok(text === '{"a":1}', 'the reply text is returned as the model wrote it');
  ok(sent!.url === 'https://api.deepseek.com/chat/completions', 'it calls the DeepSeek chat completions endpoint');
  ok(sent!.init.headers.Authorization === 'Bearer sk-test', 'with the key as a bearer token');
  ok(body.model === 'deepseek-chat' && body.messages[0].role === 'system' && body.messages[0].content === 'SYS'
    && body.messages[1].content === req.prompt, 'deepseek-chat by default, system instruction first, then the prompt');
  ok(body.response_format?.type === 'json_object', 'JSON mode is on for a JSON request');
  await generateText({ ...req, json: false });
  ok(JSON.parse(sent!.init.body).response_format === undefined, 'and off for a plain-text request (the hook refiner)');
  process.env.DEEPSEEK_MODEL = 'deepseek-reasoner';
  await generateText(req);
  ok(JSON.parse(sent!.init.body).model === 'deepseek-reasoner', 'DEEPSEEK_MODEL overrides the model');

  reply(200, { choices: [{ message: { content: '{"a":' }, finish_reason: 'length' }] });
  ok(await rejects(generateText(req), /truncated/), 'a reply cut off at max_tokens is an error, not half a JSON object');
  reply(402, { error: { message: 'Insufficient Balance' } });
  ok(await rejects(generateText(req), /DeepSeek 402: Insufficient Balance/), "an HTTP error carries DeepSeek's own reason into the log");
  reply(200, { choices: [{ message: { content: '  ' }, finish_reason: 'stop' }] });
  ok(await rejects(generateText(req), /empty/), 'an empty reply is an error');
  process.env.DEEPSEEK_API_KEY = '\u0016';
  ok(await rejects(generateText(req), /malformed/), 'a key that is a pasted control character is named as malformed, not "fetch failed"');
  delete process.env.DEEPSEEK_API_KEY;
  ok(await rejects(generateText(req), /DEEPSEEK_API_KEY is not set/), 'a missing key fails loudly instead of calling out unauthenticated');

  console.log('\nONE PATH TO THE MODEL:');
  const blank = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const server = fs.readdirSync(path.join(root, 'functions/src'), { recursive: true } as any)
    .map(String).filter((f) => f.endsWith('.ts') && f !== 'ai.ts' && !f.includes('.test.'));
  const direct = server.filter((f) => /GoogleGenerativeAI|getGenerativeModel|generateContent\(/.test(blank(fs.readFileSync(path.join(root, 'functions/src', f), 'utf8'))));
  ok(direct.length === 0, `no server file but ai.ts calls the Gemini SDK${direct.length ? ` (found in ${direct.join(', ')})` : ''}`);
  const probe = 'const m = new GoogleGenerativeAI(k).getGenerativeModel({ model });';
  ok(/GoogleGenerativeAI|getGenerativeModel|generateContent\(/.test(blank(probe)), 'CONTROL: that scan does catch a direct SDK call');

  console.log('\nANGLEMINER SHAPE (no schema enforcement on DeepSeek):');
  const out = normaliseAngleMiner({
    angles: [{ type: 'Emotional', title: 'T', hook: 'H', rational: 'R', score: 80 }, null],
    hooks: [{ channel: 'ads', short: 's' }, { channel: ' ORGANIC ', short: 's' }, { channel: 'Meta', short: 's' }],
  });
  ok(out.angles.length === 1, 'a null angle is dropped');
  ok(out.hooks.map((h: any) => h.channel).join(',') === 'Ads,Organic,Meta',
    "channels are written in the UI's spelling; an unknown one is kept for the page's Other column");
  let threw = false;
  try { normaliseAngleMiner({ angles: [], hooks: [] }); } catch { threw = true; }
  ok(threw, 'a reply with no angles is an error, so the run refunds instead of charging for an empty report');

  globalThis.fetch = realFetch;
  process.env = env;
  console.log(failures === 0
    ? '\nPASS — one switch picks the provider, and a bad DeepSeek reply fails (and refunds) instead of half-parsing.'
    : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
})();
