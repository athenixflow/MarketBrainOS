// Admin — Control Center category. Audience: platform administrators (super_admin / ops_admin).

import { DocArticle } from './types';

const overview: DocArticle = {
  id: 'overview',
  categoryId: 'admin',
  title: 'Control Center overview',
  summary: 'The admin portal, its section groups, and how to reach it.',
  keywords: ['admin', 'control center', 'portal', 'governance', 'super admin', 'ops admin'],
  blocks: [
    { type: 'heading', id: 'what', text: 'What the Control Center is' },
    { type: 'paragraph', text: 'The Control Center (`/admin`) is the platform governance console for administrators — monitoring, user and financial management, organizations, and immutable audit ledgers. It is only visible to accounts with an admin role, via the "Admin Control" button in the sidebar.' },
    { type: 'heading', id: 'groups', text: 'Section groups' },
    { type: 'table', headers: ['Group', 'Sections'], rows: [
      ['Overview', 'System dashboard and key metrics.'],
      ['People & Plans', 'Users, Subscriptions, Tokens.'],
      ['Operations', 'Analyses, Tools, AI Operations, Platform Health, Feature Flags.'],
      ['Organizations', 'Workspaces, Agencies, Enterprise.'],
      ['Business', 'Pricing & Plans, Revenue, Transactions, Refunds, Reports.'],
      ['Trust & Safety', 'Audit Logs, Security.'],
      ['System', 'Notifications, Support, Content, Settings.'],
    ] },
    { type: 'callout', tone: 'warning', title: 'Restricted', text: 'Admin sections are gated by capability. Regular users never see the Control Center.' },
  ],
};

const roles: DocArticle = {
  id: 'admin-roles',
  categoryId: 'admin',
  title: 'Admin roles & capabilities',
  summary: 'Super_admin vs ops_admin — what each internal role can and cannot do.',
  keywords: ['super admin', 'ops admin', 'capability', 'permission', 'refund', 'security override'],
  blocks: [
    { type: 'heading', id: 'two-roles', text: 'Two admin roles' },
    { type: 'paragraph', text: 'The platform has two internal admin roles, separate from customer container roles:' },
    { type: 'table', headers: ['Role', 'Scope of control'], rows: [
      ['super_admin', 'Everything: user & financial management, refunds/approvals, destructive actions, security overrides, and system configuration (including the runtime Pricing editor).'],
      ['ops_admin', 'Broad operational control — users, tokens, analyses, tools, content, support — but NOT financial approvals (refunds), destructive deletes, or security overrides.'],
    ] },
    { type: 'heading', id: 'pricing', text: 'Runtime pricing control' },
    { type: 'paragraph', text: 'Super admins can edit plan prices, token allowances, org limits, expansion costs, token packs, and per-tool costs at runtime from **Pricing & Plans** — changes apply platform-wide without a redeploy.' },
    { type: 'callout', tone: 'info', title: 'Audited', text: 'Sensitive admin actions are recorded in the audit ledger under Trust & Safety.' },
  ],
};

export const adminArticles: DocArticle[] = [overview, roles];
