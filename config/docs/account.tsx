// Account & Settings category — settings tabs, history, and the reports library.

import { DocArticle } from './types';

const settings: DocArticle = {
  id: 'settings',
  categoryId: 'account',
  title: 'Account & Settings',
  summary: 'Everything under /settings — profile, account, security, notifications, subscription, billing, integrations.',
  keywords: ['settings', 'profile', 'account', 'security', 'password', 'notifications', 'preferences', 'delete account', 'close account', 'privacy', 'gdpr'],
  blocks: [
    { type: 'heading', id: 'tabs', text: 'The Settings tabs' },
    { type: 'paragraph', text: 'Open [Settings](/settings) to manage your account. It is organized into tabs:' },
    { type: 'table', headers: ['Tab', 'What you can change'], rows: [
      ['Profile', 'First/last name, company, job title, bio.'],
      ['Account', 'Username, timezone, language (email change coming soon); your live [share links](/documentation/account/sharing); delete your account (see below).'],
      ['Security', 'Change password (email sign-in) or send a reset link (Google sign-in).'],
      ['Notifications', 'Toggle: analysis complete, token alerts, product updates, workspace notifications, and the email channel. **Product updates** also governs the onboarding emails.'],
      ['Subscription', 'View your current plan and jump to upgrade.'],
      ['Billing', 'Plan summary, token balance, store, and payment history (CSV export).'],
      ['Integrations', 'Analytics/ads/CRM connections — coming soon.'],
      ['Workspace', 'A shortcut to manage your Team Workspace (Team plan and above).'],
    ] },
    { type: 'callout', tone: 'tip', title: 'Notifications', text: 'Turn on token alerts so you are warned before you run out mid-analysis.' },
    { type: 'heading', id: 'emails', text: 'The emails we send' },
    { type: 'paragraph', text: 'Two kinds, and only one of them can be switched off.' },
    { type: 'table', headers: ['Kind', 'Examples', 'Can you stop them?'], rows: [
      ['Onboarding and tips', 'How to read a report, the activation nudges, a question from the founder around week two, a month-one summary, a note if you go quiet for a month, and one request for a 0-10 score', 'Yes - the **Unsubscribe** link in any of them, or **Product updates** above. Both do the same thing.'],
      ['Account and transactional', 'Receipts, password resets, email verification, sign-in alerts, invitations, low-balance warnings', 'No - these answer something you or your account just did, so they carry no unsubscribe link.'],
    ] },
    { type: 'paragraph', text: 'Unsubscribing takes effect immediately and needs no sign-in, so it works from whatever device the email was opened on.' },
    { type: 'heading', id: 'delete-account', text: 'Delete your account' },
    { type: 'paragraph', text: 'Open [Settings → Account](/settings) and use **Delete account** in the danger zone at the bottom. This is the self-service route for the deletion right in [Privacy Policy §8](/privacy#s8).' },
    { type: 'steps', items: [
      { title: 'Check', text: 'We look at your account first. If you still own an active workspace, agency or enterprise, deletion is refused and each one is listed: archive it from its Settings tab, or make another member the owner (Members → Make owner), then come back. Archived teams do not block.' },
      { title: 'Verify it is you', text: 'Email sign-in: enter your password. Google sign-in: click Continue with Google. The server also requires that you signed in within the last five minutes, so you may be asked to sign in again.' },
      { title: 'Confirm', text: 'Type DELETE (upper case) and click Delete my account permanently. You are signed out and land on the sign-in page with a confirmation; a final email confirms the deletion.' },
    ] },
    { type: 'table', headers: ['Deleted immediately', 'Kept, anonymised'], rows: [
      ['Your profile and sign-in', 'Payment records (amount, reference, tokens, date)'],
      ['Every analysis and report you created — including ones shared with a team, client or enterprise', 'Security and activity logs required for fraud prevention'],
      ['History, notifications, workspace seats and open invitations', 'Your name and email are removed from these; only an internal reference remains ([Privacy Policy §6](/privacy#s6))'],
      ['Unused tokens (forfeited, not refunded)', ''],
    ] },
    { type: 'callout', tone: 'warning', title: 'Cannot be undone', text: 'Nothing is restored if you sign up again with the same email — you get a brand-new Free account. Spend or export what you need before you delete.' },
  ],
};

const history: DocArticle = {
  id: 'history',
  categoryId: 'account',
  title: 'History',
  summary: 'Search, revisit, reopen, export, or delete every analysis you have run.',
  keywords: ['history', 'search', 'filter', 'reopen', 'delete', 'export', 'past analyses'],
  blocks: [
    { type: 'heading', id: 'what', text: 'Your analysis archive' },
    { type: 'paragraph', text: 'Every analysis you run is saved to [History](/history) automatically. It is **scoped** — you see the analyses visible in your current scope (personal, team, client, or enterprise).' },
    { type: 'heading', id: 'find', text: 'Finding and reusing results' },
    { type: 'list', items: [
      '**Search** across tool name, summary, and your input values.',
      '**Filter** by tool to narrow the list.',
      '**View** to expand a result inline; **Reopen Tool** to run it again with fresh inputs.',
      '**Export** any result to CSV or PDF, or **Delete** it.',
    ] },
  ],
};

const reports: DocArticle = {
  id: 'reports',
  categoryId: 'account',
  title: 'Reports',
  summary: 'Your curated library of saved intelligence, scoped to where you are working.',
  keywords: ['reports', 'library', 'saved', 'intelligence', 'scope'],
  blocks: [
    { type: 'heading', id: 'what', text: 'The reports library' },
    { type: 'paragraph', text: '[Reports](/reports) collects saved intelligence for your current scope (Personal, Team, Client, or Enterprise). Each card shows the report type, title, and date.' },
    { type: 'heading', id: 'create', text: 'Creating reports' },
    { type: 'paragraph', text: 'Reports are generated from your analyses — run a tool, and promote the result into your reporting library. If the list is empty, run an analysis first, then save it as a report.' },
    { type: 'callout', tone: 'info', title: 'Scoped', text: 'You only see reports stamped for your active scope, so team and client reporting stay cleanly separated.' },
  ],
};


/**
 * Share links. Filed with History and Reports because that is where a result lives, and
 * written to be explicit about the one thing a person must understand before using it:
 * the link is public to anybody holding it.
 */
const sharing: DocArticle = {
  id: 'sharing',
  categoryId: 'account',
  title: 'Share a result with a link',
  summary: 'Turn any saved analysis into a link anyone can open - and switch it off again.',
  keywords: ['share', 'link', 'send', 'client', 'colleague', 'public', 'revoke', 'share link'],
  blocks: [
    { type: 'heading', id: 'how', text: 'Creating a link' },
    { type: 'paragraph', text: 'On any result that saved, use **Share**. You get a link like `www.marketbrainos.app/s/abc123`, copied to your clipboard, which opens a read-only page showing the score, the summary and the findings.' },
    { type: 'paragraph', text: 'Sharing the same result twice gives you back the same link rather than a second one, so a result has one address however many times you send it.' },
    { type: 'callout', tone: 'warning', title: 'Anyone with the link can read it', text: 'There is no password and no sign-in. Treat it like a document link: anybody you send it to can forward it. If the analysis is of a client page, that is the client\u2019s work on a public URL - send it to the client, not to a group chat.' },
    { type: 'heading', id: 'what-they-see', text: 'What the recipient sees' },
    { type: 'list', items: [
      'The score, the summary and the leading findings - as a plain page that loads without an account. Long reports are trimmed: up to four sections, five findings each.',
      'A line saying the link is public and can be switched off by the person who shared it.',
      'An invitation to run the same analysis on their own page.',
    ] },
    { type: 'paragraph', text: 'They do **not** see your name, your email, your other analyses, or anything else in your account. The shared page is a copy of that one result, so editing or deleting the original afterwards does not change what they already have a link to.' },
    { type: 'callout', tone: 'info', title: 'Not indexed by search engines', text: 'Shared pages carry a noindex instruction, so a result is not going to turn up in a search for your client\u2019s brand. Anybody holding the link can still open it.' },
    { type: 'heading', id: 'revoke', text: 'Switching a link off' },
    { type: 'paragraph', text: '**Settings → Account → Share links** lists every link you have made that is still live, with how many times each has been opened. **Turn link off** takes effect straight away: the address stops showing the report and tells the reader the person who shared it switched it off. Anybody who already opened it may still have what they read, which is true of any document you have sent somebody.' },
    { type: 'heading', id: 'limits', text: 'Limits' },
    { type: 'list', items: [
      'Twenty new links a day per account - far above ordinary use, and there to stop an automated loop publishing a lot of pages at once.',
      'Only results you created can be shared.',
      'A result has to have saved before it can be shared. Where it did not - a run made while the network was failing, or a signed-out run - **Share** copies the result text to your clipboard instead, and says so.',
    ] },
  ],
};

export const accountArticles: DocArticle[] = [settings, history, reports, sharing];
