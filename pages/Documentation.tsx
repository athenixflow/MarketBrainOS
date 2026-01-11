
import React from 'react';
import { PageHeader, Card, SectionHeader } from '../components/UI';

const Documentation: React.FC = () => {
  return (
    <div className="space-y-24 pb-32">
      <PageHeader 
        title="MarketBrainOS Documentation" 
        subtitle="Understand the mechanics, logic, and operational frameworks of the intelligence layer." 
      />

      <div className="max-w-4xl space-y-24">
        {/* SECTION 1 — INTRODUCTION */}
        <section>
          <SectionHeader title="Introduction" />
          <Card className="leading-relaxed">
            <p className="mb-6 font-medium text-gray-500">
              MarketBrainOS is a marketing intelligence platform designed to help businesses generate, test, and optimize their messaging before spending money on ads or traffic.
            </p>
            <p className="font-medium text-gray-500">
              It combines multiple AI-powered tools into a single system that supports smarter marketing decisions, clearer messaging, and higher conversion potential.
            </p>
          </Card>
        </section>

        {/* SECTION 2 — HOW MARKETBRAINOS WORKS */}
        <section>
          <SectionHeader title="How MarketBrainOS Works" />
          <Card>
            <div className="space-y-6 text-gray-500 font-medium">
              <p>MarketBrainOS focuses on thinking, testing, and diagnosing marketing assets before launch. It does not run ads or manage live campaigns directly.</p>
              <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-4">Core Operational Cycle</p>
                <p className="text-xl font-bold text-[#0B0B0B] leading-tight">Generate ideas → Test them → Audit pages → Improve weak points</p>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 3 — MODULE OVERVIEW */}
        <section>
          <SectionHeader title="Module Overview" />
          <div className="space-y-12">
            <Card title="AngleMiner X">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purpose</h4>
                  <p className="text-gray-500 font-medium">Generate high-quality marketing angles, hooks, and positioning ideas based on psychological triggers.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mechanism</h4>
                  <p className="text-gray-500 font-medium">By providing product and audience context, the system extracts structured marketing angles categorized by strategic intent: Prime, Supporting, and Exploratory.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Use Cases</h4>
                  <ul className="list-disc ml-5 text-gray-500 font-medium space-y-1">
                    <li>Ad copy creation and platform hooks</li>
                    <li>Landing page positioning strategies</li>
                    <li>Unique selling proposition (USP) framing</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card title="TestLab Pro">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purpose</h4>
                  <p className="text-gray-500 font-medium">Compare multiple versions of marketing text and predict projected performance based on benchmarked patterns.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mechanism</h4>
                  <p className="text-gray-500 font-medium">The system evaluates 2–5 variations of headlines, hooks, or copy, providing a specific score and selection rationale for the winning variant.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Use Cases</h4>
                  <ul className="list-disc ml-5 text-gray-500 font-medium space-y-1">
                    <li>Headline selection for A/B testing</li>
                    <li>Comparing different ad hooks for resonance</li>
                    <li>Validating variations before technical deployment</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card title="Conversion Doctor Elite">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purpose</h4>
                  <p className="text-gray-500 font-medium">Diagnose conversion blockers and provide actionable fixes for existing pages.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mechanism</h4>
                  <p className="text-gray-500 font-medium">Using live URLs or pasted copy, the system audits clarity, emotional resonance, trust signals, and CTA flow, offering rewritten alternatives.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Use Cases</h4>
                  <ul className="list-disc ml-5 text-gray-500 font-medium space-y-1">
                    <li>Landing page conversion optimization</li>
                    <li>Full sales funnel diagnostics</li>
                    <li>Messaging clarity audits</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card title="Unified Workflow">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purpose</h4>
                  <p className="text-gray-500 font-medium">A guided, end-to-end process that validates marketing from initial ideation to final clinical refinement.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mechanism</h4>
                  <p className="text-gray-500 font-medium">A multi-step engine that carries context from AngleMiner into TestLab and concludes with a Conversion Doctor audit for a final refined output.</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Use Cases</h4>
                  <ul className="list-disc ml-5 text-gray-500 font-medium space-y-1">
                    <li>Comprehensive campaign preparation</li>
                    <li>Pre-launch strategy validation</li>
                    <li>High-stakes messaging refinement</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* SECTION 4 — USAGE */}
        <section>
          <SectionHeader title="What Counts as Usage" />
          <Card>
            <div className="space-y-8">
              <p className="text-gray-500 font-medium">Usage is recorded only when the neural core performs active analysis. Navigational and administrative tasks do not deduct credits.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-4">Usage Actions</h4>
                  <ul className="text-sm font-bold text-[#0B0B0B] space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" /> Generating Angles</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" /> Running Tests</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" /> Clinical Audits</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" /> Asset Improvement</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-4">Maintenance Actions (No Cost)</h4>
                  <ul className="text-sm font-bold text-gray-400 space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-gray-200" /> Editing Input Text</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-gray-200" /> Navigating Dashboard</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-gray-200" /> Copying Previous Results</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-gray-200" /> Exporting Reports</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 5 — FREE VS PRO */}
        <section>
          <SectionHeader title="Free vs Pro Access" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <Card title="Free Tier">
              <ul className="text-gray-500 font-medium space-y-4">
                <li>Access to all intelligence modules.</li>
                <li>Fixed allocation of analysis credits.</li>
                <li>Full-quality diagnostic results.</li>
                <li>Limited to viewing and copying text only.</li>
              </ul>
            </Card>
            <Card title="Pro Tier" accent>
              <ul className="text-gray-500 font-medium space-y-4">
                <li>Higher monthly usage allowance.</li>
                <li>Expanded analysis capability across all modules.</li>
                <li>Advanced export functionality (TXT and PDF-Ready).</li>
                <li>Monthly usage reset and priority core access.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* SECTION 6 — LIMITS & RESET */}
        <section>
          <SectionHeader title="Usage Limits & Reset" />
          <Card>
            <div className="space-y-6 text-gray-500 font-medium leading-relaxed">
              <p>To ensure system stability and fair resource allocation, usage is bounded by monthly limits. These limits reset automatically at the beginning of each billing cycle.</p>
              <p>Our Hybrid Stop protocol ensures that any analysis already in progress will complete and display results, even if the limit is reached during that specific action.</p>
            </div>
          </Card>
        </section>

        {/* SECTION 7 — EXPORTING */}
        <section>
          <SectionHeader title="Exporting & Copying" />
          <Card>
            <div className="space-y-6 text-gray-500 font-medium leading-relaxed">
              <p>MarketBrainOS supports the professional reuse of all generated assets. All users can utilize the "Copy" function to move text to external documents.</p>
              <p>Pro users can access the Export Controls at the bottom of result containers to download clean TXT files or generate PDF-ready formatting for executive reports. Exporting does not consume analysis credits.</p>
            </div>
          </Card>
        </section>

        {/* SECTION 8 — IMPORTANT NOTES */}
        <section>
          <SectionHeader title="Important Notes" />
          <Card className="!bg-[#FFF9F9] !border-[#FF0000]/5">
            <div className="space-y-6 text-gray-500 font-medium leading-relaxed">
              <p>MarketBrainOS is a decision-support platform designed to improve strategic outcomes. While our intelligence models are trained on high-performing patterns, all results are predictive benchmarks and do not guarantee specific real-world campaign performance.</p>
              <p>We encourage users to implement intelligence-backed outputs into their A/B testing frameworks for definitive validation.</p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Documentation;
