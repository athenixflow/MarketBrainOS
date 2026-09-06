
import React from 'react';
import { Link } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import PublicLayout from '../components/PublicLayout';
import FaqAccordion from '../components/FaqAccordion';
import { FAQ_ITEMS, TESTIMONIALS } from '../config/marketingContent';
import Seo from '../components/Seo';
import { MARKETING_SEO } from '../config/seo';
import Picture from '../components/media/Picture';
import HeroVideo from '../components/media/HeroVideo';
import * as media from '../assets/media';

const AUDIENCE = [
  { title: 'Founders', desc: 'Save capital by validating your core value proposition before hiring agencies or spending on ads.', asset: media.audienceFounders },
  { title: 'Marketing Agencies', desc: 'Audit client assets instantly to find low-hanging fruit and justify your strategy with data-backed simulations.', asset: media.audienceAgencies },
  { title: 'Growth Teams', desc: 'Systematize your creative testing workflow. Reduce the time between ideation and validated launch.', asset: media.audienceGrowth },
];

const LandingPage: React.FC = () => {
  return (
    <PublicLayout>
      <Seo {...MARKETING_SEO.home} />

      {/* 1. HERO SECTION - full-bleed ambient video behind the copy, scrimmed so the text sits on solid dark. */}
      <AnimatedSection as="section" index={0} className="relative overflow-hidden border-b border-gray-900/50" role="banner">
        {media.hero && (
          <>
            <HeroVideo asset={media.hero} />
            {/* Scrim: solid on the left where the copy lives, opening up toward the right; fades into the page at the bottom. */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0B0B0B] via-[#0B0B0B]/85 to-[#0B0B0B]/30" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0B0B0B]/80 to-transparent" />
          </>
        )}
        <div className="relative pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto lg:min-h-[640px] flex items-center">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 bg-gray-900/50 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">System Online v1.0</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">
              The Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">High-Stakes Marketing Decisions.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 font-medium leading-relaxed max-w-2xl mb-12">
              MarketBrainOS is a predictive marketing intelligence platform. Validate strategies, audit funnels, and simulate performance before you spend a single dollar on ads.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link to="/auth" aria-label="Sign up for MarketBrainOS">
                <PrimaryButton className="!text-sm !px-12 !py-5">Initialize Free Account</PrimaryButton>
              </Link>
              <Link to="/documentation" aria-label="Read platform documentation">
                <SecondaryButton className="!text-sm !px-10 !py-5 !bg-transparent !text-white !border-gray-700 hover:!border-white">
                  Read Documentation
                </SecondaryButton>
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* 2. PROBLEM SECTION */}
      <AnimatedSection as="section" index={1} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="problem-heading">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
          <div className="md:col-span-7">
            <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">The Deployment Problem</span>
            <h2 id="problem-heading" className="text-3xl md:text-4xl font-bold text-white mb-6">Why do 80% of marketing campaigns fail in the first 48 hours?</h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              Most founders and marketing teams launch ads based on guesswork. They write copy, build a landing page, and "hope it works." This approach incurs a heavy "Guesswork Tax"—thousands of dollars wasted on traffic sent to unproven messaging and unoptimized funnels.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              Without pre-launch validation, you are paying ad networks to tell you what an AI simulation could have told you for free: <strong>Your conversion argument is weak.</strong>
            </p>
            <ul className="mt-10 space-y-4">
              <li className="flex items-center gap-4 text-gray-500">
                <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full border-2 border-red-900 flex items-center justify-center text-red-900 font-bold text-sm">×</span>
                <span className="font-medium">Writing copy based on "gut feeling"</span>
              </li>
              <li className="flex items-center gap-4 text-gray-500">
                <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full border-2 border-red-900 flex items-center justify-center text-red-900 font-bold text-sm">×</span>
                <span className="font-medium">Launching without conversion audits</span>
              </li>
              <li className="flex items-center gap-4 text-white">
                <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full bg-[#FF0000] flex items-center justify-center text-black font-bold text-sm">✓</span>
                <span className="font-bold">Simulating performance outcomes before spend</span>
              </li>
            </ul>
          </div>
          {media.problem && (
            <Picture
              asset={media.problem}
              sizes="(min-width: 768px) 40vw, 100vw"
              className="md:col-span-5 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] self-center"
            />
          )}
        </div>
      </AnimatedSection>

      {/* 3. WHAT IS MARKETBRAINOS */}
      <AnimatedSection as="section" index={2} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="about-heading">
        <div className="max-w-3xl">
          <span className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] mb-6 block">Platform Definition</span>
          <h2 id="about-heading" className="text-4xl font-bold text-white mb-8">What is MarketBrainOS?</h2>
          <p className="text-xl text-gray-400 leading-relaxed mb-8">
            MarketBrainOS is a <strong>decision-support system</strong> for growth marketing. It is an AI marketing platform designed to act as a pre-flight checklist for your campaigns. 
          </p>
          <p className="text-lg text-gray-500 leading-relaxed">
            Unlike generative writing tools that simply produce text, MarketBrainOS is built to <strong>audit, score, and refine</strong>. It uses Google's Gemini AI models to simulate how a human audience interacts with your marketing assets, allowing you to optimize conversion rates (CRO) before a campaign goes live.
          </p>
        </div>
      </AnimatedSection>

      {/* 4. HOW IT WORKS */}
      <AnimatedSection as="section" index={3} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50 bg-[#0F0F0F]" aria-labelledby="workflow-heading">
        <h2 id="workflow-heading" className="text-center text-sm font-bold text-white uppercase tracking-[0.2em] mb-16">The Intelligence Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: "01", title: "Ideate", desc: "Input your product details to generate psychological hooks and marketing angles." },
            { step: "02", title: "Simulate", desc: "Run variations through TestLab Pro to predict the highest-performing message." },
            { step: "03", title: "Audit", desc: "Use Conversion Doctor to scan your landing page for friction points." },
            { step: "04", title: "Refine", desc: "Synthesize the data to produce a validated, high-confidence campaign asset." }
          ].map((item) => (
            <div key={item.step} className="relative p-8 border border-gray-800 rounded-2xl hover:border-gray-600 transition-colors">
              <span className="text-6xl font-black text-gray-800 absolute top-4 right-6 opacity-20">{item.step}</span>
              <h3 className="text-xl font-bold text-white mb-4">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* 5. CORE FEATURES */}
      <AnimatedSection as="section" index={4} className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-3xl font-bold text-white mb-4 text-center">Core Capabilities</h2>
        <p className="text-center text-gray-500 font-medium mb-20 max-w-2xl mx-auto">
          A few highlights from a suite of <Link to="/features" className="text-white underline decoration-[#FF0000]/40 underline-offset-4 hover:decoration-[#FF0000]">13 specialized analyzers</Link> spanning marketing, sales, strategy, and operations.
        </p>
        
        <div className="space-y-32">
          {/* Feature 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <span className="text-[#FF0000] font-bold text-xs uppercase tracking-[0.3em] mb-4 block">Psychological Profiling</span>
              <h3 className="text-4xl font-bold text-white mb-6">AngleMiner X</h3>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Marketing isn't just about words; it's about angles. AngleMiner X extracts deep psychological triggers from your product description across eight angle types — Emotional, Fear, Aspiration, Curiosity, Authority, Differentiation, Story, and Contrarian — to diversify your messaging strategy.
              </p>
              <ul className="space-y-3 text-sm font-bold text-gray-500 uppercase tracking-widest">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Audience Trigger Extraction</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Tone Calibration</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Hook Generation</li>
              </ul>
            </div>
            {media.shotAngleminer ? (
              <Picture asset={media.shotAngleminer} sizes="(min-width: 1024px) 58vw, 100vw" className="lg:col-span-7 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] shadow-2xl" />
            ) : (
              <div className="lg:col-span-7 bg-[#111] p-6 sm:p-10 rounded-2xl border border-gray-800 shadow-2xl">
                <div className="space-y-6">
                   <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                      <p className="text-xs text-gray-500 uppercase mb-2">Input</p>
                      <p className="text-white font-medium">"SaaS for remote project management"</p>
                   </div>
                   <div className="flex justify-center text-gray-600">↓</div>
                   <div className="bg-white p-6 rounded-2xl border border-gray-200">
                      <p className="text-xs text-[#FF0000] font-bold uppercase mb-2">Generated Prime Angle</p>
                      <p className="text-[#0B0B0B] font-bold text-lg">"The Async Synchronicity Paradox"</p>
                      <p className="text-xs text-gray-500 mt-2">Rational: Targets the anxiety of remote disconnection while promising the speed of in-person collaboration.</p>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            {media.shotTestlab ? (
              <Picture asset={media.shotTestlab} sizes="(min-width: 1024px) 58vw, 100vw" className="lg:col-span-7 order-2 lg:order-1 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] shadow-2xl" />
            ) : (
              <div className="lg:col-span-7 order-2 lg:order-1 bg-[#111] p-6 sm:p-10 rounded-2xl border border-gray-800 shadow-2xl">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-6 rounded-2xl bg-red-900/10 border border-red-900/30">
                      <p className="text-xs text-red-500 font-bold uppercase mb-4">Variant A</p>
                      <div className="text-2xl font-black text-red-500">42/100</div>
                      <p className="text-[10px] text-red-400 mt-2">Predicted Low Performance</p>
                   </div>
                   <div className="p-6 rounded-2xl bg-green-900/10 border border-green-900/30">
                      <p className="text-xs text-green-500 font-bold uppercase mb-4">Variant B</p>
                      <div className="text-2xl font-black text-green-500">94/100</div>
                      <p className="text-[10px] text-green-400 mt-2">Projected Winner</p>
                   </div>
                 </div>
              </div>
            )}
            <div className="lg:col-span-5 order-1 lg:order-2">
              <span className="text-[#FF0000] font-bold text-xs uppercase tracking-[0.3em] mb-4 block">Performance Simulation</span>
              <h3 className="text-4xl font-bold text-white mb-6">TestLab Pro</h3>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Why pay for A/B testing when you can simulate it? TestLab Pro compares headlines, hooks, and ad copy against a database of high-performing assets. It provides a comparative analysis and predicts which variant is statistically more likely to convert.
              </p>
              <ul className="space-y-3 text-sm font-bold text-gray-500 uppercase tracking-widest">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Pre-Live A/B Simulation</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Headline Scoring</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Comparative Intelligence</li>
              </ul>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <span className="text-[#FF0000] font-bold text-xs uppercase tracking-[0.3em] mb-4 block">Conversion Rate Optimization</span>
              <h3 className="text-4xl font-bold text-white mb-6">Conversion Doctor Elite</h3>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Paste your landing page URL or raw copy. The Conversion Doctor scans the content for clarity, urgency, and friction. It identifies specific "conversion blockers"—elements that confuse or bore the reader—and prescribes actionable fixes.
              </p>
              <ul className="space-y-3 text-sm font-bold text-gray-500 uppercase tracking-widest">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Friction Point Detection</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Call-To-Action Auditing</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Clinical Rewrite Suggestions</li>
              </ul>
            </div>
            {media.shotDoctor ? (
              <Picture asset={media.shotDoctor} sizes="(min-width: 1024px) 58vw, 100vw" className="lg:col-span-7 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] shadow-2xl" />
            ) : (
              <div className="lg:col-span-7 bg-[#111] p-6 sm:p-10 rounded-2xl border border-gray-800 shadow-2xl">
                 <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border border-red-900/30 bg-red-900/5 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <p className="text-gray-300 text-sm"><strong className="text-white">Blocker Detected:</strong> Headline lacks specific benefit.</p>
                    </div>
                    <div className="flex items-center gap-4 p-4 border border-red-900/30 bg-red-900/5 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <p className="text-gray-300 text-sm"><strong className="text-white">Friction Point:</strong> CTA is buried below fold.</p>
                    </div>
                    <div className="flex items-center gap-4 p-4 border border-green-900/30 bg-green-900/5 rounded-xl mt-8">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <p className="text-gray-300 text-sm"><strong className="text-white">Prescription:</strong> Move CTA to hero section and make benefit concrete.</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>

      {/* 6. WHAT IT IS NOT */}
      <AnimatedSection as="section" index={5} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="distinctions-heading">
        <div className="bg-[#1A1A1A] p-6 sm:p-10 rounded-2xl border border-gray-800 text-center max-w-3xl mx-auto">
          <h2 id="distinctions-heading" className="text-2xl font-bold text-white mb-6">Important Distinctions</h2>
          <p className="text-gray-400 mb-8 font-medium">To maintain professional integrity, we are transparent about platform limitations.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div>
              <span className="text-[#FF0000] text-xs font-bold uppercase tracking-widest mb-2 block">MarketBrainOS is NOT</span>
              <ul className="text-gray-500 space-y-2 text-sm font-medium">
                <li>• An automated ad buying tool</li>
                <li>• A social media scheduler</li>
                <li>• A generic blog post writer</li>
              </ul>
            </div>
            <div>
              <span className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2 block">MarketBrainOS IS</span>
              <ul className="text-gray-500 space-y-2 text-sm font-medium">
                <li>• A strategic analysis engine</li>
                <li>• A pre-launch validation tool</li>
                <li>• A conversion intelligence suite</li>
              </ul>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* 7. WHO IT IS FOR */}
      <AnimatedSection as="section" index={6} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="audience-heading">
         <h2 id="audience-heading" className="text-3xl font-bold text-white mb-12">Who Uses MarketBrainOS?</h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="border border-gray-800 rounded-2xl bg-[#0F0F0F] overflow-hidden flex flex-col">
                {a.asset && (
                  <Picture asset={a.asset} sizes="(min-width: 768px) 33vw, 100vw" className="border-b border-gray-800" imgClassName="aspect-[2/1] object-cover" />
                )}
                <div className="p-8">
                  <h3 className="text-xl font-bold text-white mb-4">{a.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{a.desc}</p>
                </div>
              </div>
            ))}
         </div>
      </AnimatedSection>

      {/* 8. PRICING */}
      <AnimatedSection as="section" index={7} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading" className="text-center text-3xl font-bold text-white mb-16">Simple, Fair Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-6 sm:p-10 border border-gray-800 rounded-2xl bg-[#0B0B0B] flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Free Tier</h3>
            <p className="text-gray-500 text-sm mb-8">For exploration and light testing.</p>
            <div className="text-4xl font-black text-white mb-8">$0<span className="text-lg font-medium text-gray-600">/mo</span></div>
            <ul className="space-y-4 mb-12 flex-grow">
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />4 Analysis Credits / Mo</li>
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Basic Angle Mining</li>
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Limited Simulation</li>
            </ul>
            <Link to="/auth" className="w-full">
               <SecondaryButton tone="dark" className="w-full">Start Free</SecondaryButton>
            </Link>
          </div>

          <div className="p-6 sm:p-10 border-2 border-white/10 rounded-2xl bg-[#111] relative flex flex-col">
            <div className="absolute top-0 right-0 bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-2xl rounded-tr-2xl">
              Professional
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro Access</h3>
            <p className="text-gray-500 text-sm mb-8">For serious deployment validation.</p>
            <div className="text-4xl font-black text-white mb-8">$7<span className="text-lg font-medium text-gray-600">/mo</span></div>
            <ul className="space-y-4 mb-12 flex-grow">
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />200 Analysis Credits / Mo</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Full TestLab Pro Access</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Conversion Doctor Elite</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />PDF Report Exports</li>
            </ul>
            <Link to="/auth" className="w-full block">
              <PrimaryButton className="w-full">Get Started with Pro</PrimaryButton>
            </Link>
          </div>
        </div>
      </AnimatedSection>

      {/* 8b. TESTIMONIALS (illustrative samples) */}
      <AnimatedSection as="section" index={8} className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="testimonials-heading">
        <h2 id="testimonials-heading" className="text-center text-3xl font-bold text-white mb-4">What operators say</h2>
        <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest mb-16">Illustrative samples — replace with real customer quotes before launch</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F] flex flex-col">
              <div className="text-[#FF0000] text-4xl font-black leading-none mb-6">“</div>
              <p className="text-gray-300 leading-relaxed font-medium mb-8 flex-grow">{t.quote}</p>
              <div>
                <p className="text-white font-bold text-sm">{t.name}</p>
                <p className="text-gray-500 text-xs">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* 8c. FAQ (top items; full list at /faq) */}
      <AnimatedSection as="section" index={9} className="py-24 px-6 md:px-12 max-w-3xl mx-auto border-b border-gray-900/50" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-center text-3xl font-bold text-white mb-16">Frequently asked questions</h2>
        <FaqAccordion items={FAQ_ITEMS.slice(0, 4)} />
        <div className="text-center mt-10">
          <Link to="/faq" className="text-[11px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors border-b border-gray-700 pb-1">See all questions</Link>
        </div>
      </AnimatedSection>

      {/* 9. CTA */}
      <AnimatedSection as="section" index={10} className="py-32 px-6 md:px-12 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-8">Stop guessing. Start validating.</h2>
        <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">
          The most expensive decision in marketing is launching without intelligence. Calibrate your strategy with MarketBrainOS.
        </p>
        <Link to="/auth">
          <PrimaryButton className="!px-16 !py-6 !text-base shadow-2xl shadow-red-900/20">Launch Intelligence Engine</PrimaryButton>
        </Link>
        <p className="mt-8 text-xs text-gray-600 uppercase tracking-widest">No credit card required for entry</p>
      </AnimatedSection>
    </PublicLayout>
  );
};

export default LandingPage;
