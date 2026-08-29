import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalSection, LegalList } from '../components/LegalPage';
import { MARKETING_SEO } from '../config/seo';

const UPDATED = '29 August 2026';
const CONTACT = 'support@marketbrainos.app';

const Terms: React.FC = () => (
  <LegalPage
    seo={MARKETING_SEO.terms}
    eyebrow="Legal"
    title="Terms of Service"
    lastUpdated={UPDATED}
    intro={
      <>
        These Terms of Service (“Terms”) govern your access to and use of MarketBrain OS (the “Service”). By
        creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the
        Service.
      </>
    }
  >
    <LegalSection heading="1. The Service">
      <p>
        MarketBrain OS is an AI marketing-intelligence platform that provides analysis tools to validate
        strategy, audit landing pages, simulate campaign performance, and generate marketing insights. The
        Service is a decision-support tool — it is not an ad manager, scheduler, or content publisher.
      </p>
    </LegalSection>

    <LegalSection heading="2. Accounts and eligibility">
      <p>
        You must be at least 16 years old to use the Service. You are responsible for the accuracy of your
        account information, for keeping your credentials secure, and for all activity under your account.
        Notify us promptly of any unauthorized use.
      </p>
    </LegalSection>

    <LegalSection heading="3. Plans, tokens, and billing">
      <LegalList
        items={[
          'The Service is offered on free and paid plans. Paid plans include a monthly token allowance used to run analyses, and you may purchase additional token top-ups.',
          'Paid subscriptions renew automatically each billing cycle until cancelled. You can cancel at any time; cancellation takes effect at the end of the current cycle.',
          'Fees are charged through our payment processor. Except where required by law or expressly stated, payments are non-refundable; monthly token allowances do not carry over unless stated otherwise.',
          'We may change plans, pricing, or token costs, and will give reasonable notice of material changes.',
        ]}
      />
    </LegalSection>

    <LegalSection heading="4. Acceptable use">
      <p>You agree not to:</p>
      <LegalList
        items={[
          'Use the Service for any unlawful, harmful, deceptive, or abusive purpose.',
          'Submit content you do not have the right to use, or that infringes the rights of others.',
          'Attempt to disrupt, reverse engineer, scrape, or gain unauthorized access to the Service or its systems.',
          'Resell or provide access to the Service in a way not permitted by your plan, or circumvent token limits and usage controls.',
        ]}
      />
    </LegalSection>

    <LegalSection heading="5. Your content and intellectual property">
      <p>
        You retain ownership of the content you submit (“Inputs”) and, as between you and us, of the results
        generated for you (“Outputs”). You grant us a limited license to process your Inputs and Outputs solely
        to operate and improve the Service and to provide it to you and your workspace. We and our licensors own
        the Service itself, including its software, design, and branding; nothing in these Terms transfers those
        rights to you.
      </p>
    </LegalSection>

    <LegalSection heading="6. AI outputs — no guarantees">
      <p>
        The Service uses artificial intelligence to generate analyses and recommendations. Outputs may be
        incomplete, inaccurate, or not suited to your specific situation, and are provided for informational
        purposes only. They do not constitute professional, financial, legal, or business advice. You are
        solely responsible for evaluating Outputs and for any decisions you make based on them.
      </p>
    </LegalSection>

    <LegalSection heading="7. Third-party services">
      <p>
        The Service relies on third-party providers (including Google Firebase, Google Gemini, our payment
        processor, and hosting providers). Your use of the Service may be subject to their terms, and we are not
        responsible for third-party services outside our control.
      </p>
    </LegalSection>

    <LegalSection heading="8. Disclaimers">
      <p>
        The Service is provided “as is” and “as available”, without warranties of any kind, whether express or
        implied, including fitness for a particular purpose, accuracy, and non-infringement. We do not warrant
        that the Service will be uninterrupted, error-free, or secure.
      </p>
    </LegalSection>

    <LegalSection heading="9. Limitation of liability">
      <p>
        To the maximum extent permitted by law, MarketBrain OS and its suppliers will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue,
        data, or goodwill. Our total liability for any claim relating to the Service will not exceed the amount
        you paid us for the Service in the twelve months before the event giving rise to the claim.
      </p>
    </LegalSection>

    <LegalSection heading="10. Indemnification">
      <p>
        You agree to indemnify and hold harmless MarketBrain OS from any claims, damages, and expenses arising
        out of your Inputs, your use of the Service, or your violation of these Terms or applicable law.
      </p>
    </LegalSection>

    <LegalSection heading="11. Termination">
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate your
        access if you breach these Terms, misuse the Service, or where required by law. Provisions that by their
        nature should survive termination will do so.
      </p>
    </LegalSection>

    <LegalSection heading="12. Changes to these Terms">
      <p>
        We may update these Terms from time to time. When we make material changes, we will update the “Last
        updated” date above and, where appropriate, notify you. Your continued use of the Service after an
        update means you accept the revised Terms.
      </p>
    </LegalSection>

    <LegalSection heading="13. Governing law">
      <p>
        These Terms are governed by the laws applicable in the jurisdiction in which MarketBrain OS operates,
        without regard to conflict-of-law principles. Any disputes will be subject to the courts of that
        jurisdiction, unless applicable law requires otherwise.
      </p>
    </LegalSection>

    <LegalSection heading="14. Contact us">
      <p>
        Questions about these Terms? Contact us at{' '}
        <a href={`mailto:${CONTACT}`} className="text-[#FF0000] hover:opacity-70 transition-opacity">{CONTACT}</a>.
        See also our{' '}
        <Link to="/privacy" className="text-[#FF0000] hover:opacity-70 transition-opacity">Privacy Policy</Link>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Terms;
