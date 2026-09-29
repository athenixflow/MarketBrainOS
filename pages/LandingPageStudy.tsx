import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import { SITE_URL } from '../config/seo';
import { STUDY, STUDY_CSV, STUDY_PATH, SegmentSummary, isStudyPublished } from '../config/research/study';

/**
 * `/research/landing-page-study-2026` — the launch asset (GTM part 14 §1C, DO-NEXT #13).
 *
 * THE PRODUCT IS THE INSTRUMENT; THE FINDINGS ARE THE NEWS. So the page leads with what
 * the scores are NOT — an AI opinion about a page at a point in time, not conversion data —
 * before a single number, and the method and its limits are on the page rather than in a
 * PDF nobody opens. Every percentage is printed with what it is a percentage of.
 *
 * IT NAMES NO COMPANY (part 14 §8.1). Nothing on this page, in the JSON behind it, or in the
 * CSV it links to can identify a page: scripts/study/aggregate.ts publishes counts and
 * category ids only, and scripts/study.test.ts fails the build if that ever changes.
 *
 * UNPUBLISHED UNTIL A PERSON SAYS SO. With `published` false the route renders a holding
 * page with noindex and is left out of the prerender and the sitemap.
 */

const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

/* One single-series histogram. Two of these side by side (small multiples) rather than one
   chart with two colours: the comparison is "where does each distribution sit", which two
   panels on a shared axis answer without a categorical palette to decode. */
const Histogram: React.FC<{ title: string; s: SegmentSummary; max: number }> = ({ title, s, max }) => {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="border border-gray-800 rounded-2xl p-6">
      <figcaption className="flex items-baseline justify-between mb-5">
        <span className="text-white font-bold">{title}</span>
        <span className="text-xs text-gray-500 tabular-nums">n = {s.n} · median {s.median ?? '—'}</span>
      </figcaption>
      <div className="relative h-40 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {s.buckets.map((b, i) => (
          <div
            key={b.from}
            className="flex-1 h-full flex items-end cursor-default"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            tabIndex={0}
            aria-label={`${b.from} to ${b.to}: ${b.count} pages`}
          >
            <div
              className="w-full rounded-t-[4px] bg-[#FF0000]"
              style={{ height: `${max ? (b.count / max) * 100 : 0}%`, opacity: hover === null || hover === i ? 1 : 0.45 }}
            />
          </div>
        ))}
        {hover !== null && (
          <div className="absolute -top-2 left-0 right-0 text-center pointer-events-none">
            <span className="inline-block bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-1 text-xs text-white tabular-nums">
              Score {s.buckets[hover].from}–{s.buckets[hover].to}: {s.buckets[hover].count} {s.buckets[hover].count === 1 ? 'page' : 'pages'}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-2 tabular-nums border-t border-gray-800 pt-2">
        <span>0</span><span>50</span><span>100</span>
      </div>
    </figure>
  );
};

const HoldingPage: React.FC = () => (
  <PublicLayout>
    <Seo
      title="Landing page study 2026 — in preparation"
      description="An AI audit of 100 landing pages, with method and anonymised data. Being prepared."
      path={STUDY_PATH}
      noindex
    />
    <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-3xl mx-auto">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Research</span>
      <h1 className="text-4xl font-bold text-white mb-6 leading-tight">The landing page study is being prepared</h1>
      <p className="text-gray-400 leading-relaxed mb-8">
        We are auditing 100 landing pages and will publish the aggregate results here, with the full
        method, its limits, and the anonymised data. No company will be named.
      </p>
      <Link to="/tools/landing-page-score" className="text-[#FF0000] font-bold">Score your own page in the meantime →</Link>
    </AnimatedSection>
  </PublicLayout>
);

const LandingPageStudy: React.FC = () => {
  if (!isStudyPublished()) return <HoldingPage />;
  const { method, all, africa, global, gap, groups } = STUDY as Required<typeof STUDY>;
  const histMax = Math.max(...africa.buckets.map((b) => b.count), ...global.buckets.map((b) => b.count), 1);
  const byId = (s: SegmentSummary) => Object.fromEntries(s.categories.map((c) => [c.id, c]));
  const af = byId(africa); const gl = byId(global);
  const top = all.categories.filter((c) => c.pages.num > 0);
  const title = `We audited ${method.audited} landing pages. Here is what we found.`;

  return (
    <PublicLayout>
      <Seo
        title="Landing page study 2026"
        description={`An AI conversion audit of ${method.audited} landing pages — African startups and new indie SaaS — with the score distribution, the most-flagged blockers, the method and the anonymised data.`}
        path={STUDY_PATH}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Landing page study 2026',
          description: `AI conversion-audit scores and blocker categories for ${method.audited} anonymised landing pages.`,
          url: `${SITE_URL}${STUDY_PATH}`,
          creator: { '@type': 'Organization', name: 'MarketBrain OS', url: SITE_URL },
          temporalCoverage: `${method.fetched_from}/${method.fetched_to}`,
          distribution: { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}${STUDY_CSV}` },
        }}
      />

      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-4xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Research · {method.fetched_to?.slice(0, 7)}</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">{title}</h1>

        {/* FIRST, BEFORE ANY NUMBER: what the numbers are not. */}
        <p className="text-sm text-gray-400 border border-gray-800 rounded-2xl px-5 py-4 mb-12">
          <strong className="text-gray-200">Read this first:</strong> an AI score is an opinion about a page at a
          point in time, not conversion data. We did not see anybody’s traffic or sales. Each page was read once, as
          text, and audited once by the same tool we sell — so this is also a demonstration of that tool, and we are
          not neutral about it.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { k: 'Median score', v: String(all.median ?? '—'), d: `of ${all.n} pages` },
            { k: 'Scored under 50', v: pct(all.under50.pct), d: `${all.under50.num} of ${all.under50.den}` },
            { k: 'At least one critical blocker', v: pct(all.anyCritical.pct), d: `${all.anyCritical.num} of ${all.anyCritical.den}` },
            { k: 'Africa vs global, median', v: gap.median == null ? '—' : `${gap.median > 0 ? '+' : ''}${gap.median}`, d: `${africa.median} vs ${global.median} points` },
          ].map((t) => (
            <div key={t.k} className="border border-gray-800 rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{t.k}</p>
              <p className="text-3xl font-bold text-white tabular-nums">{t.v}</p>
              <p className="text-xs text-gray-500 mt-1 tabular-nums">{t.d}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">How the scores fell</h2>
        <p className="text-gray-400 text-sm mb-6">Pages per ten-point band, on the same scale for both groups.</p>
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          <Histogram title="African startups" s={africa} max={histMax} />
          <Histogram title="New indie SaaS (global)" s={global} max={histMax} />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">What the audits flagged most</h2>
        <p className="text-gray-400 text-sm mb-6">
          Share of pages with at least one blocker in each category. A page with three pricing problems counts once.
        </p>
        <div className="overflow-x-auto mb-16">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
                <th className="py-3 pr-4 font-bold">Category</th>
                <th className="py-3 pr-4 font-bold w-[38%]">All pages</th>
                <th className="py-3 pr-4 font-bold text-right">Africa</th>
                <th className="py-3 font-bold text-right">Global</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <tr key={c.id} className="border-b border-gray-900">
                  <td className="py-3 pr-4 text-gray-200">{c.label}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3" title={`${c.pages.num} of ${c.pages.den} pages`}>
                      <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF0000] rounded-r-[4px]" style={{ width: `${c.pages.pct ?? 0}%` }} />
                      </div>
                      <span className="text-white tabular-nums w-12 text-right">{pct(c.pages.pct)}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-400 tabular-nums">{pct(af[c.id]?.pages.pct)}</td>
                  <td className="py-3 text-right text-gray-400 tabular-nums">{pct(gl[c.id]?.pages.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {groups.length > 1 && (
          <>
            <h2 className="text-2xl font-bold text-white mb-2">By country group</h2>
            <p className="text-gray-400 text-sm mb-6">
              Countries with fewer than {method.min_cell} audited pages are grouped, so that no row describes a single company.
            </p>
            <table className="w-full text-sm mb-16">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
                  <th className="py-3 pr-4 font-bold">Group</th>
                  <th className="py-3 pr-4 font-bold text-right">Pages</th>
                  <th className="py-3 font-bold text-right">Median score</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.group} className="border-b border-gray-900">
                    <td className="py-3 pr-4 text-gray-200">{g.group}</td>
                    <td className="py-3 pr-4 text-right text-gray-400 tabular-nums">{g.n}</td>
                    <td className="py-3 text-right text-white tabular-nums">{g.median ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 className="text-2xl font-bold text-white mb-4">Method</h2>
        <div className="space-y-4 text-gray-400 leading-relaxed mb-12">
          <p>
            <strong className="text-gray-200">The sample.</strong> {method.listed} pages chosen by us, not at random: half from
            African startups found through regional tech press and accelerator lists, half from indie software products that
            launched on public launch sites in the sixty days before the study. {method.audited} could be audited;{' '}
            {method.excluded.total} could not — {method.excluded.unreadable} returned no readable text (usually because the page is
            drawn by JavaScript after it loads), {method.excluded.robots} asked crawlers not to read them and were skipped, and{' '}
            {method.excluded.model_error} did not return a usable audit. Pages that need JavaScript to show any copy are therefore
            missing, which is a bias, not a detail.
          </p>
          <p>
            <strong className="text-gray-200">The audit.</strong> Each page was fetched once between {method.fetched_from} and{' '}
            {method.fetched_to} and audited once by Conversion Doctor — the same prompt, fetcher and model ({method.audit_model})
            the product runs. The product normally asks who the page is for and what it should make them do; nobody told us that
            for these pages, so the audit ran without an audience or a goal and judged each page as a first-time visitor would
            meet it. A single model run has variance: the same page audited twice can score a few points apart.
          </p>
          <p>
            <strong className="text-gray-200">The categories.</strong> The audits describe blockers in their own words. Before any
            page was audited we fixed the list of categories below; a second model ({method.classify_model}) then filed each
            blocker under exactly one of them, and could not add new ones. Every filing is kept with its reason.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            {all.categories.map((c) => <li key={c.id}>{c.label}</li>)}
          </ul>
          <p>
            <strong className="text-gray-200">Names.</strong> No company is named, here or in the data. If you think your page is in
            the sample and want it removed, write to support@marketbrainos.app and it will be taken out of the next revision.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">Data</h2>
        <p className="text-gray-400 leading-relaxed mb-12">
          One row per audited page: segment, country group, score, issue counts and its top three blocker categories.{' '}
          <a href={STUDY_CSV} className="text-[#FF0000] font-bold" download>Download the CSV →</a>
        </p>

        <h2 className="text-2xl font-bold text-white mb-4">Corrections</h2>
        <p className="text-gray-400 leading-relaxed mb-16">
          None yet. If a finding is wrong we will say what was wrong and what changed, here, rather than quietly edit the numbers.
        </p>

        <div className="border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-white text-xl font-bold mb-2">Run the same audit on your own page</p>
          <p className="text-gray-400 text-sm mb-6">Free, no account: a score and the three biggest blockers.</p>
          <Link to="/tools/landing-page-score" className="inline-block bg-[#FF0000] text-white font-bold px-6 py-3 rounded-xl">
            Score my landing page
          </Link>
        </div>
      </AnimatedSection>
    </PublicLayout>
  );
};

export default LandingPageStudy;
