import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import { PrimaryButton } from '../components/UI';

const About: React.FC = () => (
  <PublicLayout>
    <AnimatedSection as="section" index={0} className="pt-24 pb-16 px-6 md:px-12 max-w-4xl mx-auto">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">About</span>
      <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">Turn uncertainty into clarity.</h1>
      <p className="text-xl text-gray-400 font-medium leading-relaxed">
        MarketBrain OS exists to help founders, marketers, agencies, and operators make better decisions —
        faster, and with less guesswork.
      </p>
    </AnimatedSection>

    <AnimatedSection as="section" index={1} className="py-12 px-6 md:px-12 max-w-4xl mx-auto border-t border-gray-900/50">
      <h2 className="text-2xl font-bold text-white mb-6">Our mission</h2>
      <p className="text-lg text-gray-500 leading-relaxed mb-10">
        Transform raw business ideas, campaigns, workflows, funnels, offers, and growth initiatives into
        actionable strategic intelligence. We believe the most expensive decisions are the ones made on
        gut feel — so we built a system that pressure-tests them first.
      </p>
      <h2 className="text-2xl font-bold text-white mb-6">Our vision</h2>
      <p className="text-lg text-gray-500 leading-relaxed mb-10">
        To become the operating system for business decision-making: one connected intelligence layer that
        sits between your ideas and your spend, across every part of your go-to-market.
      </p>
      <h2 className="text-2xl font-bold text-white mb-6">The story</h2>
      <p className="text-lg text-gray-500 leading-relaxed">
        Most teams launch on instinct and pay an ad network to tell them what an AI simulation could have
        told them for free. MarketBrain OS was built to close that gap — combining specialized analysis
        tools with a rigorous, repeatable result framework so insight is consistent, comparable, and
        immediately actionable.
      </p>
    </AnimatedSection>

    <AnimatedSection as="section" index={2} className="py-12 px-6 md:px-12 max-w-4xl mx-auto border-t border-gray-900/50">
      <h2 className="text-2xl font-bold text-white mb-8">The team</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {['Product & Strategy', 'AI & Engineering', 'Growth & Support'].map((t) => (
          <div key={t} className="p-8 border border-gray-800 rounded-2xl bg-[#0F0F0F]">
            <div className="w-12 h-12 rounded-full bg-gray-800 mb-6" />
            <h3 className="text-white font-bold mb-2">{t}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">A small, focused team building decision-grade intelligence tools.</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-6">Team details are illustrative and will be updated.</p>
    </AnimatedSection>

    <AnimatedSection as="section" index={3} className="py-24 px-6 md:px-12 text-center border-t border-gray-900/50">
      <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-8">Build with intelligence.</h2>
      <Link to="/auth"><PrimaryButton className="!px-12 !py-5">Get Started Free</PrimaryButton></Link>
    </AnimatedSection>
  </PublicLayout>
);

export default About;
