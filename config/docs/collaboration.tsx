// Collaboration & Organizations category — scopes, the three org hubs, and the role/permission model.

import { DocArticle } from './types';

const scopes: DocArticle = {
  id: 'scopes-visibility',
  categoryId: 'organizations',
  title: 'Scopes & visibility',
  summary: 'How Personal, Team, Client, and Enterprise scopes decide who sees an analysis and who pays.',
  keywords: ['scope', 'visibility', 'shared', 'private', 'personal', 'team', 'client', 'enterprise', 'wallet'],
  blocks: [
    { type: 'heading', id: 'what', text: 'What a scope is' },
    { type: 'paragraph', text: 'A **scope** is the context you are working in. It controls two things: **who can see** what you produce, and **whose token wallet pays** for a run. Switch scope from the header scope switcher.' },
    { type: 'table', headers: ['Scope', 'Who can see results', 'Who pays'], rows: [
      ['Personal', 'Only you', 'Your own wallet'],
      ['Team Workspace', 'Workspace members (if shared)', 'The workspace owner\'s wallet'],
      ['Agency client', 'Members assigned to that client', 'The agency owner\'s wallet'],
      ['Enterprise', 'Enterprise members', 'The enterprise owner\'s wallet'],
    ] },
    { type: 'heading', id: 'shared-private', text: 'Shared vs private' },
    { type: 'paragraph', text: 'When you run an analysis inside a Team/Agency/Enterprise scope, you choose per run: **"Shared with team"** (visible to the container\'s members — the default) or **"Private to me"** (only you can see it). This lets you keep drafts private while publishing finished intelligence to the group.' },
    { type: 'callout', tone: 'info', title: 'Pooled billing', text: 'In org scopes the owner\'s wallet funds analyses, and per-container / per-member budgets can cap spend. See the hub guides below.' },
  ],
};

const team: DocArticle = {
  id: 'team-workspace',
  categoryId: 'organizations',
  title: 'Team Workspace',
  summary: 'Shared analyses, members and roles, library, reports, analytics, activity, and seats.',
  keywords: ['team', 'workspace', 'members', 'seats', 'shared library', 'collaboration'],
  blocks: [
    { type: 'heading', id: 'what', text: 'What it is' },
    { type: 'paragraph', text: 'A Team Workspace lets a group collaborate on shared analyses, reports, and intelligence in one place. Available on the **Team plan and above**; creating a workspace upgrades you to Team.' },
    { type: 'heading', id: 'tabs', text: 'The tabs' },
    { type: 'table', headers: ['Tab', 'What you do there'], rows: [
      ['Overview', 'Workspace stats and a snapshot of activity.'],
      ['Members', 'Invite members, assign roles, and manage seats.'],
      ['Library', 'Browse analyses shared with the workspace.'],
      ['Reports', 'Workspace-scoped reports.'],
      ['Analytics', 'Usage: analyses, reports, members, trends.'],
      ['Activity', 'A timeline of workspace events.'],
      ['Settings', 'Rename or archive the workspace (owner).'],
    ] },
    { type: 'heading', id: 'members', text: 'Members & seats' },
    { type: 'paragraph', text: 'Invite members by email; they accept to join. Roles range from owner to viewer (see [Roles & permissions](/documentation/organizations/roles-permissions)). The base plan includes 10 seats — buy more at $4/mo each when you need them.' },
  ],
};

const agency: DocArticle = {
  id: 'agency-hub',
  categoryId: 'organizations',
  title: 'Agency Hub',
  summary: 'Manage multiple clients with isolated workspaces, per-client and per-member budgets, and tool allowlists.',
  keywords: ['agency', 'client', 'budget', 'allocation', 'member', 'allowlist', 'isolated'],
  blocks: [
    { type: 'heading', id: 'what', text: 'What it is' },
    { type: 'paragraph', text: 'The Agency Hub runs multiple clients from one account, each in an isolated workspace with its own analyses, reports, and budget. Available on the **Agency plan and above**.' },
    { type: 'heading', id: 'tabs', text: 'The tabs' },
    { type: 'table', headers: ['Tab', 'What you do there'], rows: [
      ['Dashboard', 'A summary across all your clients.'],
      ['Clients', 'Add clients, set status, and assign members to them.'],
      ['Members', 'Manage your agency team, roles, tools, and budgets.'],
      ['Analytics', 'Cross-client metrics and member activity.'],
      ['Budgets', 'Allocate the agency token pool and manage capacity.'],
      ['Settings', 'Rename, transfer, or archive the agency.'],
    ] },
    { type: 'heading', id: 'budgets', text: 'Budgets & allocation' },
    { type: 'paragraph', text: 'The agency owner controls a shared token pool and can cap spend two ways: a **per-client budget** (each client gets a per-cycle allocation) and a **per-member budget** (each member gets an allowance from the pool). Either blocks independently when exhausted, with a clear message.' },
    { type: 'heading', id: 'members', text: 'Members & tool allowlists' },
    { type: 'paragraph', text: 'When you add a member you can assign a **role**, a **set of tools they may use** (a per-member allowlist), and a **token budget**. Members log in and only see and run the tools you enabled. Base capacity is up to 50 members and 5 client workspaces; both are expandable ($4/mo per seat, $25/mo per workspace).' },
    { type: 'callout', tone: 'info', title: 'Assignment gates access', text: 'Non-owner members only see clients they are assigned to, keeping each client\'s data isolated.' },
  ],
};

const enterprise: DocArticle = {
  id: 'enterprise-suite',
  categoryId: 'organizations',
  title: 'Enterprise Suite',
  summary: 'Org-wide executive intelligence, AI briefings, structure, linked containers, and agency allocation.',
  keywords: ['enterprise', 'executive', 'briefing', 'department', 'brand', 'aggregation', 'forecast'],
  blocks: [
    { type: 'heading', id: 'what', text: 'What it is' },
    { type: 'paragraph', text: 'The Enterprise Suite gives executives intelligence across the entire organization — health, risks, opportunities, forecasts, and AI-generated briefings that aggregate over your linked teams and agencies. Available on the **Enterprise plan**.' },
    { type: 'heading', id: 'tabs', text: 'The tabs' },
    { type: 'table', headers: ['Tab', 'What you do there'], rows: [
      ['Dashboard', 'Org health score and an analytics snapshot.'],
      ['Intelligence', 'The latest executive briefing and forecasts.'],
      ['Performance', 'Department and brand breakdowns and trends.'],
      ['Briefings', 'AI-generated executive briefings — wins, risks, opportunities, recommendations.'],
      ['Structure', 'Create departments and brands, and link containers to them.'],
      ['Members', 'Manage executive members and buy member/agency capacity.'],
      ['Settings', 'Choose which teams/agencies are aggregated; transfer or archive.'],
    ] },
    { type: 'heading', id: 'aggregation', text: 'Linked containers & allocation' },
    { type: 'paragraph', text: 'In Settings you pick which workspaces and agencies the analytics engine aggregates over. The enterprise owner can also allocate the enterprise token pool down to linked agencies, giving each a per-cycle cap. Base capacity is up to 5 agencies and 250 members, both expandable ($99/mo per agency, $4/mo per seat).' },
  ],
};

const roles: DocArticle = {
  id: 'roles-permissions',
  categoryId: 'organizations',
  title: 'Roles & permissions',
  summary: 'Every workspace, agency, and enterprise role and what it can do.',
  keywords: ['role', 'permission', 'owner', 'admin', 'director', 'manager', 'analyst', 'viewer', 'access'],
  blocks: [
    { type: 'heading', id: 'workspace', text: 'Team Workspace roles' },
    { type: 'table', headers: ['Role', 'Can do'], rows: [
      ['Owner', 'Everything: invite, manage roles, transfer, archive.'],
      ['Admin', 'Manage members and settings; run analyses.'],
      ['Manager', 'Create and manage shared analyses; limited invites.'],
      ['Analyst', 'Run analyses and view shared results.'],
      ['Viewer', 'Read-only access to analyses and reports.'],
    ] },
    { type: 'heading', id: 'agency', text: 'Agency roles' },
    { type: 'table', headers: ['Role', 'Can do'], rows: [
      ['Agency Owner', 'Full control: clients, members, budgets, settings, transfer.'],
      ['Agency Director', 'Manage clients, members, and budgets (not ownership transfer).'],
      ['Account Manager', 'Manage assigned clients and run analyses for them.'],
      ['Strategist', 'Run analyses in assigned clients.'],
      ['Analyst', 'Support role; view analyses.'],
      ['Viewer', 'Read-only.'],
    ] },
    { type: 'heading', id: 'enterprise', text: 'Enterprise roles' },
    { type: 'table', headers: ['Role', 'Can do'], rows: [
      ['Enterprise Owner', 'Full control: link agencies/teams, transfer ownership.'],
      ['Executive Admin', 'Manage members and settings; generate briefings.'],
      ['Department Director', 'Oversee department analytics; manage linked containers.'],
      ['Department Manager', 'Run analyses within departments.'],
      ['Executive Viewer', 'Read-only executive dashboards.'],
    ] },
    { type: 'callout', tone: 'info', title: 'Platform admins are separate', text: 'The internal super_admin / ops_admin roles govern the Control Center, not customer containers. See [Admin — Control Center](/documentation/admin/overview).' },
  ],
};

export const organizationsArticles: DocArticle[] = [
  scopes, team, agency, enterprise, roles,
];
