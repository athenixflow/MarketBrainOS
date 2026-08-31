import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
    body: 'Each analysis consumes tokens. Free accounts get a one-time starting allowance, while Pro refills your balance every month and lets you top up any time. Tokens are only charged when an analysis completes successfully.',
  },
  {
    eyebrow: 'Your Tools',
    title: 'Find the right tool fast',
    body: 'Browse tools from the sidebar or your dashboard, grouped by suite. Every result can be saved, exported, shared, rerun, or revisited later from your Analysis History.',
  },
  {
    eyebrow: 'Get Started',
    title: 'Run your first analysis',
    body: 'The fastest way to see value is to try a tool. Strategy Lab is a great place to start, and it can pressure-test any idea in under a minute.',
  },
];

const OnboardingOverlay: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const reduce = useReducedMotion();

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
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0B0B]/95 backdrop-blur-md p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white text-[#0B0B0B] max-w-lg w-full p-10 sm:p-12 rounded-2xl shadow-2xl relative"
      >
        <button
          onClick={() => finish(false)}
          className="absolute top-8 right-8 text-[11px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
        >
          Skip
        </button>

        {/* Step position, so the reader knows how long this takes. */}
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-8">
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Content swaps in place; motion communicates the step transition. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-8 h-[2px] bg-[#FF0000] rounded-full mb-6" />
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-4 leading-tight">{current.title}</h2>
            <p className="text-[15px] text-gray-600 leading-relaxed">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bars double as jump targets. */}
        <div className="flex items-center gap-2 mt-10 mb-8">
          {STEPS.map((s, i) => (
            <button
              key={s.eyebrow}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              aria-current={i === step ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-10 bg-[#FF0000]' : 'w-4 bg-gray-200 hover:bg-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-[11px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            Back
          </button>
          {isLast ? (
            <PrimaryButton onClick={() => finish(true)} className="!px-10">Run first analysis</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setStep((s) => s + 1)} className="!px-10">Next</PrimaryButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingOverlay;
