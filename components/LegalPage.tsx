// Shared chrome for legal/policy pages (Privacy, Terms). Reuses the public marketing layout + SEO so
// these pages match the rest of the site and get prerendered head tags.
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PublicLayout from './PublicLayout';
import AnimatedSection from './AnimatedSection';
import Seo from './Seo';
import { PageSeo } from '../config/seo';

// A titled block of policy prose. Keep body copy inside <p>/LegalList for consistent spacing.
// `id` makes the section a link target (e.g. /privacy#s11 from the consent banner).
export const LegalSection: React.FC<{ heading: string; id?: string; children: React.ReactNode }> = ({ heading, id, children }) => (
  <section id={id} className="max-w-4xl mx-auto px-6 md:px-12 py-8 border-t border-gray-900/50 scroll-mt-24">
    <h2 className="text-xl md:text-2xl font-bold text-white mb-5 tracking-tight">{heading}</h2>
    <div className="space-y-4 text-[15px] text-gray-400 leading-relaxed">{children}</div>
  </section>
);

// Bulleted list with the brand's red dot markers.
export const LegalList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-3">
    {items.map((it, i) => (
      <li key={i} className="flex gap-3">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FF0000] flex-shrink-0" />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

const LegalPage: React.FC<{
  seo: PageSeo;
  eyebrow: string;
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}> = ({ seo, eyebrow, title, lastUpdated, intro, children }) => {
  // BrowserRouter does not scroll to #hash on client-side navigation; the browser only does it on a
  // full load. Do it here so in-app links like /privacy#s11 land on the section.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
  <PublicLayout>
    <Seo {...seo} />
    <AnimatedSection as="section" index={0} className="pt-24 pb-10 px-6 md:px-12 max-w-4xl mx-auto">
      <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">{eyebrow}</span>
      <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5 leading-[1.1]">{title}</h1>
      <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Last updated · {lastUpdated}</p>
      <div className="mt-8 text-lg text-gray-400 font-medium leading-relaxed">{intro}</div>
    </AnimatedSection>
    <div className="pb-16">{children}</div>
  </PublicLayout>
  );
};

export default LegalPage;
