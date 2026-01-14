
import React from 'react';
import { PageHeader, Card, SectionHeader } from '../components/UI';

const Documentation: React.FC = () => {
  return (
    <div className="space-y-24 pb-32">
      <PageHeader 
        title="Platform Documentation & Operational Logic" 
        subtitle="The authoritative technical definition and capability scope of the MarketBrainOS intelligence layer." 
      />

      <div className="max-w-4xl space-y-24">
        {/* SECTION 1 — CANONICAL DEFINITION */}
        <section>
          <SectionHeader title="Platform Definition" />
          <Card className="leading-relaxed">
            <h3 className="text-sm font-bold text-[#0B0B0B] uppercase tracking-widest mb-4">What is MarketBrainOS?</h3>
            <p className="mb-8 font-medium text-gray-500">
              MarketBrainOS is a <strong>predictive analytics and validation engine</strong> for digital marketing assets. It uses artificial intelligence to input marketing hypotheses (hooks, copy, landing pages) and output probabilistic performance scores and optimization data.
            </p>
            
            <h3 className="text-sm font-bold text-[#FF0000] uppercase tracking-widest mb-4">Platform Boundaries (What it is NOT)</h3>
            <ul className="list-disc pl-5 space-y-2 text-gray-500 font-medium">
              <li>It is <strong>NOT</strong> a generative content writer for blog posts or articles.</li>
              <li>It is <strong>NOT</strong> a social media scheduling or automation tool.</li>
              <li>It is <strong>NOT</strong> a financial investment advisor or trading bot.</li>
              <li>It does <strong>NOT</strong> execute media buys or interact with ad networks directly.</li>
            </ul>
          </Card>
        </section>

        {/* SECTION 2 — CORE CAPABILITIES */}
        <section>
          <SectionHeader title="Core Capabilities" />
          <div className="space-y-8">
            <Card>
              <h4 className="text-lg font-bold text-[#0B0B0B] mb-2">1. Psychological Profiling (AngleMiner X)</h4>
              <p className="text-gray-500 font-medium mb-4">
                Extracts structured marketing angles from product descriptions based on audience psychology. It classifies outputs into Prime (High Probability), Supporting (Trust/Logic), and Exploratory (Pattern Interrupt) categories.
              </p>
            </Card>

            <Card>
              <h4 className="text-lg font-bold text-[#0B0B0B] mb-2">2. Performance Simulation (TestLab Pro)</h4>
              <p className="text-gray-500 font-medium mb-4">
                Simulates the performance of ad copy, headlines, or hooks against high-performance benchmarks. It provides a predictive "Win Probability" score to identify the strongest variant before deployment.
              </p>
            </Card>

            <Card>
              <h4 className="text-lg font-bold text-[#0B0B0B] mb-2">3. Conversion Auditing (Conversion Doctor Elite)</h4>
              <p className="text-gray-500 font-medium mb-4">
                Diagnoses landing pages and sales funnels for conversion friction. It parses text or URLs to identify blockers in messaging, clarity, and user journey flow.
              </p>
            </Card>
          </div>
        </section>

        {/* SECTION 3 — OPERATIONAL FRAMEWORK */}
        <section>
          <SectionHeader title="Operational Framework" />
          <Card>
            <div className="space-y-6 text-gray-500 font-medium">
              <p>The platform operates on a "Validation Pipeline" model:</p>
              <ol className="list-decimal pl-5 space-y-4 text-[#0B0B0B]">
                <li><strong>Input Phase:</strong> User provides raw product data, target audience, or asset URL.</li>
                <li><strong>Processing Phase:</strong> The Neural Intelligence Core analyzes the input against trained high-conversion datasets.</li>
                <li><strong>Scoring Phase:</strong> The system assigns probabilistic scores (0-100) based on predicted impact.</li>
                <li><strong>Output Phase:</strong> Actionable data, rewrites, and diagnostic logs are returned to the user.</li>
              </ol>
            </div>
          </Card>
        </section>

        {/* SECTION 4 — USAGE */}
        <section>
          <SectionHeader title="Usage & Access" />
          <Card>
            <div className="space-y-6">
              <p className="text-gray-500 font-medium">
                MarketBrainOS is a metered SaaS application. Users consume "Tokens" only when executing deep analysis functions.
              </p>
              <div className="flex gap-4 items-center p-4 bg-gray-50 rounded-xl">
                <div className="w-2 h-2 bg-[#FF0000] rounded-full" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Intended Audience: Marketing Executives, Media Buyers</span>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Documentation;
