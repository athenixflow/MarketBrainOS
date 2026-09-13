// Pure record -> ToolAnalysisResult mappers for the four bespoke tool collections.
//
// They live here, apart from persistenceService, for one reason: persistenceService imports
// ./firebase, which initialises the SDK at module load, so nothing that imports it can be exercised
// by a plain node test. Keeping these pure and dependency-free is what lets
// scripts/results.test.mjs feed them real fixtures and assert nothing renders blank.
//
// That test exists because of a bug these mappers shipped: the Conversion Doctor "Recommended fixes"
// section read `x.fix`, a field that has never existed (a fix is { what, how, expectedResult,
// priority } - see AuditFix in types.ts). `x.fix || x` therefore passed the raw object through, and
// every renderer coerced an unrecognised object to an empty string. Five fixes rendered as five blank
// bullets on screen and in the exported PDF, and nothing errored or logged.

/** Conversion Doctor. Structured items so History matches the detail the live tool page shows. */
export const doctorResult = (v: any): any => {
  const res = v?.audit_output || {};
  const issues = res.issues || [];
  const fixes = res.fixes || [];
  // Rewrites are the ready-to-paste copy the audit produces (see AuditRewrite in types.ts). They
  // were left out of this mapper, so History - and every export made from History - silently
  // dropped the part of the result users most often want to take away.
  const rewrites = (res.rewrites || []).filter((r: any) => r && (r.text || typeof r === 'string'));
  return {
    score: v?.conversion_score ?? res.score,
    summary: res.summary || '',
    sections: [
      ...(issues.length ? [{
        title: 'Conversion blockers',
        items: issues.map((x: any) => (typeof x === 'string' ? x : {
          insight: x.blocker,
          evidence: [x.impact, x.severity && `Severity: ${x.severity}`].filter(Boolean).join(' '),
        })),
      }] : []),
      ...(fixes.length ? [{
        title: 'Recommended fixes',
        items: fixes.map((x: any) => (typeof x === 'string' ? x : {
          insight: x.what,
          evidence: [x.expectedResult, x.priority && `Priority: ${x.priority}`].filter(Boolean).join(' '),
          action: x.how,
        })),
      }] : []),
      ...(rewrites.length ? [{
        title: 'Rewrites',
        // Plain strings on purpose: the structured item labels ("Why it matters", "Do this") do not
        // fit a piece of copy and its predecessor.
        items: rewrites.map((r: any) => (typeof r === 'string' ? r
          : `${r.label || 'Copy'}: "${r.text}"${r.original ? ` (was: "${r.original}")` : ''}`)),
      }] : []),
    ],
  };
};

/** AngleMiner X. */
export const angleResult = (v: any): any => {
  const res = v?.angles_output || {};
  const angles = res.angles || [];
  const hooks = res.hooks || [];
  return {
    summary: `${angles.length} marketing angle${angles.length === 1 ? '' : 's'}${hooks.length ? ` and ${hooks.length} platform hooks` : ''}.`,
    sections: [
      ...(angles.length ? [{ title: 'Angles', items: angles.map((a: any) => `${a.title}: "${a.improved || a.hook}"`) }] : []),
      ...(hooks.length ? [{ title: 'Hooks', items: hooks.map((h: any) => `[${[h.channel, h.platform].filter(Boolean).join(' · ') || 'General'}] "${h.short}"`) }] : []),
    ],
  };
};

/** TestLab Pro. */
export const testlabResult = (v: any): any => {
  const res = v?.results || {};
  const variants = res.variants || [];
  const winner = variants.find((x: any) => x.label === res.winnerLabel);
  return {
    score: winner?.score,
    verdict: v?.winner ? `${v.winner} wins` : undefined,
    summary: res.explanation || '',
    sections: variants.length ? [{ title: 'Variation scores', items: variants.map((x: any) => `${x.label} (${x.score}/100): "${x.text}"`) }] : [],
  };
};

/** Workflow pipeline. */
export const workflowResult = (v: any): any => {
  const f = v?.final_output || {};
  const assets = [f.headline && `Headline: "${f.headline}"`, f.cta && `CTA: "${f.cta}"`, f.offer && `Offer: "${f.offer}"`].filter(Boolean);
  return {
    summary: v?.selected_angle ? `Built from the angle: "${v.selected_angle}"` : 'Workflow run.',
    sections: assets.length ? [{ title: 'Final assets', items: assets }] : [],
  };
};
