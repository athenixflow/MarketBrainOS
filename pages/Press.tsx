import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import Seo from '../components/Seo';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';

/**
 * `/press` (GTM part 14 §6) — everything a journalist needs without asking.
 *
 * EVERY FACT HERE COMES FROM THE CODE OR IS LEFT OUT. The tool count is the tools that exist,
 * the prices are read from the pricing config the checkout uses, the model is the one the
 * Cloud Function calls, and the data-handling lines paraphrase the privacy policy. Founder
 * details (name, bio, headshot, founding date) are not on this page until the founder has
 * supplied and confirmed them — part 14 §7 says to confirm each fact first, and a press page
 * is the one place an invented detail gets copied into print.
 */

const BOILERPLATE: { words: number; text: string }[] = [
  {
    words: 50,
    text: 'MarketBrain OS is a pre-spend review tool for marketers. Paste a landing page address, an offer, a campaign plan or two to five ad variants, and it returns a 0–100 score, the problems ranked by impact, and specific fixes, in about a minute. It runs on Google’s Gemini 2.5 Pro.',
  },
  {
    words: 100,
    text: 'MarketBrain OS is a pre-spend review tool for marketers and small agencies: it checks the work before money goes behind it. Conversion Doctor reads a live landing page and returns a 0–100 score, the blockers ranked by impact and ready-to-paste rewrites. TestLab Pro compares two to five headlines or ads and says which is strongest and why. Ten further tools cover offers, audiences, competitors, messaging, campaigns and growth. Results are saved, searchable and exportable as a branded PDF. It runs on Google’s Gemini 2.5 Pro and does not forecast results. There is a free tier; paid plans start at $19 a month.',
  },
  {
    words: 200,
    text: 'MarketBrain OS is a pre-spend review tool for marketers and the small agencies that serve clients: it checks marketing work before money goes behind it. Most small teams launch a page or an ad and learn whether it works from the bill. MarketBrain OS moves the review to the start. Conversion Doctor reads a live landing page — or pasted copy — and returns a 0–100 score, the blockers ranked by impact, concrete fixes and ready-to-paste rewrites, judged against the audience and the goal the user names. TestLab Pro compares two to five headlines or ads and explains which is strongest and why. Ten further tools cover offers, audiences, markets, competitors, messaging, content, campaigns, growth, strategy and workflows, each returning the same scored structure so this week’s review can be compared with last week’s. Results are saved to a searchable history, can be shared by link, and export as a branded PDF for a client. Team and Agency plans add shared workspaces. The analysis runs on Google’s Gemini 2.5 Pro; the product is honest about that, and its scores are a judgement of the work, not a forecast of results. There is a free tier with no card; Pro is $19 a month, Team $79 and Agency $199.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Why not just use ChatGPT?',
    a: 'For a one-off question, you might. The model class is the same — MarketBrain OS runs on Gemini 2.5 Pro and says so. The difference is the discipline around it: it reads the live page itself, returns the same scored sections every time so two reviews can be compared, keeps a searchable history, exports a client-ready PDF and gives a team one shared workspace.',
  },
  {
    q: 'Does the score tell me how the page will perform?',
    a: 'No — it is not a forecast. The score is a judgement of the page against conversion practice, made by one model call, for the audience and goal the user names. It cannot see traffic, spend or sales. It is useful for finding what to fix before launch, not for predicting a conversion rate.',
  },
  {
    q: 'Where does my data go?',
    a: 'Accounts and saved analyses are stored in Google Firebase. The content a user submits is sent to Google’s Gemini API to produce the result, and is not used to train our own models. Users can delete analyses, or their whole account, from Settings. The privacy policy has the detail.',
  },
  {
    q: 'How does it make money?',
    a: 'Subscriptions and token packs. Each analysis costs tokens; plans include a monthly allowance and packs top it up. There is no advertising and no sale of data.',
  },
];

const FILES = [
  { href: '/press/wordmark-dark.png', label: 'Wordmark, for dark backgrounds (PNG)' },
  { href: '/press/wordmark-light.png', label: 'Wordmark, for light backgrounds (PNG)' },
  { href: '/press/wordmark-dark.svg', label: 'Wordmark, dark (SVG)' },
  { href: '/press/wordmark-light.svg', label: 'Wordmark, light (SVG)' },
  { href: '/press/mark.png', label: 'Mark only, 1024px (PNG)' },
  { href: '/press/mark.svg', label: 'Mark only (SVG)' },
];

const CopyBlock: React.FC<{ text: string; words: number }> = ({ text, words }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">About {words} words</span>
        <button
          type="button"
          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white"
          onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-gray-300 leading-relaxed">{text}</p>
    </div>
  );
};

const Press: React.FC = () => {
  const paid = (['pro', 'team', 'agency'] as const).map((t) => ({ t, price: DEFAULT_PRICING_CONFIG.plans[t].price, tokens: DEFAULT_PRICING_CONFIG.plans[t].monthlyTokens }));
  return (
    <PublicLayout>
      <Seo title="Press kit" description="Boilerplate, facts, logos and answers for writing about MarketBrain OS." path="/press" />
      <AnimatedSection as="section" index={0} className="py-24 px-6 md:px-12 max-w-4xl mx-auto">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Press</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">Press kit</h1>
        <p className="text-gray-400 leading-relaxed mb-16">
          Everything here can be used without asking. For anything else, write to{' '}
          <a href="mailto:support@marketbrainos.app" className="text-[#FF0000] font-bold">support@marketbrainos.app</a>{' '}
          with “Press” in the subject.
        </p>

        <h2 className="text-2xl font-bold text-white mb-6">Fact sheet</h2>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mb-16 text-sm">
          {[
            ['What it is', 'A pre-spend review tool: it scores marketing work and says what to fix before money goes behind it. It does not buy media, schedule posts or forecast results.'],
            ['Tools', '13 — led by Conversion Doctor (landing pages), TestLab Pro (comparing variants) and Offer Analyzer.'],
            ['Model', 'Google Gemini 2.5 Pro, one call per analysis.'],
            ['Pricing', `Free tier, no card. ${paid.map((p) => `${p.t[0].toUpperCase()}${p.t.slice(1)} $${p.price}/month (${p.tokens} tokens)`).join(', ')}.`],
            ['Free to try', 'The landing page scorer needs no account.'],
            ['Data', 'Stored in Google Firebase; submitted content is processed by the Gemini API and not used to train our models.'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{k}</dt>
              <dd className="text-gray-300 leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className="text-2xl font-bold text-white mb-6">Boilerplate</h2>
        <div className="space-y-4 mb-16">
          {BOILERPLATE.map((b) => <CopyBlock key={b.words} text={b.text} words={b.words} />)}
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">Logos</h2>
        <p className="text-gray-400 text-sm mb-4">
          Use the mark on its red square as supplied; don’t recolour it or set the wordmark in another typeface.
          The product is written “MarketBrain OS” in running text.
        </p>
        <ul className="grid sm:grid-cols-2 gap-3 mb-16">
          {FILES.map((f) => (
            <li key={f.href}>
              <a href={f.href} download className="block border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 hover:border-gray-600">
                {f.label} ↓
              </a>
            </li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold text-white mb-6">Questions we get</h2>
        <div className="space-y-6 mb-16">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-white font-bold mb-2">{f.q}</h3>
              <p className="text-gray-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">Links</h2>
        <ul className="space-y-2 text-sm">
          <li><Link to="/tools/landing-page-score" className="text-[#FF0000] font-bold">Free landing page scorer</Link></li>
          <li><Link to="/pricing" className="text-gray-300 underline">Pricing</Link></li>
          <li><Link to="/documentation" className="text-gray-300 underline">Documentation</Link></li>
          <li><Link to="/status" className="text-gray-300 underline">Service status</Link></li>
          <li><Link to="/privacy" className="text-gray-300 underline">Privacy policy</Link></li>
          <li><a href="/.well-known/security.txt" className="text-gray-300 underline">security.txt</a></li>
          <li><a href="/llms.txt" className="text-gray-300 underline">llms.txt</a></li>
        </ul>
      </AnimatedSection>
    </PublicLayout>
  );
};

export default Press;
