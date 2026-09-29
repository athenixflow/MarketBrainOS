/**
 * ONE SCREEN, ONE QUESTION (GTM part 03 §4, experiment E03).
 *
 * This was five screens explaining the product — what it is, how many tools there are, how
 * tokens work, where to find things — and the fifth one said "try a tool". Every part of it
 * was true and none of it was value: the person still had to pick a tool, work out what it
 * wanted, and write a brief before anything happened. Time-to-value was the explanation
 * plus the form, and only the form produced a result.
 *
 * So it asks one question, and every answer lands on a tool with the fields already filled.
 * The token explanation did not need a screen of its own — it lives on the balance chip,
 * where somebody looks when the number matters to them.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { setOnboarded } from '../services/persistenceService';
import { track } from '../services/analytics';
import { ONBOARDING_EXAMPLES, OnboardingExample } from '../config/onboardingExamples';

const OnboardingOverlay: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const reduce = useReducedMotion();

  /* One screen, so one view event. The per-step event stays in the union because it still
     describes what happened: this overlay has one step. */
  useEffect(() => {
    track('onboarding_step_viewed', { step: 1, step_title: 'Pick a decision' });
  }, []);

  const close = async () => {
    setClosing(true);
    if (user) {
      try { await setOnboarded(user.uid); await refreshProfile(); } catch { /* best-effort */ }
    }
  };

  const pick = async (example: OnboardingExample) => {
    track('template_used', { template_id: example.id, tool_slug: example.path.replace('/', '') });
    track('onboarding_completed', { last_step: 1, to_tool: true, template_id: example.id });
    await close();
    /*
     * Router state, not a query string. The prefill is a page's starting input, not an
     * address: a URL carrying somebody's example copy would be shareable, bookmarkable and
     * indexable, none of which anybody wants. It is lost on refresh, which is correct —
     * a reload should give you the empty form you were about to fill in yourself.
     */
    navigate(example.path, { state: { exampleId: example.id } });
  };

  const skip = async () => {
    track('onboarding_completed', { last_step: 1, to_tool: false });
    await close();
  };

  if (closing) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0B0B]/95 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="paper bg-white text-[#0B0B0B] max-w-2xl w-full my-auto p-6 sm:p-8 rounded-2xl shadow-2xl relative"
      >
        <div className="w-8 h-[2px] bg-[#FF0000] rounded-full mb-6" />
        <h2 id="onboarding-title" className="text-2xl sm:text-3xl font-black tracking-tight mb-3 leading-tight">
          What are you deciding?
        </h2>
        <p className="text-[15px] text-gray-600 leading-relaxed mb-8">
          Pick the closest one and we will open it with an example already filled in, so you can see
          what a result looks like before writing anything. Swap in your own whenever you like.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {ONBOARDING_EXAMPLES.map((example) => (
            <button
              key={example.id}
              onClick={() => pick(example)}
              className="group text-left rounded-2xl border border-gray-200 hover:border-[#FF0000] hover:bg-[#FF0000]/[0.03] transition-colors p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000] focus-visible:ring-offset-2"
            >
              <p className="text-base font-bold tracking-tight mb-1">{example.title}</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">{example.blurb}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-[#FF0000] transition-colors tabular-nums">
                {example.toolLabel} · {example.cost} tokens
              </p>
            </button>
          ))}
        </div>

        <button
          onClick={skip}
          className="mt-6 text-[11px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
        >
          I&rsquo;ll start from scratch
        </button>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingOverlay;
