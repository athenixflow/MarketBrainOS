import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import { PrimaryButton, SecondaryButton } from '../components/UI';

const Pricing: React.FC = () => (
  <PublicLayout>
    <AnimatedSection as="section" index={0} className="pt-24 pb-12 px-6 md:px-12 max-w-7xl mx-auto text-center">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Pricing</span>
      <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">Simple, fair access.</h1>
      <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
        Start free. Upgrade when you are ready. Every analysis costs tokens — and you only pay for what completes.
      </p>
    </AnimatedSection>

    <AnimatedSection as="section" index={1} className="pb-16 px-6 md:px-12 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free */}
        <div className="p-10 border border-gray-800 rounded-3xl bg-[#0B0B0B] flex flex-col">
          <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
          <p className="text-gray-500 text-sm mb-8">For exploration and light testing.</p>
          <div className="text-4xl font-black text-white mb-8">$0<span className="text-lg font-medium text-gray-600">/mo</span></div>
          <ul className="space-y-4 mb-12 flex-grow text-sm text-gray-400">
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />5 analysis tokens (one-time)</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Access to all tools</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Analysis history</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Basic support</li>
          </ul>
          <Link to="/auth" className="w-full block"><SecondaryButton className="w-full">Start Free</SecondaryButton></Link>
        </div>

        {/* Pro */}
        <div className="p-10 border-2 border-[#FF0000]/30 rounded-3xl bg-[#111] relative flex flex-col shadow-2xl shadow-red-900/10">
          <div className="absolute top-0 right-0 bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-2xl rounded-tr-2xl">Most Popular</div>
          <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
          <p className="text-gray-500 text-sm mb-8">For serious, ongoing validation.</p>
          <div className="text-4xl font-black text-white mb-8">$7<span className="text-lg font-medium text-gray-600">/mo</span></div>
          <ul className="space-y-4 mb-12 flex-grow text-sm text-white">
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />200 tokens every month</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />All 13 tools, unlimited use</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Token top-ups</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full" />Priority support + PDF exports</li>
          </ul>
          <Link to="/auth" className="w-full block"><PrimaryButton className="w-full">Get Started with Pro</PrimaryButton></Link>
        </div>

        {/* Top-Ups */}
        <div className="p-10 border border-gray-800 rounded-3xl bg-[#0B0B0B] flex flex-col">
          <h3 className="text-2xl font-bold text-white mb-2">Token Top-Ups</h3>
          <p className="text-gray-500 text-sm mb-8">For Pro members who need more.</p>
          <div className="text-4xl font-black text-white mb-8">$5<span className="text-lg font-medium text-gray-600"> / 100</span></div>
          <ul className="space-y-4 mb-12 flex-grow text-sm text-gray-400">
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />100 tokens, instantly</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Never expire</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Stack on monthly allowance</li>
            <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Available to Pro accounts</li>
          </ul>
          <Link to="/auth" className="w-full block"><SecondaryButton className="w-full">Upgrade to Unlock</SecondaryButton></Link>
        </div>
      </div>

      <p className="text-center text-xs text-gray-600 mt-10 max-w-2xl mx-auto leading-relaxed">
        Each analysis consumes tokens based on its depth. Tokens are only charged when an analysis completes
        successfully — failed runs are automatically refunded.
      </p>
    </AnimatedSection>
  </PublicLayout>
);

export default Pricing;
