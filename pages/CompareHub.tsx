import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import { COMPETITORS, isPublishable } from '../config/pseo/competitors';

/**
 * `/compare` — the hub the comparison breadcrumbs point at (GTM part 10 §4.2).
 *
 * IT EXISTS BECAUSE THE BREADCRUMBS SAID IT DID. Each `/compare/<slug>` page emits a
 * BreadcrumbList whose second item is this URL; without the page that was structured data
 * pointing at a 404, which is worse than emitting none — it tells an engine the site has a
 * section and then denies it.
 *
 * IT FOLLOWS THE SAME VERIFICATION RULE as the pages it lists. A hub that indexes itself
 * while every comparison beneath it is unverified would route search traffic to figures
 * nobody stands behind, so with nothing publishable this page is noindex and says why.
 */
const CompareHub: React.FC = () => {
  const publishable = COMPETITORS.filter((c) => isPublishable(c));
  const pending = COMPETITORS.filter((c) => !isPublishable(c));

  return (
    <PublicLayout>
      <Seo
        title="Comparisons"
        description="How MarketBrain OS compares with general AI assistants for reviewing marketing work before you spend."
        path="/compare"
        noindex={publishable.length === 0}
      />

      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-4xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Comparisons</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          How this compares with what you already use
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-12 max-w-2xl">
          Most people weighing this up are already paying for a general AI assistant. These pages
          say what each one is genuinely better at before making any case for this, and link to
          the other side’s own pricing rather than quoting figures at you.
        </p>

        {publishable.length > 0 && (
          <ul className="space-y-4 mb-12">
            {publishable.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/compare/${c.slug}`}
                  className="block border border-gray-800 rounded-2xl px-6 py-5 hover:border-gray-600 transition-colors"
                >
                  <span className="text-white font-bold">MarketBrain OS vs {c.name}</span>
                  <span className="block text-sm text-gray-500 mt-1">
                    Checked {c.verifiedOn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="border border-gray-800 rounded-2xl px-6 py-5">
            <p className="text-white font-bold mb-2">
              {publishable.length === 0 ? 'These are being re-verified' : 'Also being re-verified'}
            </p>
            <p className="text-gray-500 text-sm">
              {pending.map((c) => c.name).join(', ')} — plans change without notice, so a comparison
              stays out of search until somebody has re-read the other side’s pricing page and dated
              it. In the meantime the quickest honest comparison is to run the same page through both.
            </p>
            <Link
              to="/tools/landing-page-score"
              className="inline-block mt-5 text-[#FF0000] font-bold text-sm uppercase tracking-widest"
            >
              Score a page free →
            </Link>
          </div>
        )}
      </AnimatedSection>
    </PublicLayout>
  );
};

export default CompareHub;
