// Thin kie.ai client. Holds the key in a closure; errors carry only HTTP status + kie's code/msg.
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://api.kie.ai/api/v1';

export type TaskState = 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';

export interface RecordInfo {
  taskId: string;
  model: string;
  state: TaskState;
  resultJson: string;
  failCode: string;
  failMsg: string;
  progress?: number;
  costTime?: number;
  creditsConsumed?: number;
}

export class KieError extends Error {
  constructor(public readonly status: number, public readonly code: number | undefined, msg: string) {
    super(`kie.ai ${status}${code !== undefined ? ` (code ${code})` : ''}: ${msg}`);
    this.name = 'KieError';
  }
  get isAuth() { return this.status === 401 || this.code === 401; }
  get isCredits() { return this.status === 402 || this.code === 402; }
  get isTransient() { return this.status >= 500 || this.status === 0 || this.status === 429; }
}

export function createKieClient(apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new KieError(0, undefined, `network error: ${(e as Error).message}`);
    }
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok || !json || json.code !== 200) {
      throw new KieError(res.status, json?.code, json?.msg ?? res.statusText ?? 'unknown error');
    }
    return json.data as T;
  }

  return {
    async createTask(model: string, input: Record<string, unknown>): Promise<string> {
      const data = await call<{ taskId: string }>('POST', `${BASE}/jobs/createTask`, { model, input });
      if (!data?.taskId) throw new KieError(200, undefined, 'createTask returned no taskId');
      return data.taskId;
    },
    async recordInfo(taskId: string): Promise<RecordInfo> {
      return call<RecordInfo>('GET', `${BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    },
  };
}

export type KieClient = ReturnType<typeof createKieClient>;

/** Parse resultJson defensively; returns [] if the shape is unexpected. */
export function resultUrls(info: RecordInfo): string[] {
  try {
    const parsed = JSON.parse(info.resultJson || '{}');
    const urls = parsed?.resultUrls;
    return Array.isArray(urls) ? urls.filter((u) => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
};
const KNOWN_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov']);

/** Download a (temporary) result URL to destStem.<ext>; ext from the URL, else Content-Type. Returns the path. */
export async function download(url: string, destStem: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new KieError(res.status, undefined, `download failed for ${url}`);
  const urlExt = path.extname(new URL(url).pathname).slice(1).toLowerCase();
  const ext = KNOWN_EXT.has(urlExt) ? urlExt : EXT_BY_TYPE[res.headers.get('content-type')?.split(';')[0] ?? ''] ?? 'bin';
  const dest = `${destStem}.${ext}`;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}
