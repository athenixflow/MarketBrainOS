import React from 'react';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import { STATUS, STATE_LABEL, ServiceState } from '../config/status';

/**
 * `/status` (GTM part 14 §8.2, gate G7) — where somebody goes when a tool stops answering.
 *
 * It reports what a person last wrote in config/status.ts, and it says that, with the time. The
 * state is never colour alone: each carries a glyph and its label.
 */

const TONE: Record<ServiceState, { dot: string; glyph: string }> = {
  operational: { dot: 'bg-green-500', glyph: '✓' },
  degraded: { dot: 'bg-yellow-500', glyph: '!' },
  outage: { dot: 'bg-red-600', glyph: '✕' },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

const Status: React.FC = () => {
  const tone = TONE[STATUS.state];
  return (
    <PublicLayout>
      <Seo title="Service status" description="Current service status for MarketBrain OS, and past incidents." path="/status" />
      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-3xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Status</span>
        <h1 className="text-4xl font-bold text-white mb-10 leading-tight">Service status</h1>

        <div role="status" className="border border-gray-800 rounded-2xl p-6 mb-4 flex items-start gap-4">
          <span aria-hidden="true" className={`mt-1 w-6 h-6 rounded-full ${tone.dot} text-[#0B0B0B] text-xs font-black flex items-center justify-center shrink-0`}>
            {tone.glyph}
          </span>
          <div>
            <p className="text-white text-xl font-bold">{STATE_LABEL[STATUS.state]}</p>
            <p className="text-gray-400 mt-1">{STATUS.message}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-16">
          Last updated {when(STATUS.updated)}. This page is updated by hand, not by an automatic monitor — if a tool is
          failing for you and this still says operational, tell us at{' '}
          <a href="mailto:support@marketbrainos.app" className="text-gray-300 underline">support@marketbrainos.app</a>.
        </p>

        <h2 className="text-2xl font-bold text-white mb-6">Past incidents</h2>
        {STATUS.incidents.length === 0 ? (
          <p className="text-gray-400">None recorded.</p>
        ) : (
          <ul className="space-y-6">
            {STATUS.incidents.map((i) => (
              <li key={i.started} className="border-b border-gray-900 pb-6">
                <p className="text-white font-bold">{i.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {when(i.started)} — {i.resolved ? `resolved ${when(i.resolved)}` : 'ongoing'}
                </p>
                <p className="text-gray-400 mt-2">{i.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </AnimatedSection>
    </PublicLayout>
  );
};

export default Status;
