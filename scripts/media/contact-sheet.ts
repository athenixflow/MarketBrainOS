// Writes media-src/contact-sheet.html so every candidate can be compared side by side in a browser.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './env';
import { generatedSlots } from './manifest';
import type { MediaManifest } from './types';

const SRC = path.join(REPO_ROOT, 'media-src');
const manifestPath = path.join(SRC, 'manifest.json');
const manifest: MediaManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { version: 1, entries: [] };

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

const rows = generatedSlots()
  .map((slot) => {
    const entries = manifest.entries.filter((e) => e.slot === slot.id).sort((a, b) => a.n - b.n);
    const cells = entries
      .map((e) => {
        const rel = e.localPath ? path.relative(SRC, path.resolve(REPO_ROOT, e.localPath)).replace(/\\/g, '/') : '';
        let media: string;
        if (e.status !== 'success' || !rel) {
          media = '<div class="miss">' + esc(e.status) + (e.failMsg ? ': ' + esc(e.failMsg) : '') + '</div>';
        } else if (slot.kind === 'video') {
          media = '<video src="' + rel + '" muted autoplay loop playsinline controls></video>';
        } else {
          media = '<img src="' + rel + '" alt="">';
        }
        const isPick = (slot.pick ?? 1) === e.n;
        const secs = e.costTime ? Math.round(e.costTime / 1000) + 's' : '';
        return (
          '<figure class="cand' + (isPick ? ' picked' : '') + '">' + media +
          '<figcaption>#' + e.n + (isPick ? ' (current pick)' : '') + ' - ' + (e.creditsConsumed ?? '?') + ' credits ' + secs + '</figcaption></figure>'
        );
      })
      .join('');
    return (
      '<section><h2>' + esc(slot.id) + ' <small>' + slot.kind + ' - ' + slot.aspect + ' - ' + slot.resolution + '</small></h2>' +
      '<div class="row">' + (cells || '<div class="miss">no candidates yet</div>') + '</div>' +
      '<p class="prompt">' + esc(slot.prompt) + '</p></section>'
    );
  })
  .join('\n');

const html =
  '<!doctype html><meta charset="utf-8"><title>MarketBrainOS media candidates</title>\n' +
  '<style>\n' +
  'body{margin:0;padding:32px;background:#0b0b0b;color:#d1d5db;font:14px/1.5 system-ui,sans-serif}\n' +
  'h1{color:#fff;font-size:20px;margin:0 0 24px}h2{color:#fff;font-size:16px;margin:32px 0 12px}h2 small{color:#6b7280;font-weight:400;margin-left:8px}\n' +
  '.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}\n' +
  '.cand{margin:0;border:1px solid #1f2937;border-radius:16px;overflow:hidden;background:#111}.cand.picked{border-color:#ff0000}\n' +
  '.cand img,.cand video{display:block;width:100%;height:auto;background:#000}\n' +
  'figcaption{padding:8px 12px;font-size:12px;color:#9ca3af}.miss{padding:24px;color:#ef4444}\n' +
  '.prompt{color:#6b7280;font-size:12px;max-width:80ch}\n' +
  '</style><h1>MarketBrainOS media candidates</h1>' +
  '<p>Set <code>pick</code> per slot in <code>scripts/media/manifest.ts</code>, then run <code>npm run media:optimize</code>.</p>' +
  rows;

fs.mkdirSync(SRC, { recursive: true });
const out = path.join(SRC, 'contact-sheet.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(REPO_ROOT, out));
