import React from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import {
  CAPABILITY_ROWS, COMPETITORS, Capability, Competitor, OURS, isPublishable,
} from '../config/pseo/competitors';

/**
 * `/compare/<competitor>` (GTM part 10 §4.2).
 *
 * THE MOST TEMPTING PAGE IN A PRODUCT TO SHADE. The reader is deciding, the competitor is
 * not in the room, and every claim is about somebody else's software. So the order of this
 * page is the argument: the affiliation disclosure is first, what they are BETTER at is
 * second, and our case comes third — after the reader has been given reason to trust it.
 *
 * IT REFUSES TO PUBLISH STALE DATA. Competitor pricing changes without announcement, so a
 * page whose figures were last checked more than ninety days ago renders as
 * "being re-verified" and leaves the sitemap rather than asserting a number nobody stands
 * behind. Unverified is the state every page starts in.
 *
 * `/vs/` IS DELIBERATELY NOT A ROUTE. Two URL patterns for one intent is self-inflicted
 * duplicate content, and the existing JSON-LD and breadcrumbs already use `/compare/`.
 */
const Compare: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const competitor = COMPETITORS.find((c) => c.slug === slug);

  if (!competitor) {
    return (
      <PublicLayout>
        <Seo title="Comparison not found" description="No such comparison." path="/compare" noindex />
        <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-4">No such comparison</h1>
          <Link to="/features" className="text-[#FF0000] font-bold">See what MarketBrain OS does →</Link>
        </AnimatedSection>
      </PublicLayout>
    );
  }

  const publishable = isPublishable(competitor);

  return (
    <PublicLayout>
      <Seo
        title={`MarketBrain OS vs ${competitor.name}`}
        description={`An honest comparison of MarketBrain OS and ${competitor.name} for reviewing marketing work before you spend.`}
        path={`/compare/${competitor.slug}`}
        /* AN UNVERIFIED PAGE IS NOT INDEXED. It stays reachable by direct link — somebody
           mid-decision should still see it — but it does not ask to be found. */
        noindex={!publishable}
        jsonLd={publishable ? comparisonJsonLd(competitor) : undefined}
      />

      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-4xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Comparison</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          MarketBrain OS vs {competitor.name}
        </h1>

        {/*
          THE DISCLOSURE IS FIRST, NOT IN A FOOTER. A reader deciding between two products
          is entitled to know, before reading a word of the argument, that one of them
          wrote this page.
        */}
        <p className="text-sm text-gray-500 border border-gray-800 rounded-2xl px-5 py-4 mb-10">
          <strong className="text-gray-300">Who wrote this:</strong> we make MarketBrain OS.
          We have tried to describe {competitor.name} as its own users would. Where a figure is
          not public we say so and link to their page rather than guess.
        </p>

        {!publishable && (
          <div role="status" className="border border-[#FF0000]/40 bg-[#FF0000]/5 rounded-2xl px-5 py-4 mb-10">
            <p className="text-white font-bold mb-1">These figures are being re-verified</p>
            <p className="text-gray-400 text-sm">
              {competitor.name}’s plans change without notice, and ours were last checked
              {competitor.verifiedOn ? ` on ${competitor.verifiedOn}` : ' never'}. Until somebody has
              re-read their pricing page, this comparison stays out of search and the numbers below
              are marked unavailable. <a href={competitor.pricingUrl} className="text-[#FF0000] font-bold" rel="nofollow noopener" target="_blank">Check {competitor.name}’s pricing →</a>
            </p>
          </div>
        )}

        {/* THEIR CASE, BEFORE OURS. */}
        <h2 className="text-2xl font-bold text-white mb-5">What {competitor.name} is better at</h2>
        <ul className="space-y-3 mb-12">
          {competitor.strengths.map((s) => (
            <li key={s} className="text-gray-400 border-l-2 border-gray-700 pl-5">{s}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold text-white mb-5">Side by side</h2>
        <div className="overflow-x-auto mb-12">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-3 pr-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Can it…</th>
                <th className="py-3 px-4 text-[10px] font-bold text-white uppercase tracking-widest">MarketBrain OS</th>
                <th className="py-3 pl-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{competitor.name}</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_ROWS.map((row, i) => (
                <tr key={row} className="border-b border-gray-900">
                  <td className="py-4 pr-4 text-gray-400 text-sm">{row}</td>
                  <td className="py-4 px-4"><Mark value={OURS[i]!} /></td>
                  <td className="py-4 pl-4"><Mark value={competitor.capabilities[i]!} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold text-white mb-5">What each costs</h2>
        <ul className="space-y-3 mb-4">
          {competitor.plans.map((p) => (
            <li key={p.name} className="flex justify-between gap-4 border-b border-gray-900 py-3">
              <span className="text-gray-400">{competitor.name} {p.name}{p.note ? ` (${p.note})` : ''}</span>
              <span className="text-gray-300 font-bold">
                {/* NEVER A GUESS. A missing figure says so and points at the source. */}
                {p.monthlyUsd == null ? 'Not publicly available' : `$${p.monthlyUsd}/mo`}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-600 mb-12">
          <a href={competitor.pricingUrl} rel="nofollow noopener" target="_blank" className="underline">
            {competitor.name}’s own pricing page
          </a>
          {competitor.verifiedOn ? ` · we last checked it on ${competitor.verifiedOn}` : ' · not yet checked by us'}.
          Our own prices are on <Link to="/pricing" className="underline">our pricing page</Link>.
        </p>

        <h2 className="text-2xl font-bold text-white mb-5">Questions people actually ask</h2>
        <dl className="space-y-6 mb-12">
          {competitor.faq.map((f) => (
            <div key={f.q}>
              <dt className="text-white font-bold mb-2">{f.q}</dt>
              <dd className="text-gray-400">{f.a}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-gray-800 pt-8">
          <p className="text-gray-400 mb-5">
            The quickest way to decide is to run one page through both and compare what comes back.
          </p>
          <Link to="/tools/landing-page-score" className="inline-block bg-[#FF0000] text-white px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest">
            Score a page free, no account
          </Link>
        </div>
      </AnimatedSection>
    </PublicLayout>
  );
};

/** 'unknown' is rendered as unknown. A blank cell reads as "no" and would be a claim. */
const Mark: React.FC<{ value: Capability }> = ({ value }) => {
  const label = value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value === 'partial' ? 'Partly' : 'Not checked';
  const tone = value === 'yes' ? 'text-green-400' : value === 'no' ? 'text-gray-600' : 'text-gray-500';
  return <span className={`text-sm font-bold ${tone}`}>{label}</span>;
};

/**
 * Schema for the page. OUR offers only.
 *
 * No `aggregateRating` (we have no reviews, and inventing them is the thing the QA audit
 * already caught once) and no `Product` markup for the competitor — describing somebody
 * else's product in our structured data invites an engine to attribute it to us.
 */
const comparisonJsonLd = (c: Competitor) => [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.marketbrainos.app/' },
      { '@type': 'ListItem', position: 2, name: 'Comparisons', item: 'https://www.marketbrainos.app/compare' },
      { '@type': 'ListItem', position: 3, name: `vs ${c.name}` },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
];

export default Compare;
