
import { AngleMinerResults, TestLabResults, AuditResult, ToolAnalysisResult, ResultItem, PaymentRecord } from '../types';
import { asText } from './resultItems';
import { buildResultPdf, buildTextPdf } from './pdfReport';

// Result items are either plain strings (legacy) or structured { insight, evidence, action }.
// This flattens them for the text/CSV formats. The headline goes through the shared asText() rather
// than reading `insight` directly: reading one hardcoded key is what made an unrecognised shape
// export as an empty bullet, with no error anywhere to say so. (The PDF layout does its own
// flattening in services/pdfReport.ts, from the same asText.)
const itemToText = (item: ResultItem): string => {
  if (typeof item === 'string') return item;
  const parts = [asText(item)];
  if (item.evidence) parts.push(`Why: ${asText(item.evidence)}`);
  if (item.action) parts.push(`Action: ${asText(item.action)}`);
  return parts.filter(Boolean).join(' — ');
};

/**
 * Clean formatting for professional export.
 * Removes symbols, emojis, and excessive decoration.
 */

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

/**
 * Hands a file to the browser. One implementation for txt/csv/pdf so they cannot drift.
 *
 * The object URL is revoked on a delay rather than synchronously: iOS Safari starts the download
 * after the click returns, and revoking first hands it a dead URL. The `window.open` branch is for
 * WebViews without anchor-download support (in-app browsers), where showing the file inline with
 * the OS share sheet is the best available outcome.
 */
export const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const supportsDownload = typeof HTMLAnchorElement !== 'undefined' && 'download' in HTMLAnchorElement.prototype;
  if (supportsDownload) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadAsText = (filename: string, text: string) =>
  downloadBlob(`${filename}.txt`, new Blob([text], { type: 'text/plain;charset=utf-8' }));

// --- CSV EXPORT (§50) ---

/** RFC-4180 field escaping: quote fields containing comma, quote, or newline; double internal quotes. */
const escapeCSVField = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Serialize a 2D array of cells to a CSV string (one row per inner array). */
export const rowsToCSV = (rows: (string | number)[][]): string =>
  rows.map(row => row.map(escapeCSVField).join(',')).join('\r\n');

/** Trigger a .csv download from a 2D array of cells. */
export const downloadAsCSV = (filename: string, rows: (string | number)[][]) =>
  // Prepend BOM so Excel reads UTF-8 correctly.
  downloadBlob(`${filename}.csv`, new Blob(['﻿' + rowsToCSV(rows)], { type: 'text/csv;charset=utf-8;' }));

/** Flatten a universal ToolAnalysisResult into CSV rows (Section,Item). */
export const toolResultToCSV = (result: ToolAnalysisResult): (string | number)[][] => {
  const rows: (string | number)[][] = [['Section', 'Item']];
  if (typeof result.score === 'number') rows.push(['Score', `${result.score}/100`]);
  if (result.verdict) rows.push(['Verdict', result.verdict]);
  if (result.summary) rows.push(['Executive Summary', result.summary]);
  (result.sections || []).forEach(section => {
    (section.items || []).forEach(item => rows.push([section.title, itemToText(item)]));
  });
  return rows;
};

/** Flatten payment/billing history into CSV rows. */
export const paymentsToCSV = (records: PaymentRecord[]): (string | number)[][] => {
  const rows: (string | number)[][] = [['Date', 'Reference', 'Type', 'Amount (USD)', 'Tokens', 'Provider', 'Status']];
  records.forEach(p => {
    const date = p.created_at?.toMillis ? new Date(p.created_at.toMillis()).toISOString() : '';
    rows.push([
      date,
      p.payment_reference || '',
      (p as any).type || 'top_up',
      p.amount_paid ?? '',
      p.tokens_credited ?? '',
      p.provider || '',
      p.status || 'completed',
    ]);
  });
  return rows;
};

/**
 * "Export PDF" builds real PDF bytes (services/pdfReport.ts) and downloads them.
 *
 * This replaces a hidden-iframe `contentWindow.print()` that depended on the OS print dialog. On
 * WebKit - every browser on iOS - print() invoked on a child frame prints the PARENT page, so phones
 * produced a PDF of the app shell instead of the report. Generating the file removes the print
 * dialog from the path entirely, which is what makes the result the same on every device, and lets
 * scripts/pdf.test.ts assert on the bytes. Do not reintroduce a print()-based path here.
 *
 * Async because jsPDF is fetched on first use. Failures are logged with the report title and
 * rethrown so the calling button can show them instead of doing nothing.
 */
const exportPdf = async (title: string, build: () => Promise<ArrayBuffer>): Promise<void> => {
  try {
    const bytes = await build();
    const slug = title.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    downloadBlob(`${slug}.pdf`, new Blob([bytes], { type: 'application/pdf' }));
  } catch (e) {
    console.error(`PDF export failed for "${title}":`, e);
    throw e;
  }
};

/** Structured PDF for a universal result: summary + each section as a headed list. */
export const exportResultPdf = (title: string, result: ToolAnalysisResult): Promise<void> =>
  exportPdf(title, () => buildResultPdf(title, result));

/** PDF from an already-formatted plain-text report (the bespoke pages' formatters below). */
export const exportTextPdf = (title: string, text: string): Promise<void> =>
  exportPdf(title, () => buildTextPdf(title, text));

export const formatAngleMinerExport = (results: AngleMinerResults): string => {
  let output = "ANGLEMINER X: STRATEGIC MARKETING ANGLES\n\n";

  const angles = results.angles || [];
  // Group by angle type for a readable report.
  const byType: Record<string, typeof angles> = {};
  angles.forEach(a => {
    const t = a.type || 'Emotional';
    (byType[t] = byType[t] || []).push(a);
  });

  Object.keys(byType).forEach(type => {
    output += `${type.toUpperCase()} ANGLES\n`;
    byType[type].forEach(a => {
      output += `- ${a.title}\n  Hook: "${a.improved || a.hook}"\n  Rationale: ${a.rational}\n\n`;
    });
  });

  // Hooks were previously omitted from every export, so users could not take away the platform-ready
  // variations they had spent tokens generating.
  const hooks = results.hooks || [];
  if (hooks.length > 0) {
    output += `\nPLATFORM-READY HOOKS\n`;
    hooks.forEach(h => {
      const label = [h.channel, h.platform].filter(Boolean).join(' · ') || 'General';
      output += `- [${label}] "${h.short}"\n  ${h.expanded}\n\n`;
    });
  }

  return output;
};

export const formatTestLabExport = (results: TestLabResults): string => {
  const winner = (results.variants || []).find(v => v.label === results.winnerLabel);
  let output = "TESTLAB PRO: PERFORMANCE PREDICTION REPORT\n\n";
  
  output += `PROJECTED WINNER: ${results.winnerLabel}\n`;
  output += `WINNING SCORE: ${winner?.score}\n\n`;
  
  output += "VARIANT CONTENT:\n";
  output += `"${winner?.text}"\n\n`;
  
  output += "EXPLANATION:\n";
  output += results.explanation + "\n";
  
  return output;
};

export const formatConversionDoctorExport = (result: AuditResult): string => {
  let output = "CONVERSION DOCTOR ELITE: DIAGNOSTIC AUDIT\n\n";
  
  output += `FINAL CONVERSION GRADE: ${result.score}\n\n`;
  
  output += "EXECUTIVE SUMMARY\n";
  output += result.summary + "\n\n";
  
  // Guarded: a missing issues/fixes array previously threw mid-export, so the user got no file at all.
  const issues = result.issues || [];
  const fixes = result.fixes || [];

  output += "KEY CONVERSION ISSUES\n";
  output += issues.length === 0 ? "None identified.\n\n" : "";
  issues.forEach(i => {
    output += `- Issue: ${i.blocker}\n  Impact: ${i.impact}\n\n`;
  });

  output += "RECOMMENDED FIXES\n";
  output += fixes.length === 0 ? "None identified.\n\n" : "";
  fixes.forEach(f => {
    output += `- Action: ${f.what}\n  Implementation: ${f.how}\n  Result: ${f.expectedResult}\n\n`;
  });
  
  if (result.rewrites && result.rewrites.length > 0) {
    output += "REWRITTEN ASSETS\n";
    result.rewrites.forEach(r => {
      output += `${r.label.toUpperCase()}:\n"${r.text}"\n\n`;
    });
  }
  
  return output;
};

export const formatToolResult = (title: string, result: ToolAnalysisResult): string => {
  let output = `${title.toUpperCase()}\n\n`;
  if (typeof result.score === 'number') output += `SCORE: ${result.score}/100\n`;
  if (result.verdict) output += `VERDICT: ${result.verdict}\n`;
  if (result.score !== undefined || result.verdict) output += `\n`;

  if (result.summary) {
    output += "EXECUTIVE SUMMARY\n";
    output += result.summary + "\n\n";
  }

  (result.sections || []).forEach(section => {
    output += `${section.title.toUpperCase()}\n`;
    (section.items || []).forEach(item => { output += `- ${itemToText(item)}\n`; });
    output += "\n";
  });

  return output;
};

export const formatWorkflowExport = (data: {
  angle: string, 
  testScore: number, 
  conversionScore: number, 
  finalAssets: { headline: string, cta: string, offer: string } 
}): string => {
  let output = "WORKFLOW ENGINE: INTEGRATED STRATEGY SUMMARY\n\n";
  
  output += "WINNING STRATEGIC ANGLE\n";
  output += `"${data.angle}"\n\n`;
  
  output += "PERFORMANCE BENCHMARKS\n";
  output += `- Simulation Score: ${data.testScore}\n`;
  output += `- Conversion Health: ${data.conversionScore}\n\n`;
  
  output += "FINAL IMPROVED MESSAGING\n";
  output += `HEADLINE: ${data.finalAssets.headline}\n`;
  output += `CALL TO ACTION: ${data.finalAssets.cta}\n`;
  output += `LEAD OFFER: ${data.finalAssets.offer}\n`;
  
  return output;
};
