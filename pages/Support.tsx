// Support — lightweight help surface. A full ticketing system (PRD §48) is a documented
// follow-up; for now this routes users to docs, FAQ, and email so the Account nav is complete.

import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card } from '../components/UI';

const SUPPORT_EMAIL = 'support@marketbrainos.com';

const Support: React.FC = () => {
  const channels = [
    {
      title: 'Documentation',
      body: 'Guides and reference for every tool, the token system, and the organizational layers.',
      cta: 'Open docs',
      to: '/documentation',
    },
    {
      title: 'FAQ',
      body: 'Quick answers to the most common questions about plans, tokens, and analyses.',
      cta: 'Read FAQ',
      to: '/faq',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Find answers fast, or reach the team directly. We're here to help you get the most out of MarketBrain OS."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {channels.map((c) => (
          <Card key={c.title} accent className="!p-10">
            <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight mb-3">{c.title}</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">{c.body}</p>
            <Link
              to={c.to}
              className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1"
            >
              {c.cta} →
            </Link>
          </Card>
        ))}
      </div>

      <Card className="!p-10">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-3">Contact</p>
        <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight mb-3">Email our team</h3>
        <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
          Can't find what you need? Send us a message and we'll get back to you. Include your account
          email and a description of what you're trying to do.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1"
        >
          {SUPPORT_EMAIL} →
        </a>
      </Card>
    </div>
  );
};

export default Support;
