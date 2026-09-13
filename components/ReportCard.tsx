// A saved report, with the actions its page never had.
//
// "Save as report" on a result wrote { score, verdict, summary, sections } to the reports
// collection, and both pages/Reports.tsx and components/team/TeamReports.tsx then rendered an
// inert card: a badge, a date and a title, with no way to open, export or delete what was saved
// (deleteReport existed with zero call sites). This card gives a report the same treatment History
// gives an analysis, from the same renderers and exporters, so the two cannot drift apart.

import React, { useState } from 'react';
import { Report, ToolAnalysisResult } from '../types';
import { Card, Badge, ConfirmTapButton } from './UI';
import { ResultItemList } from './ResultSections';
import { getScoreBand } from '../services/scoreBands';
import { downloadAsCSV, toolResultToCSV, exportResultPdf } from '../services/exportService';
import { deleteReport } from '../services/persistenceService';

const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

/** Saved report content is a ToolAnalysisResult when it came from an analysis; anything else is shown raw. */
const asResult = (content: any): ToolAnalysisResult | null =>
  content && Array.isArray(content.sections) ? { summary: content.summary || '', ...content } : null;

export const ReportCard: React.FC<{
  report: Report;
  /** Paid tiers / members only - see canExport in config/access.ts. */
  canExport: boolean;
  /** Only the creator may delete (mirrors the Firestore rule, so the button never fails silently). */
  canDelete: boolean;
  onDeleted?: (id: string) => void;
}> = ({ report, canExport, canDelete, onDeleted }) => {
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'fail'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const result = asResult(report.content);
  const date = report.created_at ? new Date(report.created_at) : null;
  const title = report.title || 'Untitled report';
  const fileBase = `${title.replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}_Report`;

  const exportPdf = async () => {
    if (!result) return;
    setPdf('busy');
    try { await exportResultPdf(title, result); setPdf('idle'); }
    catch { setPdf('fail'); setTimeout(() => setPdf('idle'), 3000); }
  };

  const remove = async () => {
    if (!report.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteReport(report.id);
      onDeleted?.(report.id);
    } catch (e: any) {
      // Only claim it is gone once the delete resolved.
      setDeleteError(e?.message || 'Could not delete this report.');
      setDeleting(false);
    }
  };

  return (
    <Card accent>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Badge tone="neutral">{report.report_type || 'Report'}</Badge>
        {date && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{date.toLocaleDateString()}</span>}
        {typeof result?.score === 'number' && (() => {
          const b = getScoreBand(result.score);
          return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border tabular-nums ${b.bgClass} ${b.textClass}`}>{result.score} · {b.band}</span>;
        })()}
        {result?.verdict && <Badge tone="dark">{result.verdict}</Badge>}
      </div>
      <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight leading-snug">{title}</h3>
      {result?.summary && !open && (
        <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2 mt-3">{result.summary}</p>
      )}

      <div className="flex items-center gap-5 flex-wrap pt-5 mt-5 border-t border-gray-100">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={rowAction}>{open ? 'Hide' : 'View'}</button>
        {result && canExport && (
          <>
            <button onClick={() => downloadAsCSV(fileBase, toolResultToCSV(result))} className={rowAction}>Export CSV</button>
            <button onClick={exportPdf} disabled={pdf === 'busy'} className={`${rowAction} ${pdf === 'fail' ? '!text-[#FF0000]' : ''} disabled:opacity-60`}>
              {pdf === 'busy' ? 'Preparing PDF…' : pdf === 'fail' ? 'PDF failed' : 'Export PDF'}
            </button>
          </>
        )}
        {canDelete && (
          <ConfirmTapButton onConfirm={remove} disabled={deleting} label={deleting ? 'Deleting…' : 'Delete'} className={`${rowAction} hover:!text-[#FF0000] disabled:opacity-60`} />
        )}
      </div>
      {deleteError && <p className="text-xs font-bold text-[#FF0000] mt-3">{deleteError}</p>}

      {open && (
        <div className="mt-6 space-y-6 animate-in fade-in duration-300">
          {result ? (
            <>
              {result.summary && <p className="text-sm text-gray-600 font-medium leading-relaxed">{result.summary}</p>}
              {result.sections.length === 0 && !result.summary && (
                <p className="text-sm text-gray-400 font-medium">This report has no saved detail sections.</p>
              )}
              {result.sections.map((section, si) => (
                <div key={si}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">{section.title}</p>
                  <ResultItemList items={section.items || []} compact />
                </div>
              ))}
            </>
          ) : (
            // A report type this card does not know how to lay out is still shown, not hidden.
            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-2xl p-4 border border-gray-100">{JSON.stringify(report.content ?? {}, null, 2)}</pre>
          )}
        </div>
      )}
    </Card>
  );
};

export default ReportCard;
