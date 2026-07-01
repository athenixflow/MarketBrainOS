// Renders a DocArticle's structured blocks into the house design system.
// Inline text supports **bold**, `code`, and [label](/path) links.

import React from 'react';
import { Link } from 'react-router-dom';
import { DocBlock, DocBlockTone } from '../../config/docs/types';
import { scrollToHeading } from './useScrollSpy';

// --- Inline markdown-lite renderer --------------------------------------------------------------

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

export const renderInline = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++} className="font-bold text-[#0B0B0B]">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<code key={key++} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[#0B0B0B] text-[13px] font-mono">{m[3]}</code>);
    } else if (m[4] !== undefined && m[5] !== undefined) {
      const to = m[5];
      nodes.push(
        <Link key={key++} to={to} className="text-[#FF0000] font-semibold hover:opacity-70 underline decoration-[#FF0000]/30 underline-offset-2 transition-opacity">
          {m[4]}
        </Link>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// --- Callout tones ------------------------------------------------------------------------------

const TONE: Record<DocBlockTone, { box: string; label: string; dot: string; defaultTitle: string }> = {
  info:    { box: 'bg-blue-50 border-blue-100',     label: 'text-blue-700',   dot: 'bg-blue-500',   defaultTitle: 'Note' },
  tip:     { box: 'bg-green-50 border-green-100',    label: 'text-green-700',  dot: 'bg-green-500',  defaultTitle: 'Tip' },
  warning: { box: 'bg-amber-50 border-amber-100',    label: 'text-amber-700',  dot: 'bg-amber-500',  defaultTitle: 'Heads up' },
  danger:  { box: 'bg-red-50 border-red-100',        label: 'text-red-600',    dot: 'bg-red-500',    defaultTitle: 'Important' },
};

// --- Block renderer -----------------------------------------------------------------------------

const Block: React.FC<{ block: DocBlock }> = ({ block }) => {
  switch (block.type) {
    case 'heading':
      return (
        <h2 id={block.id} className="scroll-mt-28 group flex items-center gap-3 text-xl lg:text-2xl font-bold tracking-tight text-[#0B0B0B] mt-14 first:mt-0 mb-5">
          <span className="w-6 h-[2px] bg-[#FF0000] rounded-full shrink-0" />
          {/* preventDefault: under HashRouter a native #id jump would clobber the route hash. */}
          <a href={`#${block.id}`} onClick={(e) => { e.preventDefault(); scrollToHeading(block.id); }} className="hover:opacity-70 transition-opacity">{block.text}</a>
        </h2>
      );

    case 'paragraph':
      return <p className="text-[15px] leading-relaxed text-gray-600 mb-5">{renderInline(block.text)}</p>;

    case 'list':
      return block.ordered ? (
        <ol className="list-decimal pl-5 space-y-2 mb-6 marker:text-[#FF0000] marker:font-bold">
          {block.items.map((it, i) => <li key={i} className="text-[15px] leading-relaxed text-gray-600 pl-1">{renderInline(it)}</li>)}
        </ol>
      ) : (
        <ul className="list-disc pl-5 space-y-2 mb-6 marker:text-[#FF0000]">
          {block.items.map((it, i) => <li key={i} className="text-[15px] leading-relaxed text-gray-600 pl-1">{renderInline(it)}</li>)}
        </ul>
      );

    case 'steps':
      return (
        <ol className="space-y-4 mb-8 mt-2">
          {block.items.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-[#0B0B0B] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div className="pt-0.5">
                <p className="text-[15px] font-bold text-[#0B0B0B] leading-snug">{renderInline(s.title)}</p>
                {s.text && <p className="text-[14px] text-gray-500 leading-relaxed mt-1">{renderInline(s.text)}</p>}
              </div>
            </li>
          ))}
        </ol>
      );

    case 'callout': {
      const tone = TONE[block.tone || 'info'];
      return (
        <div className={`border rounded-2xl p-5 mb-6 ${tone.box}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${tone.label}`}>{block.title || tone.defaultTitle}</span>
          </div>
          <p className="text-[14px] leading-relaxed text-gray-600">{renderInline(block.text)}</p>
        </div>
      );
    }

    case 'table':
      return (
        <div className="mb-8 overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            {block.caption && <caption className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 pt-4 pb-2">{block.caption}</caption>}
            <thead>
              <tr className="bg-gray-50">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-5 py-3 border-b border-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-gray-50/40">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-5 py-3 text-[14px] leading-relaxed align-top border-b border-gray-50 ${ci === 0 ? 'font-semibold text-[#0B0B0B]' : 'text-gray-600'}`}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'keyValue':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {block.pairs.map((p, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{p.label}</p>
              <p className="text-[13px] font-bold text-[#0B0B0B] leading-snug">{renderInline(p.value)}</p>
            </div>
          ))}
        </div>
      );

    case 'code':
      return <pre className="mb-6 p-5 rounded-2xl bg-[#0B0B0B] text-gray-200 text-[13px] font-mono overflow-x-auto leading-relaxed">{block.text}</pre>;

    default:
      return null;
  }
};

const DocsBlocks: React.FC<{ blocks: DocBlock[] }> = ({ blocks }) => (
  <>{blocks.map((b, i) => <Block key={i} block={b} />)}</>
);

export default DocsBlocks;
