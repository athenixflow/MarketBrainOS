// Shared guided-analysis components (Section 1). Used by ToolPage (the 10 generic tools) and the
// bespoke tool pages so every tool presents the same experience: an expected-outcome panel, a
// pre-submission analysis preview, and a staged Queued → Running → Completed progress indicator.

import React from 'react';

// Dark panel summarizing what the analysis produces + how long it takes. Sits on the dark page,
// above the white input/result cards.
export const ExpectedOutcome: React.FC<{
  outcomes: string[];
  estimatedTime?: string;
  analyzes?: string;
}> = ({ outcomes, estimatedTime, analyzes }) => (
  <div className="bg-[#121212] border border-gray-900 rounded-[32px] p-8 lg:p-10">
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">What this analysis generates</p>
      {estimatedTime && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Est. {estimatedTime}</span>}
    </div>
    {analyzes && <p className="text-sm text-gray-400 font-medium leading-relaxed mb-6">{analyzes}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {outcomes.map((o) => (
        <div key={o} className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF0000] shrink-0" />
          <span className="text-sm font-medium text-gray-200">{o}</span>
        </div>
      ))}
    </div>
  </div>
);

// Pre-submission summary shown inside the input card, just above the run button.
export const AnalysisPreview: React.FC<{
  inputs: { label: string; value: string }[];
  analysisType: string;
  deliverables: number;
  cost: number;
}> = ({ inputs, analysisType, deliverables, cost }) => {
  const filled = inputs.filter((i) => i.value && i.value.trim().length > 0);
  return (
    <div className="mb-8 p-6 rounded-2xl bg-gray-50 border border-gray-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Analysis Preview</p>
      <div className="space-y-2 mb-5">
        {filled.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium">Fill in the inputs to preview your analysis.</p>
        ) : filled.slice(0, 5).map((i) => (
          <div key={i.label} className="flex justify-between gap-4 text-xs">
            <span className="font-bold text-gray-500 uppercase tracking-widest shrink-0">{i.label}</span>
            <span className="text-gray-600 font-medium truncate text-right">{i.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        <span>{analysisType} • {deliverables} deliverables</span>
        <span className="text-[#0B0B0B]">{cost} {cost === 1 ? 'Token' : 'Tokens'}</span>
      </div>
    </div>
  );
};

export type RunStage = 'queued' | 'running' | 'completed';

// Staged progress indicator (replaces a bare spinner during a run).
export const RunProgress: React.FC<{ stage: RunStage; isTakingLong?: boolean }> = ({ stage, isTakingLong }) => {
  const steps: RunStage[] = ['queued', 'running', 'completed'];
  const labels: Record<RunStage, string> = { queued: 'Queued', running: 'Running', completed: 'Completed' };
  const idx = steps.indexOf(stage);
  return (
    <div className="py-20 flex flex-col items-center animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-colors ${i < idx ? 'bg-green-500' : i === idx ? 'bg-[#FF0000] animate-pulse' : 'bg-gray-200'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-widest ${i <= idx ? 'text-gray-500' : 'text-gray-300'}`}>{labels[s]}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-12 h-[2px] -mt-5 ${i < idx ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">
        {stage === 'queued' ? 'Preparing analysis…' : stage === 'running' ? 'Running deep analysis…' : 'Analysis complete'}
      </p>
      {isTakingLong && stage === 'running' && (
        <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in">This is taking longer than usual. Still working…</p>
      )}
    </div>
  );
};

// Character counter for text inputs.
export const CharCounter: React.FC<{ value: string; max: number }> = ({ value, max }) => (
  <div className="-mt-10 mb-8 flex justify-end">
    <span className={`text-[10px] font-bold uppercase tracking-widest ${value.length > max ? 'text-[#FF0000]' : 'text-gray-300'}`}>
      {value.length} / {max}
    </span>
  </div>
);
