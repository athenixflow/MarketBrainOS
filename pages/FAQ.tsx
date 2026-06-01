import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import FaqAccordion from '../components/FaqAccordion';
import { PrimaryButton } from '../components/UI';
import { FAQ_ITEMS } from '../config/marketingContent';

const FAQ: React.FC = () => (
  <PublicLayout>
    <AnimatedSection as="section" index={0} className="pt-24 pb-12 px-6 md:px-12 max-w-3xl mx-auto text-center">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">FAQ</span>
      <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">Questions, answered.</h1>
      <p className="text-xl text-gray-400 font-medium leading-relaxed">Everything you need to know about MarketBrain OS, tokens, and pricing.</p>
    </AnimatedSection>

    <AnimatedSection as="section" index={1} className="pb-16 px-6 md:px-12 max-w-3xl mx-auto">
      <FaqAccordion items={FAQ_ITEMS} />
    </AnimatedSection>

    <AnimatedSection as="section" index={2} className="py-20 px-6 md:px-12 text-center border-t border-gray-900/50">
      <h2 className="text-3xl font-black text-white tracking-tight mb-8">Still curious? Try it free.</h2>
      <Link to="/auth"><PrimaryButton className="!px-12 !py-5">Initialize Free Account</PrimaryButton></Link>
    </AnimatedSection>
  </PublicLayout>
);

export default FAQ;
