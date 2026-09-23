import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalSection, LegalList } from '../components/LegalPage';
import { MARKETING_SEO } from '../config/seo';
import { CONSENT_STORAGE_KEY, CONSENT_ANALYTICS_YES, readStoredConsent, disableAnalytics } from '../services/firebase';

const UPDATED = '15 September 2026';
const CONTACT = 'support@marketbrainos.app';

// "Manage analytics choice": clears the stored decision (turning collection off first, so an
// accepted visitor is not tracked between clearing and re-deciding) and reloads so the banner
// returns. Reads as a link inside the policy prose. Rendered only once mounted, so the prerendered
// HTML shows the neutral copy and the live page shows the current state.
const ManageConsentButton: React.FC = () => {
  const [state, setState] = useState<'unknown' | 'yes' | 'no' | 'none'>('unknown');
  useEffect(() => {
    const v = readStoredConsent();
    setState(v === CONSENT_ANALYTICS_YES ? 'yes' : v === null ? 'none' : 'no');
  }, []);

  const reset = () => {
    disableAnalytics();
    try { localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* storage blocked: the banner is already showing */ }
    window.location.reload();
  };

  const current =
    state === 'yes' ? 'Analytics is currently on for this device.' :
    state === 'no' ? 'Analytics is currently off for this device.' :
    state === 'none' ? 'You have not made a choice on this device yet.' : '';

  return (
    <>
      {current && <span className="block mb-2 text-gray-300">{current}</span>}
      <button
        type="button"
        onClick={reset}
        className="text-[#FF0000] hover:opacity-70 transition-opacity font-bold underline-offset-4 hover:underline"
      >
        Manage analytics choice
      </button>
    </>
  );
};

const Privacy: React.FC = () => (
  <LegalPage
    seo={MARKETING_SEO.privacy}
    eyebrow="Legal"
    title="Privacy Policy"
    lastUpdated={UPDATED}
    intro={
      <>
        This Privacy Policy explains how MarketBrain OS (“MarketBrain OS”, “we”, “us”, or “our”) collects,
        uses, shares, and protects your information when you use our website and platform (the “Service”).
        By using the Service, you agree to the practices described here.
      </>
    }
  >
    <LegalSection id="s1" heading="1. Who we are">
      <p>
        MarketBrain OS is an AI marketing-intelligence platform that helps you validate strategy, audit
        landing pages, compare marketing variants, and generate marketing insights. This policy applies to
        the Service available at www.marketbrainos.app and the associated application.
      </p>
    </LegalSection>

    <LegalSection id="s2" heading="2. Information we collect">
      <p>We collect the following categories of information:</p>
      <LegalList
        items={[
          <><strong className="text-gray-200">Account information</strong> — your name, email address, and profile details, provided when you sign up with email/password or Google Sign-In.</>,
          <><strong className="text-gray-200">Analysis content</strong> — the ideas, campaigns, copy, URLs, offers, and other inputs you submit to our tools, together with the results we generate and save to your history.</>,
          <><strong className="text-gray-200">Workspace &amp; membership data</strong> — team, agency, and enterprise memberships, roles, and permissions where you collaborate with others.</>,
          <><strong className="text-gray-200">Billing information</strong> — your plan, subscription status, token balances, and transaction records. Payment card details are processed by our payment provider; we do not store full card numbers.</>,
          <><strong className="text-gray-200">Technical data</strong> — device, browser, and log information (such as IP address and timestamps) generated automatically when you use the Service, including for security and abuse prevention.</>,
        ]}
      />
    </LegalSection>

    <LegalSection id="s3" heading="3. How we use your information">
      <p>We use your information to:</p>
      <LegalList
        items={[
          'Provide, operate, and maintain the Service and your account.',
          'Generate the analyses and results you request, and save them to your history.',
          'Process payments, manage subscriptions, and track token usage.',
          'Send transactional emails (account verification, password resets, receipts, invitations, and important account notices).',
          'Secure the Service, detect and prevent fraud or abuse, and enforce our terms.',
          'Improve and develop features, and provide customer support.',
        ]}
      />
      <p>
        We rely on your consent, the performance of our contract with you, and our legitimate interests in
        operating a secure and effective Service as the legal bases for these uses, where applicable.
      </p>
    </LegalSection>

    <LegalSection id="s4" heading="4. AI processing">
      <p>
        To generate analyses, the content you submit to our tools is sent to Google’s Gemini API for
        processing. This is essential to delivering the core functionality of the Service. Your inputs are
        transmitted securely and used to return results to you; we do not use your private analysis content to
        train our own models. Google processes this data under its own terms as our service provider.
      </p>
    </LegalSection>

    <LegalSection id="s5" heading="5. How we share information">
      <p>We do not sell your personal information. We share information only with:</p>
      <LegalList
        items={[
          <><strong className="text-gray-200">Service providers</strong> that power the Service — including Google Firebase (authentication and database), Google Gemini (AI processing), Google Analytics (usage analytics, only after you accept in the banner — see <Link to="/privacy#s11" className="text-[#FF0000] hover:opacity-70 transition-opacity">section 11</Link>), Resend (transactional email), our payment processor (billing), and Vercel (hosting).</>,
          <><strong className="text-gray-200">Members of your workspace</strong> — when you collaborate in a team, agency, or enterprise, relevant activity and content may be visible to authorized members and administrators of that group.</>,
          <><strong className="text-gray-200">Legal and safety</strong> — where required by law, or to protect the rights, property, or safety of MarketBrain OS, our users, or others.</>,
          <><strong className="text-gray-200">Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, subject to this policy.</>,
        ]}
      />
    </LegalSection>

    <LegalSection id="s6" heading="6. Data retention">
      <p>
        We retain your information for as long as your account is active or as needed to provide the Service.
        Your saved analyses remain available until you delete them or close your account. We may retain certain
        records (such as transaction and security logs) for longer where required for legal, accounting, or
        fraud-prevention purposes. When you delete your account, those retained records are anonymised: your
        name and email address are removed from them and only an internal reference remains.
      </p>
      <p>
        One exception: our administrative audit trail is tamper-evident (each entry is chained to the previous
        one), so it cannot be edited after the fact. If an administrator acted on your account (for example,
        created it for you or adjusted your balance), that entry keeps the details it was written with. It is
        visible only to administrators and is kept for the security and fraud-prevention purposes above.
      </p>
    </LegalSection>

    <LegalSection id="s7" heading="7. Security">
      <p>
        We use industry-standard measures to protect your data, including encryption in transit, authenticated
        access, and role-based permissions. No method of transmission or storage is completely secure, so we
        cannot guarantee absolute security, but we work continuously to protect your information.
      </p>
    </LegalSection>

    <LegalSection id="s8" heading="8. Your rights">
      <p>Depending on your location, you may have the right to:</p>
      <LegalList
        items={[
          'Access the personal information we hold about you.',
          'Correct inaccurate or incomplete information (much of which you can update in your account settings).',
          <>Delete your account and associated data (Settings → Account → Delete account; see <Link to="/privacy#s6" className="text-[#FF0000] hover:opacity-70 transition-opacity">section 6</Link> for the records we must keep).</>,
          'Export your saved analyses and data.',
          'Object to or restrict certain processing, and withdraw consent where processing is based on consent.',
        ]}
      />
      <p>
        You can exercise many of these directly in the app, or contact us at{' '}
        <a href={`mailto:${CONTACT}`} className="text-[#FF0000] hover:opacity-70 transition-opacity">{CONTACT}</a>{' '}
        and we will respond in line with applicable law.
      </p>
    </LegalSection>

    <LegalSection id="s9" heading="9. International transfers">
      <p>
        Our providers may process and store data in countries other than your own. Where we transfer personal
        information internationally, we take steps to ensure it remains protected consistent with this policy
        and applicable law.
      </p>
    </LegalSection>

    <LegalSection id="s10" heading="10. Children">
      <p>
        The Service is not intended for individuals under the age of 16, and we do not knowingly collect
        personal information from children. If you believe a child has provided us with personal information,
        please contact us and we will delete it.
      </p>
    </LegalSection>

    <LegalSection id="s11" heading="11. Cookies and similar technologies">
      <p>We use two kinds of cookies and local storage, and we treat them differently:</p>
      <LegalList
        items={[
          <><strong className="text-gray-200">Essential</strong> — keep you signed in, remember your preferences (including your analytics choice), and secure the Service. These are necessary for the Service to function, so they are always on and disabling them in your browser may affect your experience.</>,
          <><strong className="text-gray-200">Analytics (optional)</strong> — Google Analytics cookies that tell us which tools get used and where they break. They are <strong className="text-gray-200">off by default</strong> and are only set after you choose “Accept analytics” in the banner shown on your first visit. If you decline, nothing is sent to Google Analytics.</>,
        ]}
      />
      <p>
        You can change your mind at any time. Your choice is stored on this device only; clearing it brings the
        banner back so you can choose again, and declining stops collection immediately.
      </p>
      <p>
        <ManageConsentButton />
      </p>
    </LegalSection>

    <LegalSection id="s12" heading="12. Changes to this policy">
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we will update the
        “Last updated” date above and, where appropriate, notify you. Your continued use of the Service after an
        update means you accept the revised policy.
      </p>
    </LegalSection>

    <LegalSection id="s13" heading="13. Contact us">
      <p>
        If you have questions about this Privacy Policy or how we handle your data, contact us at{' '}
        <a href={`mailto:${CONTACT}`} className="text-[#FF0000] hover:opacity-70 transition-opacity">{CONTACT}</a>.
        See also our{' '}
        <Link to="/terms" className="text-[#FF0000] hover:opacity-70 transition-opacity">Terms of Service</Link>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Privacy;
