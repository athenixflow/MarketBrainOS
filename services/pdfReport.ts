// Builds the "Export PDF" document as real PDF bytes.
//
// Until this existed, "Export PDF" wrote the report into a hidden 1x1px iframe and called
// `contentWindow.print()`, relying on the user finding "Save as PDF" in the OS print dialog. That
// only ever worked on desktop: WebKit (every browser on iOS) prints the PARENT frame when print() is
// invoked on a child frame, so a phone produced a PDF of the app shell instead of the report. A file
// generated here has no print dialog in its path, which is the only way to behave the same on every
// device - and the only way the output can be checked in a test (scripts/pdf.test.ts).
//
// This module is deliberately free of `document`/`window` at module scope so it runs in Node under
// the test, and jsPDF is imported lazily inside the build functions so the initial bundle does not
// carry it - it is fetched as its own chunk the first time someone exports.

import type { ToolAnalysisResult, ResultItem } from '../types';
import { asText } from './resultItems';

// ---------------------------------------------------------------------------------------------
// Text safety
// ---------------------------------------------------------------------------------------------

// jsPDF's built-in fonts are WinAnsi (cp1252). Anything outside it - arrows, ticks, emoji, CJK -
// comes out as garbage glyphs, and AI output uses arrows and ticks freely. Map the ones with an
// obvious ASCII reading, then drop whatever is left that the encoding cannot represent.
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[→➜➡➔]/g, '->'],   // → ➜ ➡ ➔
  [/[←]/g, '<-'],                     // ←
  [/[⇒]/g, '=>'],                     // ⇒
  [/[✓✔✅☑]/g, '[x]'],  // ✓ ✔ ✅ ☑
  [/[✗✘❌]/g, '[ ]'],        // ✗ ✘ ❌
  [/[•●▪■‣⁃]/g, '-'], // • ● ▪ ■ ‣ ⁃ (bullets are drawn by the layout, not the text)
  [/[‘’‚′]/g, "'"],    // ‘ ’ ‚ ′
  [/[“”„″]/g, '"'],    // “ ” „ ″
  [/[–—―−]/g, '-'],    // – — ― −
  [/…/g, '...'],                      // …
  [/ /g, ' '],                        // nbsp
  [/™/g, '(TM)'],
];

/** Coerces text to what the PDF's fonts can render; exported for the test. */
export const sanitizeForPdf = (input: unknown): string => {
  let s = String(input ?? '');
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  // Latin-1 is the safe subset of cp1252; everything above it is either mapped above or dropped.
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  return s.replace(/[ \t]{2,}/g, ' ').trim();
};

// ---------------------------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------------------------

export type PdfBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string; tone?: 'body' | 'muted' | 'strong' }
  | { kind: 'item'; headline: string; lines?: string[] }   // lines hang under the headline
  | { kind: 'spacer'; pt: number };

const itemBlock = (item: ResultItem): PdfBlock => {
  if (typeof item === 'string') return { kind: 'item', headline: item };
  const lines: string[] = [];
  if (item.evidence) lines.push(`Why it matters: ${asText(item.evidence)}`);
  if (item.action) lines.push(`Do this: ${asText(item.action)}`);
  return { kind: 'item', headline: asText(item), lines };
};

/** The structured layout used by History and the generic tool pages. */
export const resultToBlocks = (result: ToolAnalysisResult): PdfBlock[] => {
  const blocks: PdfBlock[] = [];
  const badges: string[] = [];
  if (typeof result.score === 'number') badges.push(`Score: ${result.score}/100`);
  if (result.verdict) badges.push(`Verdict: ${result.verdict}`);
  if (badges.length) blocks.push({ kind: 'para', text: badges.join('   |   '), tone: 'strong' });

  if (result.summary) {
    blocks.push({ kind: 'heading', text: 'Executive Summary' });
    blocks.push({ kind: 'para', text: result.summary });
  }
  for (const section of result.sections || []) {
    blocks.push({ kind: 'heading', text: section.title });
    for (const item of section.items || []) blocks.push(itemBlock(item));
  }
  return blocks;
};

/**
 * The plain-text layout used by the four bespoke pages, which already format a string
 * (formatConversionDoctorExport and friends). Their convention: an ALL-CAPS line is a heading,
 * a "- " line is a bullet, "  " indented lines continue the bullet above, blank lines separate.
 */
export const textToBlocks = (text: string): PdfBlock[] => {
  const blocks: PdfBlock[] = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let para: string[] = [];
  let item: { headline: string; lines: string[] } | null = null;
  const flush = () => {
    if (item) blocks.push({ kind: 'item', headline: item.headline, lines: item.lines });
    if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
    item = null;
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const t = line.trim();
    const isHeading = t.length <= 80 && /[A-Z]/.test(t) && t === t.toUpperCase() && !/^[-"]/.test(t);
    if (isHeading) { flush(); blocks.push({ kind: 'heading', text: t }); continue; }
    if (/^- /.test(t)) { flush(); item = { headline: t.slice(2), lines: [] }; continue; }
    if (item) { item.lines.push(t); continue; }
    para.push(t);
  }
  flush();
  return blocks;
};

// ---------------------------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------------------------

const PAGE = { w: 595.28, h: 841.89 };   // A4 in pt
const MARGIN = 56;
const CONTENT_W = PAGE.w - MARGIN * 2;
const FOOTER_H = 28;
const BOTTOM = PAGE.h - MARGIN - FOOTER_H;

const FONT = 'helvetica';
const SIZES = { title: 18, meta: 9, heading: 11.5, body: 10.5, sub: 10, footer: 8 };
const LEADING = 1.4;

const lineH = (size: number) => size * LEADING;

type Doc = InstanceType<typeof import('jspdf').jsPDF>;

class Layout {
  y = MARGIN;
  constructor(private doc: Doc) {}

  private ensure(height: number) {
    if (this.y + height > BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  private wrap(text: string, size: number, width: number, style: 'normal' | 'bold'): string[] {
    this.doc.setFont(FONT, style);
    this.doc.setFontSize(size);
    return this.doc.splitTextToSize(text, width) as string[];
  }

  /**
   * Writes wrapped lines, breaking the page between lines when needed. A block that is longer
   * than a page (a 3,000-word summary) must still come out in full rather than overflowing the
   * bottom margin, so the check runs per line, not per block.
   */
  private lines(lines: string[], size: number, x: number, style: 'normal' | 'bold', gray = 0) {
    this.doc.setFont(FONT, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(gray, gray, gray);
    const h = lineH(size);
    for (const line of lines) {
      this.ensure(h);
      this.doc.text(line, x, this.y + size);   // jsPDF positions text by baseline
      this.y += h;
    }
  }

  title(text: string, meta: string) {
    this.lines(this.wrap(text, SIZES.title, CONTENT_W, 'bold'), SIZES.title, MARGIN, 'bold', 11);
    this.y += 4;
    this.lines([meta], SIZES.meta, MARGIN, 'normal', 130);
    this.y += 6;
    this.doc.setDrawColor(17, 17, 17);
    this.doc.setLineWidth(1.2);
    this.doc.line(MARGIN, this.y, MARGIN + CONTENT_W, this.y);
    this.y += 18;
  }

  heading(text: string) {
    // Keep a heading with at least two lines of what follows it.
    this.ensure(lineH(SIZES.heading) + lineH(SIZES.body) * 2 + 14);
    this.y += 10;
    this.lines(this.wrap(text.toUpperCase(), SIZES.heading, CONTENT_W, 'bold'), SIZES.heading, MARGIN, 'bold', 90);
    this.doc.setDrawColor(225, 225, 225);
    this.doc.setLineWidth(0.6);
    this.doc.line(MARGIN, this.y + 1, MARGIN + CONTENT_W, this.y + 1);
    this.y += 9;
  }

  para(text: string, tone: 'body' | 'muted' | 'strong') {
    const style = tone === 'strong' ? 'bold' : 'normal';
    const gray = tone === 'muted' ? 110 : tone === 'strong' ? 17 : 51;
    this.lines(this.wrap(text, SIZES.body, CONTENT_W, style), SIZES.body, MARGIN, style, gray);
    this.y += 6;
  }

  item(headline: string, sub: string[]) {
    const indent = 14;
    const width = CONTENT_W - indent;
    const head = this.wrap(headline, SIZES.body, width, 'bold');
    this.ensure(lineH(SIZES.body));
    // Bullet on the first line only; later lines of the same item hang under the text.
    this.doc.setFont(FONT, 'bold');
    this.doc.setFontSize(SIZES.body);
    this.doc.setTextColor(17, 17, 17);
    this.doc.text('-', MARGIN + 2, this.y + SIZES.body);
    this.lines(head, SIZES.body, MARGIN + indent, 'bold', 17);
    for (const line of sub) {
      this.lines(this.wrap(line, SIZES.sub, width, 'normal'), SIZES.sub, MARGIN + indent, 'normal', 80);
    }
    this.y += 5;
  }

  spacer(pt: number) { this.y += pt; }

  /** Runs last: the page count is only known once everything is laid out. */
  footers(label: string) {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFont(FONT, 'normal');
      this.doc.setFontSize(SIZES.footer);
      this.doc.setTextColor(150, 150, 150);
      const y = PAGE.h - MARGIN + 6;
      this.doc.text(label, MARGIN, y);
      this.doc.text(`Page ${i} of ${total}`, MARGIN + CONTENT_W, y, { align: 'right' });
    }
  }
}

const dateLabel = (): string =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Lays out `blocks` under `title` and returns the finished PDF bytes. */
export const renderPdf = async (title: string, blocks: PdfBlock[]): Promise<ArrayBuffer> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title: sanitizeForPdf(title), creator: 'MarketBrainOS' });

  const meta = `MarketBrainOS Intelligence Report  |  Generated ${dateLabel()}`;
  const layout = new Layout(doc);
  layout.title(sanitizeForPdf(title), meta);

  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': layout.heading(sanitizeForPdf(b.text)); break;
      case 'para':    layout.para(sanitizeForPdf(b.text), b.tone || 'body'); break;
      case 'item':    layout.item(sanitizeForPdf(b.headline), (b.lines || []).map(sanitizeForPdf).filter(Boolean)); break;
      case 'spacer':  layout.spacer(b.pt); break;
    }
  }
  layout.footers(meta);

  return doc.output('arraybuffer') as ArrayBuffer;
};

export const buildResultPdf = (title: string, result: ToolAnalysisResult): Promise<ArrayBuffer> =>
  renderPdf(title, resultToBlocks(result));

export const buildTextPdf = (title: string, text: string): Promise<ArrayBuffer> =>
  renderPdf(title, textToBlocks(text));
