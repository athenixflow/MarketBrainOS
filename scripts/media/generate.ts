// Generate every media slot via kie.ai. Idempotent; safe to re-run.
//
//   npm run media:generate -- [--dry-run] [--slot a,b] [--kind image|video] [--force] [--resume]
//                              [--candidates N] [--concurrency N] [--timeout-min N]
//
// Raw results land in media-src/<slot>/<slot>-<n>.<ext> (gitignored) and media-src/manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { loadKieKey, REPO_ROOT } from './env';
import { createKieClient, download, KieError, resultUrls } from './kie';
import { generatedSlots, validateSlot, MODEL_BY_KIND, buildInput } from './manifest';
import type { GeneratedEntry, GeneratedSlot, MediaManifest } from './types';

// ---- CLI ----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = flag('dry-run');
const FORCE = flag('force');
const RESUME = flag('resume');
const ONLY_SLOTS = opt('slot')?.split(',').map((s) => s.trim()).filter(Boolean);
const ONLY_KIND = opt('kind') as 'image' | 'video' | undefined;
const CANDIDATES = opt('candidates') ? Number(opt('candidates')) : undefined;
const CONCURRENCY = Number(opt('concurrency') ?? 4);
const TIMEOUT_MIN = opt('timeout-min') ? Number(opt('timeout-min')) : undefined;

const SRC = path.join(REPO_ROOT, 'media-src');
const MANIFEST = path.join(SRC, 'manifest.json');

// ---- Manifest persistence -----------------------------------------------------------------------
function loadManifest(): MediaManifest {
  if (!fs.existsSync(MANIFEST)) return { version: 1, entries: [] };
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}
function saveManifest(m: MediaManifest) {
  fs.mkdirSync(SRC, { recursive: true });
  const tmp = `${MANIFEST}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, MANIFEST);
}

type Job = { slot: GeneratedSlot; n: number };

// ---- Main ---------------------------------------------------------------------------------------
async function main() {
  const slots = generatedSlots().filter(
    (s) => (!ONLY_SLOTS || ONLY_SLOTS.includes(s.id)) && (!ONLY_KIND || s.kind === ONLY_KIND),
  );
  if (!slots.length) throw new Error('no slots selected');

  const problems = slots.flatMap((s) => validateSlot(s).map((p) => `${s.id}: ${p}`));
  if (problems.length) {
    console.error('manifest validation failed (no API calls made):\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  const manifest = loadManifest();
  const find = (slot: string, n: number) => manifest.entries.find((e) => e.slot === slot && e.n === n);

  const toSubmit: Job[] = [];
  const toPoll: GeneratedEntry[] = [];
  for (const slot of slots) {
    const count = CANDIDATES ?? slot.candidates ?? 2;
    for (let n = 1; n <= count; n++) {
      const existing = find(slot.id, n);
      const fulfilled =
        existing?.status === 'success' && existing.localPath && fs.existsSync(path.resolve(REPO_ROOT, existing.localPath));
      if (fulfilled && !FORCE) continue;
      if (existing?.status === 'submitted' || (existing?.status === 'fail' && existing.failCode === 'timeout')) {
        toPoll.push(existing); // already paid for; never resubmit
        continue;
      }
      if (!RESUME) toSubmit.push({ slot, n });
    }
  }

  console.log(`\n${toSubmit.length} task(s) to submit, ${toPoll.length} previous task(s) to re-poll.`);
  for (const j of toSubmit) {
    const extra = j.slot.kind === 'video' ? ` ${j.slot.duration}s` : '';
    console.log(`  submit  ${j.slot.id}#${j.n}  ${MODEL_BY_KIND[j.slot.kind]}  ${j.slot.aspect} ${j.slot.resolution}${extra}`);
  }
  for (const e of toPoll) console.log(`  re-poll ${e.slot}#${e.n}  ${e.taskId}`);
  if (DRY) {
    console.log('\n--dry-run: no network calls made.');
    return;
  }
  if (!toSubmit.length && !toPoll.length) {
    console.log('Nothing to do.');
    return;
  }

  const kie = createKieClient(loadKieKey());

  // Probe with the cheapest task first (an image) so a bad key or empty balance costs nothing more.
  toSubmit.sort((a, b) => (a.slot.kind === 'image' ? 0 : 1) - (b.slot.kind === 'image' ? 0 : 1));

  const submitOne = async (job: Job) => {
    const model = MODEL_BY_KIND[job.slot.kind];
    const input = buildInput(job.slot);
    const taskId = await kie.createTask(model, input);
    const entry: GeneratedEntry = {
      slot: job.slot.id,
      n: job.n,
      kind: job.slot.kind,
      model,
      taskId,
      status: 'submitted',
      prompt: job.slot.prompt,
      input,
      submittedAt: new Date().toISOString(),
    };
    manifest.entries = manifest.entries.filter((e) => !(e.slot === entry.slot && e.n === entry.n));
    manifest.entries.push(entry);
    saveManifest(manifest);
    toPoll.push(entry);
    console.log(`  submitted ${entry.slot}#${entry.n} -> ${taskId}`);
  };

  let creditsExhausted = false;
  if (toSubmit.length) {
    try {
      await submitOne(toSubmit[0]);
    } catch (e) {
      if (e instanceof KieError && e.isAuth) {
        console.error('KIE_API_KEY was rejected (401). Check .env.');
        process.exit(2);
      }
      if (e instanceof KieError && e.isCredits) {
        console.error('kie.ai reports insufficient credits (402). Top up at https://kie.ai');
        process.exit(3);
      }
      throw e;
    }
    const rest = toSubmit.slice(1);
    let idx = 0;
    const worker = async () => {
      while (idx < rest.length && !creditsExhausted) {
        const job = rest[idx++];
        try {
          await submitOne(job);
        } catch (e) {
          if (e instanceof KieError && e.isCredits) {
            creditsExhausted = true;
            console.error('Credits ran out mid-batch; polling what was accepted.');
            return;
          }
          console.error(`  submit failed ${job.slot.id}#${job.n}: ${(e as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rest.length) }, worker));
  }

  // One poll loop for everything pending.
  const pending = new Set(toPoll.map((e) => e.taskId));
  const startedAt = new Map(toPoll.map((e) => [e.taskId, Date.now()]));
  const timeoutMs = (kind: string) => (TIMEOUT_MIN ?? (kind === 'video' ? 15 : 5)) * 60_000;
  let interval = 3000;
  const t0 = Date.now();
  while (pending.size) {
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(Math.round(interval * 1.5), 10_000);
    for (const entry of toPoll) {
      if (!pending.has(entry.taskId)) continue;
      let info;
      try {
        info = await kie.recordInfo(entry.taskId);
      } catch (e) {
        if (e instanceof KieError && e.isTransient) {
          console.log(`  ${entry.slot}#${entry.n} transient error, retrying: ${e.message}`);
          continue;
        }
        throw e;
      }
      const elapsed = Math.round((Date.now() - (startedAt.get(entry.taskId) ?? t0)) / 1000);
      if (info.state === 'success') {
        const urls = resultUrls(info);
        if (!urls.length) {
          Object.assign(entry, { status: 'fail', failCode: 'no-result', failMsg: 'success with empty resultUrls', completedAt: new Date().toISOString() });
        } else {
          if (urls.length > 1) console.log(`  ${entry.slot}#${entry.n} returned ${urls.length} urls; keeping the first`);
          const stem = path.join(SRC, entry.slot, `${entry.slot}-${entry.n}`);
          const local = await download(urls[0], stem);
          Object.assign(entry, {
            status: 'success',
            url: urls[0],
            localPath: path.relative(REPO_ROOT, local).replace(/\\/g, '/'),
            creditsConsumed: info.creditsConsumed,
            costTime: info.costTime,
            completedAt: new Date().toISOString(),
          });
          console.log(`  done    ${entry.slot}#${entry.n}  ${entry.localPath}  (${info.creditsConsumed ?? '?'} credits, ${elapsed}s)`);
        }
        pending.delete(entry.taskId);
        saveManifest(manifest);
      } else if (info.state === 'fail') {
        Object.assign(entry, {
          status: 'fail',
          failCode: info.failCode || 'fail',
          failMsg: info.failMsg,
          creditsConsumed: info.creditsConsumed,
          completedAt: new Date().toISOString(),
        });
        console.error(`  FAILED  ${entry.slot}#${entry.n}  ${info.failCode} ${info.failMsg}`);
        pending.delete(entry.taskId);
        saveManifest(manifest);
      } else if (Date.now() - (startedAt.get(entry.taskId) ?? t0) > timeoutMs(entry.kind)) {
        Object.assign(entry, { status: 'fail', failCode: 'timeout', failMsg: `still ${info.state} after ${elapsed}s; re-run with --resume` });
        console.error(`  TIMEOUT ${entry.slot}#${entry.n} (${info.state}); re-run with --resume to keep polling`);
        pending.delete(entry.taskId);
        saveManifest(manifest);
      } else {
        const pct = info.progress != null ? ` ${info.progress}%` : '';
        console.log(`  ${entry.slot}#${entry.n} ${info.state}${pct} ${elapsed}s`);
      }
    }
    const done = toPoll.filter((e) => e.status === 'success').length;
    const failed = toPoll.filter((e) => e.status === 'fail').length;
    console.log(`  -- ${pending.size} pending / ${done} done / ${failed} failed`);
  }

  // Cost summary
  console.log('\nSummary:');
  let total = 0;
  for (const e of toPoll) {
    total += e.creditsConsumed ?? 0;
    const secs = e.costTime ? Math.round(e.costTime / 1000) + 's' : '';
    console.log(`  ${e.slot.padEnd(20)} #${e.n}  ${e.status.padEnd(8)} ${String(e.creditsConsumed ?? '?').padStart(6)} credits  ${secs}`);
  }
  console.log(`  total credits consumed this run: ${total}`);
  console.log('  kie.ai result URLs expire; media-src/ is the source of truth. Next: npm run media:sheet');
  if (toPoll.some((e) => e.status === 'fail')) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof KieError ? e.message : e);
  process.exit(1);
});
