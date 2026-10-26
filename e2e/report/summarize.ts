/**
 * Groups the route sweep's findings (artifacts/findings/*.jsonl) by distinct defect, so 300 failing
 * checks read as a short list of problems with where each one shows up.
 *   npx tsx e2e/report/summarize.ts [--role pro] [--kind offscreen]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'findings');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const onlyRole = arg('role'), onlyKind = arg('kind');

type Row = { project: string; role: string; route: string; landed: string; want: string; layout: any; errors: any; blocked: string[] };
const rows: Row[] = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  .flatMap((f) => readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => r.layout); // only the route sweep's rows; the a11y/crawl/bachs files have their own shape

// Normalise a message so the same defect on different pages groups together (drop pixel counts).
const norm = (s: string) => s.replace(/\d+(\.\d+)?px/g, 'Npx').replace(/\(\d+x\d+( in \d+x\d+)?\)/g, '(…)').replace(/ \d+x\d+$/, ' WxH');

const groups = new Map<string, { kind: string; where: Set<string>; projects: Set<string> }>();
const add = (kind: string, msg: string, r: Row) => {
  if (onlyKind && kind !== onlyKind) return;
  const key = `${kind} | ${norm(msg)}`;
  const g = groups.get(key) || { kind, where: new Set(), projects: new Set() };
  g.where.add(`${r.role} ${r.route}`); g.projects.add(r.project);
  groups.set(key, g);
};

for (const r of rows) {
  if (onlyRole && r.role !== onlyRole) continue;
  const ok = r.want === 'to-auth' ? r.landed === '/auth' : r.want === 'to-home' ? r.landed === '/' : r.landed === r.route;
  if (!ok) add('guard', `${r.route}: wanted ${r.want}, landed on ${r.landed}`, r);
  if (r.layout.pageOverflowX > 1) add('overflowX', `page scrolls sideways`, r);
  r.layout.offscreen.forEach((m: string) => add('offscreen', m, r));
  r.layout.overlaps.forEach((m: string) => add('overlap', m, r));
  r.layout.clipped.forEach((m: string) => add('clipped', m, r));
  r.layout.smallTargets.forEach((m: string) => add('tap<24', m, r));
  r.errors.pageErrors.forEach((m: string) => add('pageerror', m.split('\n')[0].slice(0, 160), r));
  r.errors.consoleErrors.forEach((m: string) => add('console', m.slice(0, 160), r));
  r.errors.failedRequests.forEach((m: string) => add('request', m.replace(/\?.*$/, '').slice(0, 160), r));
  (r.blocked || []).forEach((n: string) => add('firewall', `page load called ${n}`, r));
}

const sorted = [...groups.entries()].sort((a, b) => a[1].kind.localeCompare(b[1].kind) || b[1].where.size - a[1].where.size);
const lines = [`${rows.length} page loads; ${sorted.length} distinct findings\n`];
for (const [key, g] of sorted) {
  const where = [...g.where];
  lines.push(`[${g.kind}] ${key.split(' | ')[1]}\n    ${where.length} page(s) on ${[...g.projects].sort().join(', ')}\n    e.g. ${where.slice(0, 6).join('; ')}`);
}
const out = lines.join('\n');
writeFileSync(path.join(dir, '..', 'summary.txt'), out);
console.log(out);
