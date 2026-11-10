// The UI groups hooks into Ads / Organic / Funnel columns. `channel` is pinned by ANGLE_MINER_SCHEMA so the
// model cannot answer with an unrelated vocabulary; `platform` stays free text and is shown as a label
// on each card. (The prompt previously suggested platforms like "Meta"/"Google" with no channel at all,
// so the UI's Ads/Organic/Funnel filter matched nothing and every column rendered empty.)
export const HOOK_CHANNELS = ['Ads', 'Organic', 'Funnel'] as const;

/*
 * Gemini enforces ANGLE_MINER_SCHEMA; DeepSeek's JSON mode guarantees JSON but no shape, so the parsed
 * result is checked here for every provider. A channel that matches HOOK_CHANNELS in any letter case is
 * written in the UI's spelling ("ads" -> "Ads"); anything else is kept as it came, and the page shows it
 * under "Other". A reply with no angles is an error, so the run fails and refunds instead of
 * charging for an empty report.
 */
export const normaliseAngleMiner = (out: any): any => {
  const angles = Array.isArray(out?.angles) ? out.angles.filter((a: any) => a && typeof a === 'object' && a.title) : [];
  if (!angles.length) throw new Error('AngleMiner: no angles in the response');
  const hooks = (Array.isArray(out?.hooks) ? out.hooks : [])
    .filter((h: any) => h && typeof h === 'object')
    .map((h: any) => {
      const channel = HOOK_CHANNELS.find((c) => c.toLowerCase() === String(h.channel || '').trim().toLowerCase());
      return channel ? { ...h, channel } : h;
    });
  return { ...out, angles, hooks };
};
