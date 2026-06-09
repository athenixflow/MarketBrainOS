
import { AngleMinerResults, TestLabResults, AuditResult, ToolAnalysisResult, ResultItem, PaymentRecord } from '../types';

// Result items are either plain strings (legacy) or structured { insight, evidence, action }.
// These flatten them for each export format.
const itemToText = (item: ResultItem): string => {
  if (typeof item === 'string') return item;
  const parts = [item.insight || ''];
  if (item.evidence) parts.push(`Why: ${item.evidence}`);
  if (item.action) parts.push(`Action: ${item.action}`);
  return parts.filter(Boolean).join(' — ');
};
const itemToHtml = (item: ResultItem, esc: (s: string) => string): string => {
  if (typeof item === 'string') return `<li>${esc(item)}</li>`;
  const why = item.evidence ? `<div style="color:#555;margin-top:4px"><strong>Why it matters:</strong> ${esc(item.evidence)}</div>` : '';
  const act = item.action ? `<div style="color:#111;margin-top:4px"><strong>Do this:</strong> ${esc(item.action)}</div>` : '';
  return `<li><strong>${esc(item.insight || '')}</strong>${why}${act}</li>`;
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

export const downloadAsText = (filename: string, text: string) => {
  const element = document.createElement('a');
  const file = new Blob([text], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = `${filename}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

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
export const downloadAsCSV = (filename: string, rows: (string | number)[][]) => {
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['﻿' + rowsToCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const element = document.createElement('a');
  element.href = URL.createObjectURL(blob);
  element.download = `${filename}.csv`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

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

export const printAsPDF = (title: string, content: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: auto; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 10px; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; color: #666; }
          p { margin-bottom: 15px; }
          .section { margin-bottom: 40px; }
          .meta { font-size: 12px; color: #999; margin-bottom: 40px; }
          pre { white-space: pre-wrap; font-family: sans-serif; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">MarketBrainOS Intelligence Report | Generated: ${new Date().toLocaleDateString()}</div>
        <div class="section">
          <pre>${content}</pre>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

/** Structured print/PDF for a universal result: summary + each section as a headed list. */
export const printToolResultPDF = (title: string, result: ToolAnalysisResult) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

  const meta: string[] = [];
  if (typeof result.score === 'number') meta.push(`Score: ${result.score}/100`);
  if (result.verdict) meta.push(`Verdict: ${esc(result.verdict)}`);

  const sectionsHtml = (result.sections || []).map(section => `
    <div class="section">
      <h2>${esc(section.title)}</h2>
      <ul>${(section.items || []).map(item => itemToHtml(item, esc)).join('')}</ul>
    </div>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: auto; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 10px; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; color: #666; }
          ul { margin: 10px 0 0; padding-left: 20px; }
          li { margin-bottom: 8px; font-size: 14px; }
          .meta { font-size: 12px; color: #999; margin-bottom: 24px; }
          .badges { font-size: 13px; font-weight: bold; color: #111; margin-bottom: 20px; }
          .summary { font-size: 14px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>${esc(title)}</h1>
        <div class="meta">MarketBrainOS Intelligence Report | Generated: ${new Date().toLocaleDateString()}</div>
        ${meta.length ? `<div class="badges">${meta.join(' &nbsp;•&nbsp; ')}</div>` : ''}
        ${result.summary ? `<div class="section"><h2>Executive Summary</h2><p class="summary">${esc(result.summary)}</p></div>` : ''}
        ${sectionsHtml}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

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

  return output;
};

export const formatTestLabExport = (results: TestLabResults): string => {
  const winner = results.variants.find(v => v.label === results.winnerLabel);
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
  
  output += "KEY CONVERSION ISSUES\n";
  result.issues.forEach(i => {
    output += `- Issue: ${i.blocker}\n  Impact: ${i.impact}\n\n`;
  });
  
  output += "RECOMMENDED FIXES\n";
  result.fixes.forEach(f => {
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

  result.sections.forEach(section => {
    output += `${section.title.toUpperCase()}\n`;
    section.items.forEach(item => { output += `- ${itemToText(item)}\n`; });
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
