// Asserts that no analysis result renders as a blank item.
//
// This exists because Conversion Doctor's "Recommended fixes" shipped as five empty bullets - on
// screen AND in the exported PDF. The History mapper read `x.fix`, a field that has never existed,
// so `x.fix || x` passed the raw { what, how, expectedResult, priority } object through and every
// renderer coerced it to ''. Nothing threw. Nothing logged. The content simply was not there.
//
// Blank is the failure mode that hides, so this test asserts the one property that would have caught
// it: every item produced by every bespoke mapper must coerce to non-empty text, through BOTH the
// screen path and the export path.
//
//   npx tsx scripts/results.test.ts
//
// Wired into `npm run build`.

import { angleResult, testlabResult, doctorResult, workflowResult } from '../services/bespokeMappers';
import { asText } from '../services/resultItems';
import { ANGLE_MINER_FIXTURE, TESTLAB_FIXTURE, CONVERSION_DOCTOR_FIXTURE } from '../services/devFixtures';

// Mirrors itemToText in services/exportService.ts (which cannot be imported here: it touches
// document/window). If that function changes shape, this must follow.
const exportText = (item: any): string => {
  if (typeof item === 'string') return item;
  const parts = [asText(item)];
  if (item.evidence) parts.push(`Why: ${asText(item.evidence)}`);
  if (item.action) parts.push(`Action: ${asText(item.action)}`);
  return parts.filter(Boolean).join(' — ');
};

const cases: Array<{ tool: string; result: any; expectSections: number }> = [
  // 3 = blockers, fixes, rewrites. Rewrites were missing from History until Sep 2026.
  { tool: 'Conversion Doctor', expectSections: 3,
    result: doctorResult({ audit_output: CONVERSION_DOCTOR_FIXTURE, conversion_score: CONVERSION_DOCTOR_FIXTURE.score }) },
  { tool: 'AngleMiner X', expectSections: 2,
    result: angleResult({ angles_output: ANGLE_MINER_FIXTURE }) },
  { tool: 'TestLab Pro', expectSections: 1,
    result: testlabResult({ results: TESTLAB_FIXTURE, winner: TESTLAB_FIXTURE.winnerLabel }) },
  { tool: 'Workflow Pipeline', expectSections: 1,
    result: workflowResult({ selected_angle: 'The late-project angle',
      final_output: { headline: 'Know which project is late', cta: 'See your at-risk projects', offer: 'Free for 14 days' } }) },
];

let failures = 0;
let checked = 0;

for (const { tool, result, expectSections } of cases) {
  const sections = result.sections || [];
  console.log(`\n${tool} — ${sections.length} section(s)`);
  if (sections.length !== expectSections) {
    console.error(`  FAIL expected ${expectSections} sections, produced ${sections.length}`);
    failures++;
  }
  for (const section of sections) {
    const items = section.items || [];
    if (!items.length) { console.error(`  FAIL "${section.title}" produced no items`); failures++; continue; }
    const blankScreen: number[] = [];
    const blankExport: number[] = [];
    items.forEach((item: any, i: number) => {
      checked++;
      if (!asText(item).trim()) blankScreen.push(i);
      if (!exportText(item).trim()) blankExport.push(i);
    });
    if (blankScreen.length || blankExport.length) {
      failures++;
      console.error(`  FAIL "${section.title}" (${items.length} items)`);
      if (blankScreen.length) console.error(`         blank on screen at index: ${blankScreen.join(', ')}`);
      if (blankExport.length) console.error(`         blank in export at index: ${blankExport.join(', ')}`);
      console.error(`         first offending item: ${JSON.stringify(items[(blankScreen[0] ?? blankExport[0])])}`);
    } else {
      console.log(`  ok   "${section.title}" — ${items.length} items, none blank`);
      console.log(`         e.g. ${asText(items[0]).slice(0, 72)}`);
    }
  }
}

console.log(`\n${checked} items checked across ${cases.length} tools`);
if (failures) {
  console.error(`\n${failures} failure(s). An item that coerces to empty text renders as a blank bullet\n` +
                `on screen and in the exported PDF, with no error anywhere. Check the field names in\n` +
                `services/bespokeMappers.ts against the types in types.ts.\n`);
  process.exit(1);
}
console.log('\nPASS — every item renders as text in both the screen and export paths.\n');
