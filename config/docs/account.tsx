// Account & Settings category — settings tabs, history, and the reports library.

import { DocArticle } from './types';

const settings: DocArticle = {
  id: 'settings',
  categoryId: 'account',
  title: 'Account & Settings',
  summary: 'Everything under /settings — profile, account, security, notifications, subscription, billing, integrations.',
  keywords: ['settings', 'profile', 'account', 'security', 'password', 'notifications', 'preferences'],
  blocks: [
    { type: 'heading', id: 'tabs', text: 'The Settings tabs' },
    { type: 'paragraph', text: 'Open [Settings](/settings) to manage your account. It is organized into tabs:' },
    { type: 'table', headers: ['Tab', 'What you can change'], rows: [
      ['Profile', 'First/last name, company, job title, bio.'],
      ['Account', 'Username, timezone, language (email change coming soon).'],
      ['Security', 'Change password (email sign-in) or send a reset link (Google sign-in).'],
      ['Notifications', 'Toggle: analysis complete, token alerts, product updates, workspace notifications, and the email channel.'],
      ['Subscription', 'View your current plan and jump to upgrade.'],
      ['Billing', 'Plan summary, token balance, store, and payment history (CSV export).'],
      ['Integrations', 'Analytics/ads/CRM connections — coming soon.'],
      ['Workspace', 'A shortcut to manage your Team Workspace (Team plan and above).'],
    ] },
    { type: 'callout', tone: 'tip', title: 'Notifications', text: 'Turn on token alerts so you are warned before you run out mid-analysis.' },
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

export const accountArticles: DocArticle[] = [settings, history, reports];
