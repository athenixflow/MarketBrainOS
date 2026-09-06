// DEV-ONLY sample results for the three bespoke tools, used to photograph the real result UI for the
// marketing site without spending tokens. Loaded only by `loadDevFixture()` below, which is a no-op
// outside `import.meta.env.DEV`, so Vite drops this module from production builds entirely.
//
// Open http://localhost:5173/angle-miner?fixture=1 (or /test-lab, /conversion-doctor) while signed in.
// The shapes mirror the server contract in functions/src/index.ts (ANGLE_MINER_SCHEMA and the TestLab /
// ConversionDoctor prompts).
import type { AngleMinerResults, TestLabResults, AuditResult } from '../types';

export const ANGLE_MINER_FIXTURE: AngleMinerResults = {
  angles: [
    { type: 'Emotional', title: 'The Sunday-night dread', hook: 'You already know Monday is lost before it starts.', rational: 'Names the recurring anxiety of walking into a week with no visibility, then positions the product as the thing that ends it.', score: 88 },
    { type: 'Emotional', title: 'Quiet mornings are back', hook: 'Open one screen. Know where every project stands. Close it.', rational: 'Sells the feeling of control rather than the feature list; the promise is a calmer day, not a dashboard.', score: 81 },
    { type: 'Fear', title: 'The silent slip', hook: 'Projects rarely fail loudly. They slip a day at a time until the launch moves.', rational: 'Targets the fear of an invisible delay compounding. Works for founders who have already lived through one.', score: 84 },
    { type: 'Aspiration', title: 'Run it like a 40-person team', hook: 'Six people, one system, zero status meetings.', rational: 'Aspirational framing for small teams that want big-company rigour without the overhead.', score: 79 },
    { type: 'Curiosity', title: 'What your standup is hiding', hook: 'Your daily standup takes 14 minutes and answers none of the questions that matter.', rational: 'A specific, uncomfortable claim that invites the reader to check it against their own experience.', score: 76 },
    { type: 'Authority', title: 'Built from 2,000 shipped projects', hook: 'Every default in the product came from watching what actually finishes.', rational: 'Borrows credibility from volume and specificity instead of testimonials.', score: 72 },
    { type: 'Differentiation', title: 'Not another board', hook: 'Kanban shows you what exists. We show you what is late, and why.', rational: 'Draws a clean line against the category leader by reframing the job as risk detection, not task display.', score: 83 },
    { type: 'Contrarian', title: 'Stop tracking tasks', hook: 'Tasks are the wrong unit. Track commitments.', rational: 'Challenges the category assumption outright; polarising, but memorable for the right operator.', score: 70 },
  ],
  hooks: [
    { channel: 'Ads', platform: 'Meta', short: 'Know what is late before your client does.', expanded: 'Every slipping project surfaces on one screen the morning it slips, with the reason attached. No status meeting required.' },
    { channel: 'Ads', platform: 'LinkedIn', short: 'Six people. Zero status meetings.', expanded: 'Small teams that run on commitments instead of tasks ship on time more often. Here is the system they use.' },
    { channel: 'Ads', platform: 'Google', short: 'Project tracking that flags delays early', expanded: 'See which projects are at risk this week, why, and who owns the fix. Free for teams under ten.' },
    { channel: 'Organic', platform: 'LinkedIn', short: 'Your standup answers the wrong questions.', expanded: 'A 14-minute standup tells you what people did yesterday. It never tells you which commitment is about to slip. Here is what we ask instead.' },
    { channel: 'Organic', platform: 'X', short: 'Projects do not fail loudly.', expanded: 'They slip a day at a time until the launch date moves. The fix is not more meetings, it is earlier signal.' },
    { channel: 'Organic', platform: 'YouTube', short: 'How we run a 6-person team without a single status meeting', expanded: 'A walkthrough of the weekly cadence, the one screen we look at every morning, and what we stopped doing.' },
    { channel: 'Funnel', platform: 'Email', short: 'Your first at-risk report is ready', expanded: 'Connect one project and get a plain-English risk summary in under five minutes. No setup call, no card.' },
    { channel: 'Funnel', platform: 'Landing page', short: 'See every late project on one screen', expanded: 'Commitments, owners and slippage in a single view your whole team can read. Start with your current projects, free.' },
  ],
};

export const TESTLAB_FIXTURE: TestLabResults = {
  variants: [
    { label: 'Variant A', text: 'The all-in-one project management platform for modern teams.', score: 41 },
    { label: 'Variant B', text: 'Know which project is late before your client does.', score: 87 },
    { label: 'Variant C', text: 'Six people, one system, zero status meetings.', score: 74 },
  ],
  winnerLabel: 'Variant B',
  explanation:
    'Variant B wins because it names a specific, costly moment the buyer already fears and promises to remove it. ' +
    'Variant C is strong on aspiration but abstract about the mechanism. Variant A describes a category rather than an outcome, ' +
    'so it competes on features it never states. Lead with B in paid placements and keep C for organic where the tone can breathe.',
};

export const CONVERSION_DOCTOR_FIXTURE: AuditResult = {
  score: 58,
  summary:
    'The page explains what the product is but never states what changes for the buyer. The headline is a category label, ' +
    'the primary call to action sits below the fold, and social proof appears before the problem is established. ' +
    'Fixing the headline and moving the call to action are the two changes most likely to lift conversion.',
  issues: [
    { blocker: 'Headline names the category, not the outcome', impact: 'Visitors cannot tell in five seconds why this is better than what they already use.', severity: 'Critical' },
    { blocker: 'Primary call to action is below the fold', impact: 'Roughly half of visitors never see the button on a laptop viewport.', severity: 'High' },
    { blocker: 'Testimonials appear before the problem is stated', impact: 'Praise without context reads as filler and is skipped.', severity: 'Medium' },
    { blocker: 'Pricing is hidden behind a "Contact us" link', impact: 'Self-serve buyers leave to compare a competitor that shows numbers.', severity: 'High' },
    { blocker: 'Feature list has 14 bullet points of equal weight', impact: 'Nothing stands out, so nothing is remembered.', severity: 'Medium' },
  ],
  fixes: [
    { what: 'Rewrite the headline around the late-project moment', how: 'Lead with the risk the buyer already feels and the specific relief the product gives.', expectedResult: 'Clearer value in the first five seconds and a stronger reason to keep reading.', priority: 'High' },
    { what: 'Move the primary call to action into the hero', how: 'Place it directly under the sub-headline with one line of reassurance beneath it.', expectedResult: 'Every visitor sees the action without scrolling.', priority: 'High' },
    { what: 'Show a starting price', how: 'Add the entry plan price next to the call to action and link to full pricing.', expectedResult: 'Self-serve buyers qualify themselves instead of leaving.', priority: 'High' },
    { what: 'Cut the feature list to three outcomes', how: 'Group the 14 bullets into three benefits, each with one supporting feature.', expectedResult: 'Visitors remember what the product does for them.', priority: 'Medium' },
    { what: 'Move testimonials below the problem section', how: 'Place quotes after the section that explains the cost of late projects.', expectedResult: 'Praise lands as evidence rather than decoration.', priority: 'Low' },
  ],
  rewrites: [
    { label: 'Headline', original: 'The all-in-one project management platform for modern teams.', text: 'Know which project is late before your client does.' },
    { label: 'Sub-headline', original: 'Plan, track and collaborate in one place.', text: 'Every slipping commitment surfaces on one screen the morning it slips, with the reason attached.' },
    { label: 'Call to action', original: 'Request a demo', text: 'See your at-risk projects, free' },
  ],
  auditedUrl: 'https://example.com/',
};

export type FixtureKey = 'angle-miner' | 'test-lab' | 'conversion-doctor';

/**
 * Returns the fixture for `key` only in dev builds and only when the page URL carries `?fixture=1`.
 * In production `import.meta.env.DEV` is replaced by `false`, the whole branch is dead code, and the
 * dynamic import (and this module) disappear from the bundle.
 */
export const isFixtureRequested = (): boolean =>
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fixture') === '1';
