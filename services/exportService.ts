
import { AngleMinerResults, TestLabResults, AuditResult } from '../types';

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

export const formatAngleMinerExport = (results: AngleMinerResults): string => {
  let output = "ANGLEMINER X: STRATEGIC MARKETING ANGLES\n\n";

  output += "PRIME ANGLES\n";
  results.prime.forEach(a => {
    output += `- ${a.title}\n  Hook: "${a.improved || a.hook}"\n  Rationale: ${a.rational}\n\n`;
  });

  output += "SUPPORTING ANGLES\n";
  results.supporting.forEach(a => {
    output += `- ${a.title}\n  Hook: "${a.improved || a.hook}"\n  Rationale: ${a.rational}\n\n`;
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
