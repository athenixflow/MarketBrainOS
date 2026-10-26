/**
 * Every recorded landing for given role/route pairs across all projects: tells a real guard defect
 * (wrong every time) from a harness flake (wrong once, right on rerun).
 *   npx tsx e2e/report/landings.ts pro:/admin team:/test-lab
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'findings');
const rows = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  .flatMap((f) => readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => r.layout);
for (const pair of process.argv.slice(2)) {
  const [role, route] = pair.split(':');
  const hits = rows.filter((r) => r.role === role && r.route === route);
  const by = new Map<string, string[]>();
  hits.forEach((h) => by.set(h.project, [...(by.get(h.project) || []), h.landed]));
  console.log(`${role} ${route} (expected: ${hits[0]?.want ?? '?'})`);
  for (const [p, l] of by) console.log(`  ${p}: ${l.join(' , ')}`);
}
