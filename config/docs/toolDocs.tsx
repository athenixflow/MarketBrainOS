// Tool guides — the exhaustive per-tool documentation.
// The nine generic analysis tools are derived directly from config/toolConfigs.ts so their field
// lists, token costs, estimated time, and connected-tool relationships always match the live app.
// The four bespoke tools (Angle Miner, Conversion Doctor, TestLab Pro, Workflow Pipeline) are
// hand-authored because their input surfaces are custom.

import { DocArticle, DocBlock } from './types';
import {
  TOOL_CONFIG_LIST,
  getToolGuide,
  getToolMeta,
  UNIVERSAL_RESULT_SECTIONS,
  ToolConfig,
} from '../toolConfigs';
import { TOKEN_COSTS } from '../../types';

const CATEGORY = 'tools';

// --- Generic tool article generator -------------------------------------------------------------

const fieldRows = (tool: ToolConfig, advanced: boolean): string[][] =>
  tool.inputs
    .filter((f) => (advanced ? f.group === 'advanced' : f.group !== 'advanced'))
    .map((f) => {
      const name = f.primary ? `${f.label} (main input)` : f.label;
      const what = f.description || f.placeholder || '—';
      const example = f.example || (f.options ? `Options: ${f.options.join(', ')}` : '—');
      return [name, what, example];
    });

const genericToolArticle = (tool: ToolConfig): DocArticle => {
  const guide = getToolGuide(tool);
  const cost = TOKEN_COSTS[tool.costKey];
  const essentialRows = fieldRows(tool, false);
  const advancedRows = fieldRows(tool, true);
  const connected = (tool.worksWith || [])
    .map((m) => getToolMeta(m))
    .filter((x): x is { label: string; slug: string } => !!x);

  const blocks: DocBlock[] = [
    { type: 'keyValue', pairs: [
      { label: 'Suite', value: tool.suite },
      { label: 'Token cost', value: `${cost} token${cost === 1 ? '' : 's'} per run` },
      { label: 'Typical time', value: guide.estimatedTime },
      { label: 'Analysis type', value: guide.analysisType },
    ] },

    { type: 'heading', id: 'overview', text: 'Overview' },
    { type: 'paragraph', text: guide.purpose },
    { type: 'paragraph', text: tool.description || tool.subtitle },

    { type: 'heading', id: 'inputs', text: 'Inputs, field by field' },
    { type: 'paragraph', text: `Fill the **essential fields** first — they are all you need for a solid result. The **${tool.inputs.filter((f) => f.group === 'advanced').length} advanced fields** are optional context tucked under an "Advanced context (optional)" disclosure: the more you add, the deeper and more tailored the analysis. The main input must be **at least 20 characters** or the run is blocked with "Add more detail to the main input for a high-quality analysis."` },
    { type: 'table', caption: 'Essential fields', headers: ['Field', 'What to enter', 'Example'], rows: essentialRows },
    ...(advancedRows.length
      ? [{ type: 'table', caption: 'Advanced context (optional)', headers: ['Field', 'What to enter', 'Example'], rows: advancedRows } as DocBlock]
      : []),

    { type: 'heading', id: 'run', text: 'How to run it' },
    { type: 'steps', items: [
      { title: `Open ${tool.navLabel}`, text: `Find it in the sidebar under the ${tool.suite} suite, or from the dashboard.` },
      { title: 'Fill the essential fields', text: 'Be specific — vague inputs produce vague intelligence. Watch the character counter on long fields.' },
      { title: 'Add advanced context (optional)', text: advancedRows.length ? 'Expand "Advanced context (optional)" and add whatever you know — competitors, constraints, metrics.' : 'This tool has no advanced fields; the essentials are enough.' },
      ...(connected.length ? [{ title: 'Attach a prior analysis (optional)', text: `Use "Add context from a prior analysis" to inject a saved ${connected.map((c) => c.label).join(' or ')} result as extra context.` }] : []),
      { title: 'Choose visibility (in a Team/Agency/Enterprise scope)', text: 'Pick "Shared with team" (default) or "Private to me".' },
      { title: `Click "${tool.ctaVerb} (${cost} Tokens)"`, text: `The run costs ${cost} token${cost === 1 ? '' : 's'}. It typically completes in ${guide.estimatedTime}; the result saves automatically.` },
    ] },

    { type: 'heading', id: 'results', text: 'Reading the results' },
    { type: 'paragraph', text: tool.scored
      ? 'This is a **scored** analysis: the Executive Summary card shows an **Intelligence Grade (0–100)** on a radial gauge plus a short **verdict** badge, followed by the detailed sections as tabs.'
      : 'This is a **strategic** analysis: the Executive Summary leads, followed by the detailed sections as tabs.' },
    { type: 'paragraph', text: 'Every result follows the universal section contract, so you always know where to look:' },
    { type: 'list', items: guide.outcomes },
    { type: 'paragraph', text: 'From the result you can **Rerun**, **Share** (copies formatted text), **Delete**, or export via **Copy / TXT / CSV**. **PDF export is a Pro-plan feature.** Everything you run is also kept in [History](/history).' },
  ];

  if (connected.length) {
    blocks.push(
      { type: 'heading', id: 'works-with', text: 'Works well with' },
      { type: 'paragraph', text: 'This tool is part of a connected ecosystem — chain it with:' },
      { type: 'list', items: connected.map((c) => `[${c.label}](/documentation/tools/${c.slug}) — run it first, then attach its saved result here for sharper output.`) },
    );
  }

  blocks.push(
    { type: 'heading', id: 'tips', text: 'Tips for a better analysis' },
    { type: 'list', items: [
      'Write like you are briefing a sharp consultant: concrete numbers, real names, actual objections.',
      'Fill advanced fields when you have the data — they measurably deepen the output.',
      tool.scored ? 'Treat the score as a directional signal, not a verdict — read the Weaknesses and Recommendations for the "why".' : 'Skim the Executive Summary first, then dive into Recommendations and the Action Plan.',
      connected.length ? 'Chain tools: feed an earlier analysis in as context to compound the intelligence.' : 'Re-run with tighter inputs if the first pass feels generic.',
    ] },
  );

  return {
    id: tool.slug,
    categoryId: CATEGORY,
    title: tool.title,
    summary: tool.subtitle,
    keywords: [tool.navLabel, tool.suite, tool.module, guide.analysisType, 'analysis', 'tool'],
    blocks,
  };
};

export const genericToolArticles: DocArticle[] = TOOL_CONFIG_LIST.map(genericToolArticle);

// --- Bespoke tool articles (custom input surfaces) ----------------------------------------------

const angleMiner: DocArticle = {
  id: 'angle-miner',
  categoryId: CATEGORY,
  title: 'Angle Miner',
  summary: 'Generate high-conversion psychological angles and marketing hooks from your product.',
  keywords: ['angle', 'hook', 'psychology', 'prime', 'supporting', 'exploratory', 'copy'],
  blocks: [
    { type: 'keyValue', pairs: [
      { label: 'Suite', value: 'Marketing Intelligence' },
      { label: 'Token cost', value: '3 tokens to generate' },
      { label: 'Typical time', value: '30–60 seconds' },
      { label: 'Analysis type', value: 'Scored generation' },
    ] },
    { type: 'heading', id: 'overview', text: 'Overview' },
    { type: 'paragraph', text: 'Angle Miner extracts structured marketing angles from a product description using audience psychology. It classifies every angle into one of three families so you know how to use it:' },
    { type: 'list', items: [
      '**Prime** — high-probability angles that lead with your strongest, most direct value.',
      '**Supporting** — trust- and logic-based angles that reinforce the prime message.',
      '**Exploratory** — pattern-interrupt angles worth testing when you want a fresh hook.',
    ] },
    { type: 'heading', id: 'inputs', text: 'Inputs, field by field' },
    { type: 'paragraph', text: 'The main input is your **Product / Offer Description** (multiline, **min 20 characters**). Add the essential context, then optionally the advanced fields.' },
    { type: 'table', caption: 'Essential fields', headers: ['Field', 'What to enter'], rows: [
      ['Product / Offer Description (main input)', 'What you sell, who it helps, and the core result it delivers.'],
      ['Industry', 'The sector you operate in — shapes language and norms.'],
      ['Target Audience', 'Who the angles should speak to.'],
      ['Goal', 'What you want the angles to drive (clicks, sign-ups, sales).'],
      ['Tone Profile', 'The voice the angles should carry.'],
    ] },
    { type: 'table', caption: 'Advanced context (optional)', headers: ['Field', 'What to enter'], rows: [
      ['Competitors', 'Who you are up against — sharpens differentiation.'],
      ['Buyer Objections', 'The doubts angles must defuse.'],
      ['Brand Voice', 'Any voice constraints to respect.'],
      ['Proof Points', 'Stats, results, or credibility markers to lean on.'],
      ['Price Point', 'Roughly what buyers pay — frames the promise.'],
    ] },
    { type: 'heading', id: 'run', text: 'How to run it' },
    { type: 'steps', items: [
      { title: 'Describe your product', text: 'Be concrete about the transformation and who it is for.' },
      { title: 'Add context', text: 'Fill the essentials; expand advanced fields if you have competitors, objections, or proof.' },
      { title: 'Generate (3 tokens)', text: 'Angle Miner returns a grouped set of Prime / Supporting / Exploratory angles, scored for probable impact.' },
    ] },
    { type: 'heading', id: 'results', text: 'Reading & using the results' },
    { type: 'paragraph', text: 'Use **Prime** angles for your headline and lead. Layer **Supporting** angles into body copy and objection-handling. Reserve **Exploratory** angles for A/B tests — then validate the winners in [TestLab Pro](/documentation/tools/test-lab) and audit the destination in [Conversion Doctor](/documentation/tools/conversion-doctor).' },
    { type: 'callout', tone: 'tip', title: 'Chain it', text: 'Angle Miner → TestLab Pro → Conversion Doctor is the core creative-validation loop. Save each result so you can attach it as context downstream.' },
  ],
};

const conversionDoctor: DocArticle = {
  id: 'conversion-doctor',
  categoryId: CATEGORY,
  title: 'Conversion Doctor',
  summary: 'Audit landing pages and funnels for conversion blockers and friction.',
  keywords: ['landing page', 'funnel', 'conversion', 'audit', 'friction', 'cro'],
  blocks: [
    { type: 'keyValue', pairs: [
      { label: 'Suite', value: 'Sales Intelligence' },
      { label: 'Token cost', value: '4 tokens per audit' },
      { label: 'Typical time', value: '30–60 seconds' },
      { label: 'Analysis type', value: 'Scored analysis (0–100)' },
    ] },
    { type: 'heading', id: 'overview', text: 'Overview' },
    { type: 'paragraph', text: 'Conversion Doctor diagnoses a landing page or funnel step for conversion friction — messaging gaps, unclear value, weak calls-to-action, and journey blockers — and returns a prioritized fix list with a 0–100 score.' },
    { type: 'heading', id: 'inputs', text: 'Inputs, field by field' },
    { type: 'paragraph', text: 'The main input is **Page Source**: paste a URL starting with `https://` **or** the raw page copy (**min 20 characters**).' },
    { type: 'table', caption: 'Fields', headers: ['Field', 'What to enter'], rows: [
      ['Page Source (main input)', 'A public `https://` URL, or paste the page copy directly.'],
      ['Page Context', 'What kind of page it is — Landing Page, Homepage, Sales Page, or Funnel Step.'],
      ['Target Audience (advanced)', 'Who the page is meant to convert.'],
      ['Conversion Goal (advanced)', 'The single action the page should drive.'],
      ['Traffic Source (advanced)', 'Where visitors arrive from — sets expectations for intent and awareness.'],
    ] },
    { type: 'heading', id: 'results', text: 'Reading the results' },
    { type: 'paragraph', text: 'You get an **Intelligence Grade (0–100)**, a verdict, and sections covering the specific blockers and the recommended fixes in priority order. Work top-down: the highest-impact friction is surfaced first.' },
    { type: 'callout', tone: 'tip', title: 'Chain it', text: 'Pair with [Messaging Analyzer](/documentation/tools/messaging-analyzer) to fix the words and [Offer Analyzer](/documentation/tools/offer-analyzer) to strengthen the deal behind the page.' },
  ],
};

const testLab: DocArticle = {
  id: 'test-lab',
  categoryId: CATEGORY,
  title: 'TestLab Pro',
  summary: 'Simulate ad performance and predict winning variations before you launch.',
  keywords: ['test', 'simulate', 'ad', 'variant', 'win probability', 'ab test', 'headline', 'hook'],
  blocks: [
    { type: 'keyValue', pairs: [
      { label: 'Suite', value: 'Extras' },
      { label: 'Token cost', value: '5 tokens per simulation' },
      { label: 'Typical time', value: '30–60 seconds' },
      { label: 'Analysis type', value: 'Comparative simulation' },
    ] },
    { type: 'heading', id: 'overview', text: 'Overview' },
    { type: 'paragraph', text: 'TestLab Pro simulates how ad copy, headlines, or hooks would perform against high-performance benchmarks and returns a predictive **Win Probability** for each variant — so you can pick the strongest before spending a cent on media.' },
    { type: 'heading', id: 'inputs', text: 'What to provide' },
    { type: 'list', items: [
      'The **variants** you want to compare — two or more headlines, hooks, or short ad copies.',
      'The **context**: audience, platform/placement, and the goal of the ad.',
      'Any **constraints** (character limits, offer, angle) so the simulation is realistic.',
    ] },
    { type: 'heading', id: 'results', text: 'Reading the results' },
    { type: 'paragraph', text: 'Each variant gets a Win Probability and a short rationale. Ship the top variant, and feed the winning angle back into [Angle Miner](/documentation/tools/angle-miner) or forward into [Campaign Analyzer](/documentation/tools/campaign-analyzer).' },
    { type: 'callout', tone: 'tip', title: 'Test more than two', text: 'Give the simulator several distinct angles rather than minor word tweaks — it discriminates best between genuinely different approaches.' },
  ],
};

const workflowPipeline: DocArticle = {
  id: 'workflow',
  categoryId: CATEGORY,
  title: 'Workflow Pipeline',
  summary: 'Chain ideation, testing, and auditing into one guided campaign workflow.',
  keywords: ['workflow', 'pipeline', 'guided', 'campaign', 'chain', 'end to end'],
  blocks: [
    { type: 'keyValue', pairs: [
      { label: 'Suite', value: 'Extras' },
      { label: 'Token cost', value: '6 tokens for the guided run' },
      { label: 'Typical time', value: '1–2 minutes' },
      { label: 'Analysis type', value: 'Guided multi-step pipeline' },
    ] },
    { type: 'heading', id: 'overview', text: 'Overview' },
    { type: 'paragraph', text: 'Workflow Pipeline strings the core creative loop into a single guided experience, so you go from a raw idea to launch-ready assets without hopping between tools.' },
    { type: 'heading', id: 'steps', text: 'The six steps' },
    { type: 'steps', items: [
      { title: 'Ideate', text: 'Capture the product, audience, and goal.' },
      { title: 'Test angles', text: 'Generate and shortlist the strongest psychological angles.' },
      { title: 'Test copies', text: 'Simulate variant performance and pick winners.' },
      { title: 'Audit the landing page', text: 'Diagnose the destination for conversion friction.' },
      { title: 'Refine', text: 'Apply the fixes and tighten the messaging.' },
      { title: 'Export assets', text: 'Take the launch-ready output into your channels.' },
    ] },
    { type: 'callout', tone: 'info', title: 'When to use it', text: 'Reach for the pipeline when you are building a campaign from scratch. If you only need one step, run the individual tool instead — it is cheaper.' },
  ],
};

export const bespokeToolArticles: DocArticle[] = [angleMiner, conversionDoctor, testLab, workflowPipeline];

// Overview article that opens the Tools category.
export const toolsOverviewArticle: DocArticle = {
  id: 'overview',
  categoryId: CATEGORY,
  title: 'Analysis tools — overview',
  summary: 'How the 13 tools, the five suites, scores, and the universal result contract fit together.',
  keywords: ['tools', 'suites', 'universal sections', 'score', 'verdict', 'ecosystem'],
  blocks: [
    { type: 'heading', id: 'suites', text: 'Five suites, thirteen tools' },
    { type: 'paragraph', text: 'Every analysis tool lives in one of five suites in the sidebar. Four tools are **bespoke** (custom experiences): Angle Miner, Conversion Doctor, TestLab Pro, and Workflow Pipeline. The other nine are **generic** analysis tools that share one consistent interface.' },
    { type: 'table', headers: ['Suite', 'Tools'], rows: [
      ['Marketing Intelligence', 'Angle Miner, Audience Intelligence, Market Intelligence, Competitor Analyzer, Messaging Analyzer, Content Strategy, Campaign Analyzer'],
      ['Sales Intelligence', 'Conversion Doctor, Offer Analyzer'],
      ['Business Strategy', 'Strategy Lab, Growth Analyzer'],
      ['Operations Intelligence', 'Workflow Analyzer'],
      ['Extras', 'TestLab Pro, Workflow Pipeline'],
    ] },
    { type: 'heading', id: 'contract', text: 'The universal result contract' },
    { type: 'paragraph', text: 'Every generic analysis returns the same structure, so you always know where to look. An Executive Summary leads, followed by these sections as tabs:' },
    { type: 'list', ordered: true, items: UNIVERSAL_RESULT_SECTIONS },
    { type: 'heading', id: 'scored', text: 'Scored vs strategic' },
    { type: 'paragraph', text: 'Some tools are **scored** — they add an Intelligence Grade (0–100) on a radial gauge and a short verdict badge (e.g. Messaging Analyzer, Campaign Analyzer, Offer Analyzer, Strategy Lab, Growth Analyzer, Conversion Doctor, TestLab Pro). Others are **strategic** — deep analysis without a single number (e.g. Audience Intelligence, Market Intelligence, Competitor Analyzer, Content Strategy, Workflow Analyzer).' },
    { type: 'heading', id: 'ecosystem', text: 'The connected ecosystem' },
    { type: 'paragraph', text: 'Tools compound. When a tool "works with" another, you can attach a saved result as context via **"Add context from a prior analysis"** — for example, run [Audience Intelligence](/documentation/tools/audience-intelligence) first, then feed it into [Messaging Analyzer](/documentation/tools/messaging-analyzer) or [Content Strategy](/documentation/tools/content-strategy). See [Chaining analyses](/documentation/tools/chaining).' },
    { type: 'callout', tone: 'info', title: 'Token costs', text: 'Each run costs tokens (3–6 depending on the tool). See the full [token cost table](/documentation/reference/token-costs).' },
  ],
};

const resultsArticle: DocArticle = {
  id: 'results',
  categoryId: CATEGORY,
  title: 'Reading & exporting results',
  summary: 'Scores, verdicts, the section tabs, and how to save, share, and export any analysis.',
  keywords: ['result', 'export', 'csv', 'pdf', 'save', 'share', 'score', 'verdict'],
  blocks: [
    { type: 'heading', id: 'anatomy', text: 'Anatomy of a result' },
    { type: 'paragraph', text: 'Results open with an **Executive Summary** card. For scored tools it also shows the **Intelligence Grade (0–100)** on a radial gauge and a **verdict** badge. Below the summary, the detailed sections render as **tabs** — click through Key Findings, Strengths, Weaknesses, Opportunities, Risks, Recommendations, Action Plan, and Next Steps.' },
    { type: 'heading', id: 'saving', text: 'Saving is automatic' },
    { type: 'paragraph', text: 'Every successful analysis saves automatically — a green **Saved** check appears in the summary footer. Find everything again in [History](/history), and promote analyses into your [Reports](/reports) library.' },
    { type: 'heading', id: 'actions', text: 'Actions & exports' },
    { type: 'table', headers: ['Action', 'What it does'], rows: [
      ['Rerun', 'Runs the same tool again (costs tokens again).'],
      ['Share', 'Copies a formatted text version to your clipboard.'],
      ['Delete', 'Removes the saved analysis.'],
      ['Copy', 'Copies the full formatted result.'],
      ['TXT', 'Downloads a plain-text report.'],
      ['CSV', 'Downloads a structured CSV (tool, summary, section, item, score, verdict).'],
      ['PDF', 'Downloads a print-ready PDF — **Pro plan and above.**'],
    ] },
    { type: 'callout', tone: 'warning', title: 'Minimum input', text: 'The main input must be at least 20 characters, or the run is blocked with "Add more detail to the main input for a high-quality analysis." Very long inputs are also rejected — consolidate if you hit the limit.' },
  ],
};

const chainingArticle: DocArticle = {
  id: 'chaining',
  categoryId: CATEGORY,
  title: 'Chaining analyses (connected ecosystem)',
  summary: 'Feed a saved analysis into the next tool as context to compound the intelligence.',
  keywords: ['chain', 'context', 'works with', 'connected', 'ecosystem', 'prior analysis'],
  blocks: [
    { type: 'heading', id: 'how', text: 'How chaining works' },
    { type: 'paragraph', text: 'Many tools accept context from a related, previously-saved analysis. When available, a **"Add context from a prior analysis (optional)"** dropdown appears above the run button, listing your saved results from compatible tools with their dates.' },
    { type: 'paragraph', text: 'When you attach one, the tool injects that analysis\'s top sections and highlights into the new run — so the second analysis is grounded in the first instead of starting cold.' },
    { type: 'heading', id: 'recipes', text: 'Useful chains' },
    { type: 'list', items: [
      '[Audience Intelligence](/documentation/tools/audience-intelligence) → [Messaging Analyzer](/documentation/tools/messaging-analyzer): write copy grounded in real personas.',
      '[Market Intelligence](/documentation/tools/market-intelligence) + [Competitor Analyzer](/documentation/tools/competitor-analyzer) → [Strategy Lab](/documentation/tools/strategy-lab): pressure-test an idea with market context.',
      '[Angle Miner](/documentation/tools/angle-miner) → [TestLab Pro](/documentation/tools/test-lab) → [Conversion Doctor](/documentation/tools/conversion-doctor): the creative-validation loop.',
    ] },
    { type: 'callout', tone: 'tip', title: 'Save first', text: 'Only saved analyses can be attached as context — and every analysis saves automatically, so just run the upstream tool first.' },
  ],
};

// All Tools-category articles, in reading order.
export const toolArticles: DocArticle[] = [
  toolsOverviewArticle,
  ...bespokeToolArticles,
  ...genericToolArticles,
  resultsArticle,
  chainingArticle,
];
