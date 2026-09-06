// The ONLY place the kie.ai key is read. Returns it to kie.ts and nowhere else.
// Never log the return value. Never import this from optimize.ts or app code.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadKieKey(): string {
  // quiet: dotenv 17 otherwise prints a promo line on every run.
  config({ path: path.join(ROOT, '.env'), quiet: true } as Parameters<typeof config>[0]);
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'KIE_API_KEY is not set. Put it in the repo-root .env (see .env.example). ' +
        'It must never be added to vite.config.ts define{}.',
    );
  }
  return key;
}

export const REPO_ROOT = ROOT;
