# MarketBrain OS - Developer Implementation Guide

> Version: 1.0  
> Purpose: Practical build guide for implementing the V1 tool architecture  
> Read first: [TOOL-ARCHITECTURE-V1.md](./TOOL-ARCHITECTURE-V1.md), [PRD.md](./PRD.md), [ROADMAP.md](./ROADMAP.md)

## 1. Implementation Goal

This guide explains how to convert the current tool implementation into a shared, registry-driven tool system.

The immediate target is Phase 1:

- Stabilize one execution path.
- Add canonical tool definitions.
- Add the universal analysis result contract.
- Migrate existing tools onto shared infrastructure.
- Prepare the codebase for adding the missing PRD tools without new architecture.

## 2. Current Files To Know

| Area | Current files |
| --- | --- |
| App routing and sidebar | `App.tsx` |
| Shared domain types | `types.ts` |
| Tool execution client | `services/geminiService.ts` |
| Firestore persistence | `services/persistenceService.ts` |
| Export actions | `services/exportService.ts` |
| Firebase config | `services/firebase.ts` |
| Security controls | `services/securityEngine.ts` |
| Firebase Functions | `functions/src/index.ts` |
| Existing tool pages | `pages/AngleMinerX.tsx`, `pages/ConversionDoctor.tsx`, `pages/TestLabPro.tsx`, `pages/Workflow.tsx` |
| Admin controls | `pages/AdminDashboard.tsx` |

## 3. Recommended New Files

Create these files before migrating pages:

```txt
lib/
  analysisTypes.ts
  scoreBands.ts
  toolRegistry.ts
services/
  toolExecutionService.ts
  promptBuilders.ts
  normalizers.ts
components/
  UniversalResultView.tsx
  ToolFormShell.tsx
pages/
  History.tsx
```

If the project keeps most domain code under `services/`, `toolRegistry.ts`, `analysisTypes.ts`, and `scoreBands.ts` can live there instead. Pick one location and use it consistently.

## 4. Build Order

### Step 1: Fix the execution boundary

`services/geminiService.ts` currently calls:

- `/api/analysis/start`
- `/api/analysis/run`
- `/api/analysis/status`

Those route files are not present in the current working tree. Before adding new tools, choose one path:

Option A: Restore and implement the job API.

- Best match for the PRD job lifecycle.
- Keeps queued, processing, completed, failed states explicit.
- Better for long-running AI work.

Option B: Simplify the client to call one Firebase Function endpoint.

- Faster to stabilize.
- Less moving parts for V1.
- Still valid if the function writes canonical `analyses` records.

Do not support both long-term. All tools must use one server authority.

### Step 2: Add shared result types

Create `lib/analysisTypes.ts`.

```ts
export type ScoreBand = 'Critical' | 'Weak' | 'Average' | 'Strong' | 'Excellent';

export interface AnalysisScore {
  value: number;
  band: ScoreBand;
  label?: string;
}

export interface ActionPlanItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale?: string;
  expectedOutcome?: string;
}

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
```

### Step 3: Add score band utility

Create `lib/scoreBands.ts`.

```ts
import { AnalysisScore, ScoreBand } from './analysisTypes';

export const getScoreBand = (score: number): ScoreBand => {
  if (score <= 20) return 'Critical';
  if (score <= 40) return 'Weak';
  if (score <= 60) return 'Average';
  if (score <= 80) return 'Strong';
  return 'Excellent';
};

export const createAnalysisScore = (value: number, label?: string): AnalysisScore => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return {
    value: clamped,
    band: getScoreBand(clamped),
    label,
  };
};
```

### Step 4: Add canonical tool registry

Create `lib/toolRegistry.ts`.

```ts
import { UniversalAnalysisResult } from './analysisTypes';

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

export interface ToolDefinition<Input = unknown, RawOutput = unknown, ResultOutput = unknown> {
  id: ToolId;
  label: string;
  moduleKey: string;
  category: string;
  description: string;
  tokenCost: number;
  route: string;
  enabledByDefault: boolean;
  storageCollection: string;
  validateInput: (input: Input) => void;
  normalizeOutput: (raw: RawOutput) => ResultOutput;
  toUniversalResult: (output: ResultOutput) => UniversalAnalysisResult;
}
```

Start with existing tools only. Add missing PRD tools after the shared path works.

## 5. Existing Tool Registry Entries

Initial registry entries should mirror the current server costs:

| Tool ID | Label | Module key | Cost | Route |
| --- | --- | --- | ---: | --- |
| `angle_miner` | Angle Miner | `AngleMiner_Generate` | 3 | `/angle-miner` |
| `conversion_doctor` | Conversion Doctor | `ConversionDoctor_Audit` | 4 | `/conversion-doctor` |
| `testlab_pro` | TestLab Pro | `TestLab_Simulation` | 5 | `/test-lab` |
| `workflow` | Workflow | `Workflow_ImproveAssets` | 6 | `/workflow` |

Keep `AngleMiner_Improve` as a supporting action, not a primary tool page.

## 6. Client Execution Service

Create `services/toolExecutionService.ts`.

Responsibilities:

- Read tool definition from registry.
- Validate input.
- Attach Firebase ID token.
- Call the canonical execution API.
- Normalize errors into readable messages.
- Return `UniversalAnalysisResult`.

Recommended API:

```ts
import { auth } from './firebase';
import { ToolId, toolsById } from '../lib/toolRegistry';
import { UniversalAnalysisResult } from '../lib/analysisTypes';

export const executeTool = async (toolId: ToolId, input: unknown): Promise<UniversalAnalysisResult> => {
  const tool = toolsById[toolId];
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);

  tool.validateInput(input);

  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to run an analysis.');

  const token = await user.getIdToken();

  const response = await fetch('/api/analysis/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      toolId: tool.id,
      module: tool.moduleKey,
      input,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || 'Analysis failed.');
  }

  const payload = await response.json();
  const normalized = tool.normalizeOutput(payload.result || payload.data?.result || payload.data);
  return tool.toUniversalResult(normalized);
};
```

Adjust the fetch path to match the execution-boundary decision from Step 1.

## 7. Server Implementation Requirements

The server execution handler must do these checks in this order:

1. Reject non-POST requests.
2. Verify Firebase ID token.
3. Validate `toolId`, `module`, and `input`.
4. Load tool definition or server-side equivalent registry.
5. Check global maintenance and analysis pause settings.
6. Check module enabled state.
7. Check user suspension.
8. Enforce rate limit.
9. Check token balance.
10. Deduct tokens in a Firestore transaction.
11. Create or update analysis record as `processing`.
12. Call Gemini.
13. Parse and validate JSON.
14. Normalize result.
15. Save completed analysis.
16. Write action log.
17. Return result.
18. On AI failure after deduction, refund tokens and write `failed_refunded`.

Never trust client-provided token cost.

## 8. Canonical Analysis Persistence

Add write support for `analyses` in `services/persistenceService.ts`.

```ts
export interface CreateAnalysisRecordInput {
  userId: string;
  toolId: string;
  moduleKey: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  tokenCost: number;
  input: Record<string, unknown>;
  result?: unknown;
  rawOutput?: unknown;
  error?: {
    code: string;
    message: string;
  };
}
```

Client-side saves can be allowed for UX, but server-side completed-analysis persistence should become the source of truth.

## 9. Universal Result Component

Create `components/UniversalResultView.tsx`.

Minimum props:

```ts
import { UniversalAnalysisResult } from '../lib/analysisTypes';

interface UniversalResultViewProps {
  result: UniversalAnalysisResult;
  onExport?: () => void;
  onShare?: () => void;
  onRerun?: () => void;
  onDelete?: () => void;
}
```

Render sections in this order:

1. Score, if available.
2. Executive Summary.
3. Key Findings.
4. Strengths.
5. Weaknesses.
6. Opportunities.
7. Risks.
8. Recommendations.
9. Action Plan.
10. Next Steps.

## 10. Page Migration Pattern

When migrating an existing page:

1. Keep the existing form UI.
2. Replace direct `geminiService` function calls with `executeTool(toolId, input)`.
3. Store the returned `UniversalAnalysisResult`.
4. Render `UniversalResultView`.
5. Move page-specific result cards into `toolSpecific` only if still useful.

Suggested migration order:

1. `ConversionDoctor.tsx`
2. `AngleMinerX.tsx`
3. `TestLabPro.tsx`
4. `Workflow.tsx`

Conversion Doctor is the cleanest first migration because it already has a numeric score and recommendation-style output.

## 11. Admin Migration

Current admin settings use:

```ts
modules_enabled: {
  AngleMiner: boolean;
  ConversionDoctor: boolean;
  TestLabPro: boolean;
  Workflow: boolean;
}
```

V1 should migrate to either:

```ts
modules_enabled: Record<ToolId, boolean>
```

or:

```ts
modules_enabled: Record<ModuleKey, boolean>
```

Prefer `ToolId` for admin/product controls. Keep `moduleKey` as an internal execution detail.

During migration, support both old and new keys to avoid breaking existing settings.

## 12. Adding Missing PRD Tools

After existing tools run through the shared architecture, add new tools in this order:

1. Strategy Lab.
2. Offer Analyzer.
3. Audience Intelligence.
4. Market Intelligence.
5. Competitor Analyzer.
6. Messaging Analyzer.
7. Content Strategy Tool.
8. Campaign Analyzer.
9. Growth Analyzer.

For each tool, implement:

- Registry entry.
- Input type.
- Form component or page.
- Validator.
- Prompt builder.
- Normalizer.
- Universal result mapper.
- Server module mapping.
- Token cost.
- History support.

## 13. Test Checklist

Before marking the V1 tool architecture complete:

- A signed-out user cannot run any tool.
- A suspended user cannot run any tool.
- A disabled module cannot run.
- A user with insufficient tokens is blocked before AI execution.
- Tokens deduct once for successful execution.
- Tokens refund when AI execution fails.
- Successful analysis writes an `analyses` record.
- Failed analysis writes an action log.
- All migrated tools render `UniversalResultView`.
- Score bands match PRD Section 24.
- Admin toggles affect execution, not just UI.
- History can load completed analysis records.
- Existing export behavior still works.

## 14. Common Pitfalls

- Do not duplicate token costs across unrelated files without a server-side source of truth.
- Do not let pages build prompts.
- Do not let client-side validation replace server-side validation.
- Do not add new one-off Firestore collections for every new PRD tool unless there is a specific reporting need.
- Do not add missing PRD tools before stabilizing the execution path.
- Do not treat TestLab Pro or Workflow as replacements for the missing PRD tools.

## 15. Definition Of Done

The developer implementation is complete when:

- All existing tools execute through one shared execution service.
- Tool metadata comes from the registry.
- Results render through the universal result component.
- Server-side billing, module availability, and refunds work consistently.
- Completed analyses are saved to the canonical `analyses` collection.
- At least Angle Miner and Conversion Doctor are fully migrated.
- The codebase can add a new PRD tool by following the registry/prompt/normalizer/page pattern without changing core infrastructure.

