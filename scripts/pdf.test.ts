// Proves "Export PDF" produces a PDF whose text is the report - on any device, because the bytes
// are built here in Node with no browser, no iframe and no print dialog in the path.
//
// Background: the previous implementation printed a hidden iframe. On WebKit (every browser on
// iOS) that printed the PARENT page, so a phone got a PDF of the app shell instead of the report.
// Nothing could have caught that in a test because no PDF was ever produced. This can.
//
// Runs in `npm run build` (see package.json). `npm run test:pdf` runs it alone.

import { buildResultPdf, buildTextPdf, sanitizeForPdf } from '../services/pdfReport';
import { doctorResult } from '../services/bespokeMappers';
import { asText } from '../services/resultItems';
import { formatAngleMinerExport, formatConversionDoctorExport } from '../services/exportService';
import { ANGLE_MINER_FIXTURE, CONVERSION_DOCTOR_FIXTURE } from '../services/devFixtures';
import type { ToolAnalysisResult } from '../types';

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/** Whitespace-insensitive containment: jsPDF wraps lines and pdfjs splits them into items. */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const has = (haystack: string, needle: string) => squash(haystack).includes(squash(needle));

const extractText = async (buf: ArrayBuffer): Promise<{ text: string; pages: number }> => {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return { text, pages: pdf.numPages };
};

const SHELL_TEXT = ['Sign In', 'Start Free', 'MarketBrainOS Features Pricing', 'Reopen tool', 'Export CSV'];

const main = async () => {
  // ---- 1. History path for Conversion Doctor: Firestore doc -> mapper -> structured PDF -----------
  console.log('CONVERSION DOCTOR VIA HISTORY:');
  const doctor: ToolAnalysisResult = doctorResult({ audit_output: CONVERSION_DOCTOR_FIXTURE, conversion_score: 58 });
  const doctorPdf = await buildResultPdf('Conversion Doctor Report', doctor);
  ok(new TextDecoder("latin1").decode(new Uint8Array(doctorPdf, 0, 5)) === "%PDF-", "output is a PDF (header)");
  const d = await extractText(doctorPdf);
  ok(has(d.text, 'Conversion Doctor Report'), 'title present');
  ok(has(d.text, 'Score: 58/100'), 'score badge present');
  ok(has(d.text, CONVERSION_DOCTOR_FIXTURE.summary), 'executive summary present');
  for (const section of doctor.sections) {
    ok(has(d.text, section.title), `section heading "${section.title}"`);
    for (const item of section.items) {
      const head = asText(item);
      ok(has(d.text, head), `item "${head.slice(0, 50)}"`);
    }
  }
  const rewrites = doctor.sections.find((s) => /rewrite/i.test(s.title));
  ok(!!rewrites, 'History mapper carries the rewrites section');
  if (rewrites) {
    ok(rewrites.items.length === (CONVERSION_DOCTOR_FIXTURE.rewrites || []).length, 'one rewrite item per fixture rewrite');
    for (const rw of CONVERSION_DOCTOR_FIXTURE.rewrites || []) ok(has(d.text, rw.text), `rewrite text "${rw.text.slice(0, 40)}"`);
  }
  for (const shell of SHELL_TEXT) ok(!has(d.text, shell), `no app-shell text "${shell}" in the PDF`);

  // ---- 2. Generic tool result with structured items ------------------------------------------------
  console.log('\nGENERIC STRUCTURED RESULT:');
  const generic: ToolAnalysisResult = {
    score: 72,
    verdict: 'Promising',
    summary: 'The offer is strong but the proof is thin.',
    sections: [
      { title: 'Key strengths', items: [
        { insight: 'Clear outcome in the headline', evidence: 'Visitors know what they get in 3 seconds', action: 'Keep it above the fold' },
        'Plain string item survives',
      ] },
      { title: 'Risks', items: [{ insight: 'No testimonials near the CTA', action: 'Add two named quotes' }] },
    ],
  };
  const g = await extractText(await buildResultPdf('Offer Analyzer Report', generic));
  ok(has(g.text, 'Verdict: Promising'), 'verdict badge present');
  ok(has(g.text, 'Key strengths') && has(g.text, 'Risks'), 'both section headings present');
  ok(has(g.text, 'Why it matters: Visitors know what they get'), 'evidence line labelled');
  ok(has(g.text, 'Do this: Keep it above the fold'), 'action line labelled');
  ok(has(g.text, 'Plain string item survives'), 'string items render');
  ok(has(g.text, 'Add two named quotes'), 'action without evidence renders');

  // ---- 3. Text path used by the bespoke pages ---------------------------------------------------
  console.log('\nTEXT PATH (bespoke pages):');
  const angleText = formatAngleMinerExport(ANGLE_MINER_FIXTURE);
  const a = await extractText(await buildTextPdf('AngleMiner X Report', angleText));
  ok(has(a.text, 'STRATEGIC MARKETING ANGLES'), 'text-path heading present');
  for (const angle of ANGLE_MINER_FIXTURE.angles.slice(0, 3)) ok(has(a.text, angle.title), `angle "${angle.title}"`);
  ok(has(a.text, 'PLATFORM-READY HOOKS'), 'hooks section present');
  const doctorText = formatConversionDoctorExport(CONVERSION_DOCTOR_FIXTURE);
  const dt = await extractText(await buildTextPdf('Conversion Doctor Elite Diagnostic Report', doctorText));
  ok(has(dt.text, 'KEY CONVERSION ISSUES'), 'doctor text-path heading present');
  ok(has(dt.text, `Impact: ${CONVERSION_DOCTOR_FIXTURE.issues[0].impact}`), 'continuation lines kept under their bullet');

  // ---- 4. Pagination -------------------------------------------------------------------------------
  console.log('\nPAGINATION:');
  const long: ToolAnalysisResult = {
    summary: 'Long report. '.repeat(40),
    sections: Array.from({ length: 40 }, (_, i) => ({
      title: `Section ${i + 1}`,
      items: [{ insight: `Finding ${i + 1}: ${'detail '.repeat(20)}`, evidence: 'because '.repeat(15), action: 'do '.repeat(15) }],
    })),
  };
  const l = await extractText(await buildResultPdf('Long Report', long));
  ok(l.pages >= 2, `long input spans multiple pages (got ${l.pages})`);
  ok(has(l.text, `Page 2 of ${l.pages}`), 'footer shows page n of N');
  ok(has(l.text, 'Section 40') && has(l.text, 'Finding 40'), 'last section survives pagination');

  // ---- 5. Unicode that the built-in fonts cannot render -------------------------------------------
  console.log('\nUNICODE SAFETY:');
  ok(sanitizeForPdf('Go → win ✓ 🚀 done') === 'Go -> win [x] done', 'sanitizer maps arrows/ticks and drops emoji', JSON.stringify(sanitizeForPdf('Go → win ✓ 🚀 done')));
  ok(sanitizeForPdf('“Smart” — it’s 5… ') === '"Smart" - it\'s 5...', 'sanitizer normalises typographic punctuation', JSON.stringify(sanitizeForPdf('“Smart” — it’s 5… ')));
  const u = await extractText(await buildResultPdf('Unicode', { summary: 'Go → win ✓ 🚀 café naïve', sections: [] }));
  ok(has(u.text, 'Go -> win [x] café naïve'), 'rendered text is the sanitised form', u.text.slice(0, 200));
  ok(!/�/.test(u.text), 'no replacement characters in output');

  console.log(failures === 0 ? '\nPASS — PDF export produces the report, on every path.' : `\nFAILED — ${failures} assertion(s).`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
