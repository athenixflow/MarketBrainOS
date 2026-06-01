import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import { PrimaryButton } from '../components/UI';
import { NAV_SUITES } from '../config/toolConfigs';

const SUITE_BLURB: Record<string, string> = {
  'Marketing Intelligence': 'Understand markets, audiences, messaging, and campaigns before you spend.',
  'Sales Intelligence': 'Diagnose conversion and pressure-test offers that close.',
  'Business Strategy': 'Decide what to pursue and where to grow next.',
  'Operations Intelligence': 'Find where time, money, and effort are being wasted.',
  'Extras': 'Additional power tools beyond the core suite.',
};

const Features: React.FC = () => (
  <PublicLayout>
    <AnimatedSection as="section" index={0} className="pt-24 pb-16 px-6 md:px-12 max-w-7xl mx-auto">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">The Intelligence Suite</span>
      <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">Thirteen analyzers. One connected system.</h1>
      <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-2xl">
        Every tool follows the same rigorous, structured format — so results are easy to compare, act on,
        and feed into one another.
      </p>
    </AnimatedSection>

    {NAV_SUITES.map((group, gi) => (
      <AnimatedSection as="section" key={group.suite} index={gi + 1} className="py-12 px-6 md:px-12 max-w-7xl mx-auto border-t border-gray-900/50">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-8 h-[2px] bg-[#FF0000] rounded-full" />
          <h2 className="text-sm font-bold text-white uppercase tracking-[0.3em]">{group.suite}</h2>
        </div>
        <p className="text-gray-500 font-medium mb-10 ml-12">{SUITE_BLURB[group.suite]}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {group.items.map((tool) => (
            <div key={tool.path} className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F] hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-xl font-bold text-white">{tool.label}</h3>
                {typeof tool.cost === 'number' && (
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-gray-900 text-gray-400 text-[9px] font-bold uppercase tracking-widest border border-gray-800">{tool.cost} {tool.cost === 1 ? 'Token' : 'Tokens'}</span>
                )}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">{tool.description}</p>
            </div>
          ))}
        </div>
      </AnimatedSection>
    ))}

    <AnimatedSection as="section" index={9} className="py-24 px-6 md:px-12 text-center border-t border-gray-900/50">
      <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-8">Try the full suite free.</h2>
      <Link to="/auth"><PrimaryButton className="!px-12 !py-5">Initialize Free Account</PrimaryButton></Link>
    </AnimatedSection>
  </PublicLayout>
);

export default Features;
