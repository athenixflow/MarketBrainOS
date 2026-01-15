
import React from 'react';
import { Link } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/UI';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-[#0B0B0B] text-gray-300 font-sans selection:bg-[#FF0000] selection:text-white">
      
      {/* 1. HERO SECTION */}
      <header className="relative pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" role="banner">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 bg-gray-900/50 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">System Online v1.0</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-8 leading-[1.1]">
            The Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-600">High-Stakes Marketing Decisions.</span>
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
      </header>

      {/* 2. PROBLEM SECTION */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="problem-heading">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">The Deployment Problem</span>
            <h2 id="problem-heading" className="text-3xl md:text-4xl font-bold text-white mb-6">Why do 80% of marketing campaigns fail in the first 48 hours?</h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              Most founders and marketing teams launch ads based on guesswork. They write copy, build a landing page, and "hope it works." This approach incurs a heavy "Guesswork Tax"—thousands of dollars wasted on traffic sent to unproven messaging and unoptimized funnels.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              Without pre-launch validation, you are paying ad networks to tell you what an AI simulation could have told you for free: <strong>Your conversion argument is weak.</strong>
            </p>
          </div>
          <div className="bg-[#111] p-10 rounded-3xl border border-gray-800 flex flex-col justify-center">
            <div className="space-y-6">
              <div className="flex items-start gap-4 opacity-50">
                <div className="w-6 h-6 rounded-full border-2 border-red-900 flex items-center justify-center text-red-900 font-bold">×</div>
                <p className="font-medium">Writing copy based on "gut feeling"</p>
              </div>
              <div className="flex items-start gap-4 opacity-50">
                <div className="w-6 h-6 rounded-full border-2 border-red-900 flex items-center justify-center text-red-900 font-bold">×</div>
                <p className="font-medium">Launching without conversion audits</p>
              </div>
              <div className="flex items-start gap-4 text-white">
                <div className="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center text-black font-bold">✓</div>
                <p className="font-bold">Simulating performance outcomes before spend</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHAT IS MARKETBRAINOS */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="about-heading">
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
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50 bg-[#0F0F0F]" aria-labelledby="workflow-heading">
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
      </section>

      {/* 5. CORE FEATURES */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-3xl font-bold text-white mb-20 text-center">Core Capabilities</h2>
        
        <div className="space-y-32">
          {/* Feature 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <span className="text-[#FF0000] font-bold text-xs uppercase tracking-[0.3em] mb-4 block">Psychological Profiling</span>
              <h3 className="text-4xl font-bold text-white mb-6">AngleMiner X</h3>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Marketing isn't just about words; it's about angles. AngleMiner X extracts deep psychological triggers from your product description. It identifies "Prime" (high probability), "Supporting" (trust-building), and "Exploratory" (pattern interrupt) angles to diversify your messaging strategy.
              </p>
              <ul className="space-y-3 text-sm font-bold text-gray-500 uppercase tracking-widest">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Audience Trigger Extraction</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Tone Calibration</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000]" />Hook Generation</li>
              </ul>
            </div>
            <div className="lg:col-span-7 bg-[#111] p-12 rounded-[40px] border border-gray-800 shadow-2xl">
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
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1 bg-[#111] p-12 rounded-[40px] border border-gray-800 shadow-2xl">
               <div className="grid grid-cols-2 gap-6">
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
            <div className="lg:col-span-7 bg-[#111] p-12 rounded-[40px] border border-gray-800 shadow-2xl">
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
          </div>
        </div>
      </section>

      {/* 6. WHAT IT IS NOT */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="distinctions-heading">
        <div className="bg-[#1A1A1A] p-12 rounded-[32px] border border-gray-800 text-center max-w-3xl mx-auto">
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
      </section>

      {/* 7. WHO IT IS FOR */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="audience-heading">
         <h2 id="audience-heading" className="text-3xl font-bold text-white mb-12">Who Uses MarketBrainOS?</h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F]">
              <h3 className="text-xl font-bold text-white mb-4">Founders</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Save capital by validating your core value proposition before hiring agencies or spending on ads.
              </p>
            </div>
            <div className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F]">
              <h3 className="text-xl font-bold text-white mb-4">Marketing Agencies</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Audit client assets instantly to find low-hanging fruit and justify your strategy with data-backed simulations.
              </p>
            </div>
            <div className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F]">
              <h3 className="text-xl font-bold text-white mb-4">Growth Teams</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Systematize your creative testing workflow. Reduce the time between ideation and validated launch.
              </p>
            </div>
         </div>
      </section>

      {/* 8. PRICING */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading" className="text-center text-3xl font-bold text-white mb-16">Simple, Fair Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-10 border border-gray-800 rounded-3xl bg-[#0B0B0B] flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Free Tier</h3>
            <p className="text-gray-500 text-sm mb-8">For exploration and light testing.</p>
            <div className="text-4xl font-black text-white mb-8">$0<span className="text-lg font-medium text-gray-600">/mo</span></div>
            <ul className="space-y-4 mb-12 flex-grow">
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />4 Analysis Credits / Mo</li>
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Basic Angle Mining</li>
              <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Limited Simulation</li>
            </ul>
            <Link to="/auth" className="w-full">
               <SecondaryButton className="w-full">Start Free</SecondaryButton>
            </Link>
          </div>

          <div className="p-10 border-2 border-white/10 rounded-3xl bg-[#111] relative flex flex-col">
            <div className="absolute top-0 right-0 bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-2xl rounded-tr-2xl">
              Professional
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro Access</h3>
            <p className="text-gray-500 text-sm mb-8">For serious deployment validation.</p>
            <div className="text-4xl font-black text-white mb-8">$7<span className="text-lg font-medium text-gray-600">/mo</span></div>
            <ul className="space-y-4 mb-12 flex-grow">
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />50 Analysis Credits / Mo</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Full TestLab Pro Access</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Conversion Doctor Elite</li>
              <li className="flex items-center gap-3 text-sm text-white"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />PDF Report Exports</li>
            </ul>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="w-full">
              <PrimaryButton className="w-full">Upgrade Access</PrimaryButton>
            </a>
          </div>
        </div>
      </section>

      {/* 9. CTA */}
      <section className="py-32 px-6 md:px-12 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-8">Stop guessing. Start validating.</h2>
        <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">
          The most expensive decision in marketing is launching without intelligence. Calibrate your strategy with MarketBrainOS.
        </p>
        <Link to="/auth">
          <PrimaryButton className="!px-16 !py-6 !text-base shadow-2xl shadow-red-900/20">Launch Intelligence Engine</PrimaryButton>
        </Link>
        <p className="mt-8 text-xs text-gray-600 uppercase tracking-widest">No credit card required for entry</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-900/50 py-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center font-bold text-white text-xs mb-6">M</div>
            <p className="text-gray-500 text-sm max-w-xs">
              MarketBrainOS is the decision-support system for high-stakes marketing. Built for executives, founders, and growth leaders.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <h4 className="text-white font-bold mb-6">Platform</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><Link to="/auth" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link to="/angle-miner" className="hover:text-white transition-colors">AngleMiner X</Link></li>
                <li><Link to="/test-lab" className="hover:text-white transition-colors">TestLab Pro</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Resources</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><Link to="/documentation" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/documentation" className="hover:text-white transition-colors">Methodology</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-900/50 text-xs text-gray-700 flex justify-between">
          <p>© 2024 MarketBrainOS Intelligence.</p>
          <p>System Status: Operational</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
