import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from './UI';
import { useAuth } from '../context/AuthContext';
import { setOnboarded } from '../services/persistenceService';

interface Step {
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    eyebrow: 'Welcome',
    title: 'Welcome to MarketBrain OS',
    body: 'Your operating system for business decision-making. Turn raw ideas, campaigns, and funnels into clear, actionable strategic intelligence.',
  },
  {
    eyebrow: 'The Platform',
    title: 'One connected intelligence suite',
    body: 'Thirteen specialized AI tools across Marketing, Sales, Business Strategy, and Operations. Each analysis follows the same rigorous, structured format so results are easy to compare and act on.',
  },
  {
    eyebrow: 'Tokens',
    title: 'How tokens work',
    body: 'Each analysis consumes tokens. Free accounts start with a small allowance; Pro gives you 200 tokens every month plus the ability to top up ($5 = 100 tokens). Tokens are only charged when an analysis completes successfully.',
  },
  {
    eyebrow: 'Your Tools',
    title: 'Find the right tool fast',
    body: 'Browse tools from the sidebar or your dashboard, grouped by suite. Every result can be saved, exported, shared, rerun, or revisited later from your Analysis History.',
  },
  {
    eyebrow: 'Get Started',
    title: 'Run your first analysis',
    body: 'The fastest way to see value is to try a tool. Strategy Lab is a great place to start — pressure-test any idea in under a minute.',
  },
];

const OnboardingOverlay: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = async (goToTool: boolean) => {
    setClosing(true);
    if (user) {
      try { await setOnboarded(user.uid); await refreshProfile(); } catch { /* best-effort */ }
    }
    if (goToTool) navigate('/strategy-lab');
  };

  if (closing) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0B0B]/95 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="bg-white text-[#0B0B0B] max-w-lg w-full p-12 rounded-[40px] shadow-2xl relative">
        <button
          onClick={() => finish(false)}
          className="absolute top-8 right-10 text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
        >
          Skip
        </button>

        <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.4em] mb-6">{current.eyebrow}</p>
        <h2 className="text-3xl font-bold tracking-tight mb-6 leading-tight">{current.title}</h2>
        <p className="text-gray-500 font-medium leading-relaxed mb-10">{current.body}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[#FF0000]' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors disabled:opacity-0"
          >
            Back
          </button>
          {isLast ? (
            <PrimaryButton onClick={() => finish(true)} className="!px-10">Run First Analysis</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setStep((s) => s + 1)} className="!px-10">Next</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
