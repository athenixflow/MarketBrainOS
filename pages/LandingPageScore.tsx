import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import { functionsBaseUrl } from '../services/firebase';
import { track } from '../services/analytics';

/**
 * THE FREE SCORER (GTM part 10, DO-NEXT #10) — the one thing a stranger can try.
 *
 * Every other acquisition path in the plan ends at a signup form: a person who has seen
 * nothing work is asked to pay in effort first. This asks for a URL and gives back a real
 * score and the three biggest blockers, in public, with no account.
 *
 * WHAT IT HOLDS BACK, AND SAYS SO. The score and three blockers are the whole free
 * product and have to be useful alone, or this is bait. The rest — every blocker, the
 * fixes, the ready-to-paste rewrites — needs an account, and the page states that up
 * front rather than revealing it after somebody has waited.
 *
 * THE SERVER DECIDES EVERYTHING. This page holds no model, no scoring, no rate limit and
 * no idea what the limits are; it posts a URL and renders what comes back, including the
 * refusals. A client-side limit would be a suggestion.
 */
const LandingPageScore: React.FC = () => {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<PublicScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { track('landing_view', { page: '/tools/landing-page-score' }); }, []);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;
    setState('running');
    setError(null);
    setResult(null);
    track('free_tool_run', { has_scheme: /^https?:\/\//i.test(target) });
    try {
      const res = await fetch(`${functionsBaseUrl}/publicPageScore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        /* The server's own words: a per-IP limit, a daily ceiling and an unreadable page
           are three different problems, and only one of them is the visitor's to fix. */
        setError(String(data?.error || 'That did not work. Try again shortly.'));
        setState('error');
        return;
      }
      setResult(data as PublicScore);
      setState('done');
    } catch {
      setError('Could not reach the scorer. Check your connection and try again.');
      setState('error');
    }
  };

  return (
    <PublicLayout>
      <Seo
        title="Free landing page score | MarketBrain OS"
        description="Paste a URL and get a 0–100 conversion score with the three biggest blockers, free and without an account."
        path="/tools/landing-page-score"
      />

      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-4xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Free · no account</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Score a landing page before you spend on it.
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-2xl">
          Paste any public page. You get a 0–100 conversion score, a one-line verdict and the
          three most costly blockers — read from the live page, not guessed from the address.
        </p>

        <form onSubmit={run} className="flex flex-col sm:flex-row gap-4 mb-4">
          <label htmlFor="page-url" className="sr-only">Page address</label>
          <input
            id="page-url"
            type="url"
            inputMode="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourpage.com"
            className="flex-1 bg-[#121212] border border-gray-800 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <button
            type="submit"
            disabled={state === 'running' || !url.trim()}
            className="bg-[#FF0000] text-white px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest disabled:bg-gray-800 disabled:text-gray-600 transition-colors whitespace-nowrap"
          >
            {state === 'running' ? 'Reading the page…' : 'Score it'}
          </button>
        </form>
        <p className="text-xs text-gray-600 mb-16">
          Three pages a day, free. The full audit — every blocker, the fixes and ready-to-paste
          rewrites — is in the free account.
        </p>

        {state === 'running' && (
          <p className="text-gray-500" role="status">
            Fetching the page and reading it. This usually takes about twenty seconds.
          </p>
        )}

        {state === 'error' && error && (
          <div role="alert" className="border border-gray-800 rounded-2xl p-6 bg-[#121212]">
            <p className="text-white font-bold mb-2">That did not work</p>
            <p className="text-gray-500">{error}</p>
            <Link to="/auth" onClick={() => track('free_tool_unlock_clicked', { from: 'error' })}
              className="inline-block mt-5 text-[#FF0000] font-bold text-sm uppercase tracking-widest">
              Create a free account →
            </Link>
          </div>
        )}

        {state === 'done' && result && (
          <div className="border border-gray-800 rounded-2xl p-8 bg-[#121212]">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-6 break-all">
              {result.url}{result.cached ? ' · scored earlier today' : ''}
            </p>
            {result.score != null && (
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-7xl font-black text-[#FF0000] leading-none">{result.score}</span>
                <span className="text-xl text-gray-600">/100</span>
              </div>
            )}
            {result.summary && <p className="text-lg text-gray-300 mb-8">{result.summary}</p>}

            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">
              The three biggest blockers
            </p>
            <ol className="space-y-5 mb-10">
              {result.blockers.map((b, i) => (
                <li key={i} className="border-l-2 border-[#FF0000] pl-5">
                  <p className="text-white font-bold mb-1">{b.blocker}</p>
                  <p className="text-gray-500 text-sm">{b.impact}</p>
                </li>
              ))}
            </ol>

            {/*
              THE ASK, AFTER THE VALUE. Somebody who has just read three real problems with
              their page has a reason to want the rest; asking before would have been a
              form in front of a promise.
            */}
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-400 mb-5">{result.more}</p>
              <Link
                to="/auth"
                onClick={() => track('free_tool_unlock_clicked', { from: 'result', score: result.score })}
                className="inline-block bg-white text-[#0B0B0B] px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest"
              >
                Get the full audit — free account
              </Link>
            </div>
          </div>
        )}
      </AnimatedSection>
    </PublicLayout>
  );
};

interface PublicScore {
  url: string;
  score: number | null;
  summary: string;
  blockers: Array<{ blocker: string; impact: string }>;
  more: string;
  cached?: boolean;
}

export default LandingPageScore;
