# MarketBrain OS - V1 Tool Architecture

> Version: 1.0  
> Status: Architecture baseline for Phase 1 and Phase 4 implementation  
> Related docs: [PRD.md](./PRD.md), [GAP-ANALYSIS.md](./GAP-ANALYSIS.md), [ROADMAP.md](./ROADMAP.md)

## 1. Purpose

This document defines the Version 1 architecture for MarketBrain OS analysis tools. It describes how tools are registered, validated, priced, executed, normalized, stored, rendered, and extended.

The goal is to make every analysis tool behave like a predictable product module rather than a one-off page. V1 must support:

- The current tools: Angle Miner, Conversion Doctor, TestLab Pro, and Workflow.
- The PRD tool set: Strategy Lab, Offer Analyzer, Audience Intelligence, Market Intelligence, Competitor Analyzer, Messaging Analyzer, Content Strategy Tool, Campaign Analyzer, and Growth Analyzer.
- One shared execution path for token deduction, AI execution, error handling, result persistence, and history.

## 2. Current Stack

MarketBrain OS currently uses:

- Frontend: React 18, Vite, TypeScript, HashRouter.
- Auth: Firebase Auth.
- Database: Firestore.
- Server execution: Firebase Functions plus serverless API files under `api/`.
- AI provider: Google Gemini.
- Client services: `services/geminiService.ts`, `services/persistenceService.ts`, `services/exportService.ts`, `services/securityEngine.ts`.
- Shared types: `types.ts`.

Firebase is the canonical backend for V1. Supabase is not part of the V1 architecture.

## 3. Architectural Principles

1. Every tool is registry-driven.
   Tool metadata, token cost, module key, input schema, output schema, route, and storage target must be declared in one canonical registry.

2. Server-side enforcement is authoritative.
   Token costs, module availability, user eligibility, rate limits, and admin controls must be enforced on the server. Client checks are only for user experience.

3. Results use a universal display contract.
   Tool-specific outputs may exist internally, but user-facing results must map into the PRD universal result framework:
   Executive Summary, Key Findings, Strengths, Weaknesses, Opportunities, Risks, Recommendations, Action Plan, Next Steps.

4. Tool pages should be thin.
   Pages collect input, call the tool service, and render shared result components. They should not own billing, persistence, AI prompting, or normalization logic.

5. Adding a tool should not require new infrastructure.
   A new tool should require a registry entry, prompt builder, input form, normalizer, tests, and route/nav updates.

## 4. V1 Tool Catalog

### 4.1 Existing Tools

| Tool | Current module key | Current cost | V1 role |
| --- | --- | ---: | --- |
| Angle Miner | `AngleMiner_Generate` | 3 | PRD core tool |
| Angle Improve | `AngleMiner_Improve` | 1 | Supporting action |
| Conversion Doctor | `ConversionDoctor_Audit` | 4 | PRD core tool |
| TestLab Pro | `TestLab_Simulation` | 5 | Product extra |
| Workflow | `Workflow_ImproveAssets` | 6 | Product extra / pipeline |

### 4.2 PRD Tools To Add

| Tool | Proposed module key | PRD section | V1 category |
| --- | --- | --- | --- |
| Strategy Lab | `StrategyLab_Analyze` | Section 14 | Strategy |
| Offer Analyzer | `OfferAnalyzer_Analyze` | Section 15 | Sales |
| Audience Intelligence | `AudienceIntelligence_Analyze` | Section 16 | Customer Intelligence |
| Market Intelligence | `MarketIntelligence_Analyze` | Section 17 | Market Research |
| Competitor Analyzer | `CompetitorAnalyzer_Analyze` | Section 18 | Market Research |
| Messaging Analyzer | `MessagingAnalyzer_Analyze` | Section 19 | Marketing |
| Content Strategy Tool | `ContentStrategy_Generate` | Section 20 | Growth |
| Campaign Analyzer | `CampaignAnalyzer_Analyze` | Section 21 | Marketing |
| Growth Analyzer | `GrowthAnalyzer_Analyze` | Section 22 | Growth |

## 5. Canonical Tool Registry

V1 should introduce a canonical registry, ideally in `lib/toolRegistry.ts` or `services/toolRegistry.ts`.

```ts
export type ToolId =
  | 'angle_miner'
  | 'conversion_doctor'
  | 'testlab_pro'
  | 'workflow'
  | 'strategy_lab'
  | 'offer_analyzer'
  | 'audience_intelligence'
  | 'market_intelligence'
  | 'competitor_analyzer'
  | 'messaging_analyzer'
  | 'content_strategy'
  | 'campaign_analyzer'
  | 'growth_analyzer';

export interface ToolDefinition<Input, RawOutput, ResultOutput> {
  id: ToolId;
  label: string;
  moduleKey: string;
  category: string;
  description: string;
  tokenCost: number;
  route: string;
  enabledByDefault: boolean;
  validateInput: (input: Input) => void;
  buildPrompt: (input: Input) => string;
  normalizeOutput: (raw: RawOutput) => ResultOutput;
  toUniversalResult: (output: ResultOutput) => UniversalAnalysisResult;
  storageCollection: string;
}
```

The same registry should drive:

- Sidebar and feature directory.
- Admin module toggles.
- Client validation.
- Server validation.
- Token-cost display.
- Analysis history filters.
- Prompt and normalizer selection.

## 6. Universal Result Contract

V1 should add a shared result type:

```ts
export interface UniversalAnalysisResult {
  executiveSummary: string;
  keyFindings: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  actionPlan: ActionPlanItem[];
  nextSteps: string[];
  score?: AnalysisScore;
  toolSpecific?: Record<string, unknown>;
}

export interface ActionPlanItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale?: string;
  expectedOutcome?: string;
}

export interface AnalysisScore {
  value: number;
  band: 'Critical' | 'Weak' | 'Average' | 'Strong' | 'Excellent';
  label?: string;
}
```

Scoring bands:

| Score | Band |
| ---: | --- |
| 0-20 | Critical |
| 21-40 | Weak |
| 41-60 | Average |
| 61-80 | Strong |
| 81-100 | Excellent |

## 7. Execution Flow

The V1 tool flow is:

1. User selects a tool.
2. Tool page loads metadata from the registry.
3. User submits input.
4. Client validates required fields and input size.
5. Client sends `{ toolId, moduleKey, input }` with Firebase ID token.
6. Server verifies auth.
7. Server checks admin settings, maintenance mode, module availability, rate limits, suspension state, and token balance.
8. Server deducts the tool cost inside a Firestore transaction.
9. Server creates or runs an analysis job.
10. AI prompt is built from the tool definition.
11. AI response is parsed and normalized.
12. Result is mapped to `UniversalAnalysisResult`.
13. Server writes analysis record and action log.
14. Client receives result.
15. Client renders shared result UI and available actions: Save, Export, Share, Rerun, Delete.

## 8. Server Boundary

V1 should converge on one canonical execution API. The current code has two execution surfaces:

- `functions/src/index.ts` exposes `executeAnalysis`, `manageUser`, `updateSystemSettings`, and `confirmTopUp`.
- `services/geminiService.ts` expects `/api/analysis/start`, `/api/analysis/run`, and `/api/analysis/status`, but those files are not present in the current working tree.

V1 decision: use one server execution path for all tools. The preferred target is a job-oriented API because it matches the PRD analysis job lifecycle:

- `POST /api/analysis/start`
- `POST /api/analysis/run`
- `GET /api/analysis/status?jobId=...`

If Firebase Functions remains the deployment target, these routes can be implemented as function-backed endpoints. If the project keeps a single callable/onRequest function, `services/geminiService.ts` should be simplified to call that one function directly.

The important rule is that all tools must use the same server authority for:

- Auth verification.
- Token deduction and refund.
- Rate limiting.
- Prompt execution.
- Output normalization.
- Persistence.
- Action logging.

## 9. Firestore Data Model

V1 should move toward one canonical analysis collection while preserving existing collections during migration.

### 9.1 Canonical Collection

Collection: `analyses`

```ts
export interface AnalysisRecord {
  id: string;
  userId: string;
  toolId: ToolId;
  moduleKey: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  tokenCost: number;
  input: Record<string, unknown>;
  rawOutput?: Record<string, unknown>;
  result?: UniversalAnalysisResult;
  error?: {
    code: string;
    message: string;
  };
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
}
```

### 9.2 Existing Collections

Current artifact collections are:

- `angleminer_results`
- `testlab_results`
- `conversion_doctor_results`
- `workflow_runs`
- `action_logs`
- `payments`
- `admin_audit_logs`
- `security_audit_logs`
- `admin_settings`
- `system_settings`
- `rate_limits`
- `users`

V1 can keep the existing artifact collections for compatibility, but new result history should read from `analyses` once implemented.

## 10. Token Policy

The PRD states `1 Analysis = 1 Token`, but Phase 0 intentionally kept per-tool costs for cost control. V1 therefore uses per-tool costs until the product owner revisits pricing.

Rules:

- Server-side `COSTS` is authoritative.
- Client-side `TOKEN_COSTS` is display-only.
- Token deduction must happen before AI execution.
- If AI execution fails after deduction, tokens must be refunded.
- Action logs must distinguish `success`, `failed_refunded`, and `blocked`.
- Admin token adjustments must be audit logged.

## 11. Prompt Architecture

Each tool prompt should include:

- System instruction: MarketBrain OS role and quality bar.
- Tool instruction: exact business question the tool answers.
- Input context: sanitized user input.
- Analysis framework: PRD-specific areas to inspect.
- Output schema: strict JSON contract.
- Universal result requirement: every response must map to the 9-section framework.

Prompt builders should be code, not inline strings inside UI pages.

Recommended file structure:

```txt
lib/
  toolRegistry.ts
  analysisTypes.ts
  scoreBands.ts
services/
  toolExecutionService.ts
  promptBuilders.ts
  normalizers.ts
components/
  UniversalResultView.tsx
  ToolFormShell.tsx
```

## 12. Client Page Architecture

Each tool page should follow the same structure:

1. Load tool definition.
2. Render tool-specific input form.
3. Submit through shared execution service.
4. Render `UniversalResultView`.
5. Expose shared result actions.

The current pages can be migrated incrementally:

- `pages/AngleMinerX.tsx`
- `pages/ConversionDoctor.tsx`
- `pages/TestLabPro.tsx`
- `pages/Workflow.tsx`

New PRD tools should be built directly on the shared pattern.

## 13. Result Actions

Every completed result should support:

- Save: persisted to `analyses`.
- Export: use `services/exportService.ts`.
- Share: generate shareable copy or future private link.
- Rerun: execute the same tool with the same input.
- Delete: soft delete preferred; hard delete acceptable for V1 if audit requirements are satisfied.

## 14. Admin Controls

Admin controls must use the registry instead of hardcoded module keys.

Admin module toggles should store:

```ts
modules_enabled: Record<string, boolean>
```

where the key is the tool `moduleKey` or canonical `toolId`. V1 should choose one and use it consistently. Prefer `toolId` for product concepts and `moduleKey` only for execution internals.

## 15. Adding A New Tool

To add a V1 tool:

1. Add `ToolId` and metadata to the tool registry.
2. Define input and output types.
3. Add input validator.
4. Add prompt builder.
5. Add raw output normalizer.
6. Add mapper to `UniversalAnalysisResult`.
7. Add route and sidebar/feature-directory metadata.
8. Add page using the shared form/result shell.
9. Add server cost and module availability mapping.
10. Add persistence and history support.
11. Add focused tests for validation, normalization, score bands, and failed-token-refund behavior.

## 16. V1 Migration Plan

### Step 1: Stabilize the execution path

Resolve the mismatch between `services/geminiService.ts` and the current API/function files. Pick the job API or a single Firebase Function endpoint, then make all tools use it.

### Step 2: Introduce shared types

Add `ToolDefinition`, `ToolId`, `UniversalAnalysisResult`, and score-band utilities.

### Step 3: Build the registry

Move existing costs, labels, module keys, routes, descriptions, and categories into one registry.

### Step 4: Add universal result rendering

Create one reusable result component and migrate Angle Miner and Conversion Doctor first because they map most directly to the PRD.

### Step 5: Create canonical analysis history

Write completed analyses into `analyses`, then build the dedicated history page from that collection.

### Step 6: Add missing PRD tools

Implement missing tools as registry entries plus prompt/input/result modules, not as standalone architecture.

## 17. Open Implementation Notes

- Free plan currently initializes with 4 tokens while the PRD says 5. This is a product decision outside the tool architecture, but the registry should not hardcode plan allocations.
- Existing docs mention `/api/analysis/start`, `/run`, and `/status`; those files are deleted in the current working tree. Phase 1 should resolve this before adding new tools.
- `TestLab Pro` and `Workflow` are retained as product extras, not replacements for missing PRD tools.
- Some current output shapes are tool-specific. They should be preserved under `toolSpecific` only when useful, while the primary UI uses `UniversalAnalysisResult`.

