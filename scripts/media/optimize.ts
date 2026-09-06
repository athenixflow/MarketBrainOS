// Turn picked candidates (and hand-captured screenshots) into web assets under assets/media/,
// then regenerate assets/media/index.ts so components import them through Vite (hashed, immutable-cached).
//
//   npm run media:optimize -- [--slot a,b] [--pick hero=2] [--force] [--no-ffmpeg] [--dry-run]
//
// Needs no API key. Images: sharp -> avif + webp per width + one jpg fallback.
// Video: ffmpeg-static -> faststart H.264 mp4 (+720p variant, +poster). Falls back to copy-as-is.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { REPO_ROOT } from './env';
import { SLOTS } from './manifest';
import type { ImageSlot, MediaManifest, ScreenshotSlot, Slot, VideoSlot } from './types';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = flag('dry-run');
const FORCE = flag('force');
const NO_FFMPEG = flag('no-ffmpeg');
const ONLY = opt('slot')?.split(',').map((s) => s.trim());
const PICK_OVERRIDES = Object.fromEntries((opt('pick') ?? '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, Number(v)]; }));

const SRC = path.join(REPO_ROOT, 'media-src');
const OUT = path.join(REPO_ROOT, 'assets', 'media');
const BUDGET = { image: 300 * 1024, video1080: 4 * 1024 * 1024, video720: 2 * 1024 * 1024 };

const manifest: MediaManifest = fs.existsSync(path.join(SRC, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'))
  : { version: 1, entries: [] };

const kb = (p: string) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
const rel = (p: string) => path.relative(REPO_ROOT, p).replace(/\\/g, '/');

function sourceFor(slot: Slot): string | null {
  if (slot.kind === 'screenshot') {
    const p = path.resolve(REPO_ROOT, slot.source);
    return fs.existsSync(p) ? p : null;
  }
  const n = PICK_OVERRIDES[slot.id] ?? slot.pick ?? 1;
  const e = manifest.entries.find((x) => x.slot === slot.id && x.n === n && x.status === 'success' && x.localPath);
  if (!e?.localPath) return null;
  const p = path.resolve(REPO_ROOT, e.localPath);
  return fs.existsSync(p) ? p : null;
}

// Which source file each slot's outputs were built from, so changing `pick` invalidates them even when the
// alternate candidate is older than the existing outputs.
const STAMP = path.join(OUT, '.sources.json');
const stamp: Record<string, string> = fs.existsSync(STAMP) ? JSON.parse(fs.readFileSync(STAMP, 'utf8')) : {};
const upToDate = (id: string, src: string, outs: string[]) => {
  const fresh = !FORCE && stamp[id] === rel(src) && outs.every((o) => fs.existsSync(o) && fs.statSync(o).mtimeMs >= fs.statSync(src).mtimeMs);
  if (!DRY) stamp[id] = rel(src);
  return fresh;
};

// ---- Images -------------------------------------------------------------------------------------
type ImageResult = { id: string; alt: string; width: number; height: number; widths: number[] };

async function doImage(slot: ImageSlot | ScreenshotSlot, src: string): Promise<ImageResult | null> {
  const meta = await sharp(src).metadata();
  const srcW = meta.width ?? 0, srcH = meta.height ?? 0;
  const widths = slot.web.widths.filter((w) => w <= srcW || w === Math.min(...slot.web.widths));
  const outs: string[] = [];
  for (const w of widths) { outs.push(path.join(OUT, `${slot.id}-${w}.avif`), path.join(OUT, `${slot.id}-${w}.webp`)); }
  const jpg = path.join(OUT, `${slot.id}-${widths[0]}.jpg`);
  outs.push(jpg);
  const largest = Math.min(widths[0], srcW);
  const height = Math.round(srcH * (largest / srcW));
  if (upToDate(slot.id, src, outs)) { console.log(`  ${slot.id}: up to date`); return { id: slot.id, alt: slot.alt, width: largest, height, widths }; }
  if (DRY) { console.log(`  ${slot.id}: would write ${outs.map(rel).join(', ')}`); return { id: slot.id, alt: slot.alt, width: largest, height, widths }; }
  for (const w of widths) {
    const base = sharp(src).resize({ width: Math.min(w, srcW), withoutEnlargement: true });
    await base.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(OUT, `${slot.id}-${w}.avif`));
    await base.clone().webp({ quality: 80 }).toFile(path.join(OUT, `${slot.id}-${w}.webp`));
  }
  await sharp(src).resize({ width: largest, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(jpg);
  for (const o of outs) {
    const size = fs.statSync(o).size;
    console.log(`  ${rel(o)}  ${kb(o)}${size > BUDGET.image ? '  ! over 300 KB budget' : ''}`);
  }
  return { id: slot.id, alt: slot.alt, width: largest, height, widths };
}

// ---- Video --------------------------------------------------------------------------------------
type VideoResult = { id: string; alt: string; width: number; height: number; mobile: boolean; poster: boolean };

async function resolveFfmpeg(): Promise<string | null> {
  if (NO_FFMPEG) return null;
  const onPath = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (onPath.status === 0) return 'ffmpeg';
  try {
    const mod: any = await import('ffmpeg-static');
    const p = mod.default ?? mod;
    return typeof p === 'string' && fs.existsSync(p) ? p : null;
  } catch { return null; }
}

function run(bin: string, args: string[]) {
  const r = spawnSync(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}\n${r.stderr?.toString().slice(-800)}`);
}

async function doVideo(slot: VideoSlot, src: string, ffmpeg: string | null): Promise<VideoResult> {
  const mp4 = path.join(OUT, `${slot.id}.mp4`);
  const mp4m = path.join(OUT, `${slot.id}-720.mp4`);
  const poster = path.join(OUT, `${slot.id}-poster.jpg`);
  const posterWebp = path.join(OUT, `${slot.id}-poster.webp`);
  const outs = [mp4, ...(slot.web.mobile720p && ffmpeg ? [mp4m] : []), ...(slot.web.poster && ffmpeg ? [poster, posterWebp] : [])];
  if (DRY) { console.log(`  ${slot.id}: would write ${outs.map(rel).join(', ')} via ${ffmpeg ? 'ffmpeg' : 'copy'}`); return { id: slot.id, alt: slot.alt, width: 1920, height: 1080, mobile: !!(slot.web.mobile720p && ffmpeg), poster: !!(slot.web.poster && ffmpeg) }; }
  if (!upToDate(slot.id, src, outs)) {
    if (!ffmpeg) {
      fs.copyFileSync(src, mp4);
      console.log(`  ${rel(mp4)}  ${kb(mp4)}  (copied as-is: no ffmpeg; not faststart-optimized, no poster)`);
    } else {
      run(ffmpeg, ['-y', '-i', src, '-an', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'scale=1920:-2', mp4]);
      console.log(`  ${rel(mp4)}  ${kb(mp4)}${fs.statSync(mp4).size > BUDGET.video1080 ? '  ! over 4 MB budget' : ''}`);
      if (slot.web.mobile720p) {
        run(ffmpeg, ['-y', '-i', src, '-an', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'scale=-2:720', mp4m]);
        console.log(`  ${rel(mp4m)}  ${kb(mp4m)}${fs.statSync(mp4m).size > BUDGET.video720 ? '  ! over 2 MB budget' : ''}`);
      }
      if (slot.web.poster) {
        run(ffmpeg, ['-y', '-i', mp4, '-ss', '0', '-frames:v', '1', '-q:v', '3', poster]);
        await sharp(poster).webp({ quality: 78 }).toFile(posterWebp);
        console.log(`  ${rel(poster)}  ${kb(poster)}   ${rel(posterWebp)}  ${kb(posterWebp)}`);
      }
    }
  } else console.log(`  ${slot.id}: up to date`);
  let width = 1920, height = 1080;
  if (fs.existsSync(poster)) { const m = await sharp(poster).metadata(); width = m.width ?? width; height = m.height ?? height; }
  return { id: slot.id, alt: slot.alt, width, height, mobile: fs.existsSync(mp4m), poster: fs.existsSync(poster) };
}

// ---- index.ts -----------------------------------------------------------------------------------
const ident = (id: string) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

function writeIndex(images: ImageResult[], videos: VideoResult[]) {
  const lines: string[] = [
    '// GENERATED by scripts/media/optimize.ts - do not edit by hand. Re-run `npm run media:optimize`.',
    "import type { ImageAsset, VideoAsset } from '../../components/media/types';",
    '',
  ];
  for (const im of images) {
    for (const w of im.widths) {
      lines.push(`import ${ident(im.id)}_${w}_avif from './${im.id}-${w}.avif';`);
      lines.push(`import ${ident(im.id)}_${w}_webp from './${im.id}-${w}.webp';`);
    }
    lines.push(`import ${ident(im.id)}_jpg from './${im.id}-${im.widths[0]}.jpg';`);
  }
  for (const v of videos) {
    lines.push(`import ${ident(v.id)}_mp4 from './${v.id}.mp4';`);
    if (v.mobile) lines.push(`import ${ident(v.id)}_720 from './${v.id}-720.mp4';`);
    if (v.poster) { lines.push(`import ${ident(v.id)}_poster from './${v.id}-poster.jpg';`); lines.push(`import ${ident(v.id)}_posterWebp from './${v.id}-poster.webp';`); }
  }
  lines.push('');
  for (const im of images) {
    const srcset = (fmt: string) => im.widths.map((w) => `\${${ident(im.id)}_${w}_${fmt}} ${w}w`).join(', ');
    lines.push(`export const ${ident(im.id)}: ImageAsset = {`);
    lines.push(`  alt: ${JSON.stringify(im.alt)}, width: ${im.width}, height: ${im.height},`);
    lines.push(`  sources: [{ type: 'image/avif', srcSet: \`${srcset('avif')}\` }, { type: 'image/webp', srcSet: \`${srcset('webp')}\` }],`);
    lines.push(`  fallback: ${ident(im.id)}_jpg,`);
    lines.push('};');
  }
  for (const v of videos) {
    lines.push(`export const ${ident(v.id)}: VideoAsset = {`);
    lines.push(`  alt: ${JSON.stringify(v.alt)}, width: ${v.width}, height: ${v.height},`);
    lines.push(`  mp4: ${ident(v.id)}_mp4,${v.mobile ? ` mp4Mobile: ${ident(v.id)}_720,` : ''}${v.poster ? ` poster: ${ident(v.id)}_poster, posterWebp: ${ident(v.id)}_posterWebp,` : ''}`);
    lines.push('};');
  }
  // Slots with no optimized output yet export null so pages can render without them (`{media.x && ...}`).
  const have = new Set([...images.map((i) => i.id), ...videos.map((v) => v.id)]);
  for (const slot of SLOTS) {
    if (have.has(slot.id)) continue;
    lines.push(`export const ${ident(slot.id)}: ${slot.kind === 'video' ? 'VideoAsset' : 'ImageAsset'} | null = null; // not generated yet`);
  }
  const out = path.join(OUT, 'index.ts');
  if (!DRY) fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`${DRY ? 'would write' : 'wrote'} ${rel(out)} (${images.length} images, ${videos.length} videos)`);
}

// ---- Main ---------------------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ffmpeg = await resolveFfmpeg();
  console.log(`ffmpeg: ${ffmpeg ?? 'not available (videos will be copied as-is)'}\n`);
  const images: ImageResult[] = [];
  const videos: VideoResult[] = [];
  const skipped: string[] = [];
  for (const slot of SLOTS) {
    if (ONLY && !ONLY.includes(slot.id)) {
      // keep previously optimized slots in the index by probing their outputs
      const probe = slot.kind === 'video' ? path.join(OUT, `${slot.id}.mp4`) : path.join(OUT, `${slot.id}-${slot.web.widths[0]}.jpg`);
      if (!fs.existsSync(probe)) { skipped.push(slot.id); continue; }
    }
    const src = sourceFor(slot);
    if (!src) {
      const probe = slot.kind === 'video' ? path.join(OUT, `${slot.id}.mp4`) : path.join(OUT, `${slot.id}-${slot.web.widths[0]}.jpg`);
      if (!fs.existsSync(probe)) { skipped.push(slot.id); console.log(`  ${slot.id}: no source yet, skipped`); continue; }
    }
    console.log(`${slot.id} (${slot.kind})`);
    if (slot.kind === 'video') videos.push(await doVideo(slot, src ?? path.join(OUT, `${slot.id}.mp4`), src ? ffmpeg : null));
    else {
      const r = await doImage(slot, src ?? path.join(OUT, `${slot.id}-${slot.web.widths[0]}.jpg`));
      if (r) images.push(r);
    }
  }
  writeIndex(images, videos);
  if (!DRY) fs.writeFileSync(STAMP, JSON.stringify(stamp, null, 2) + '\n');
  if (skipped.length) console.log(`\nSkipped (no source): ${skipped.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
