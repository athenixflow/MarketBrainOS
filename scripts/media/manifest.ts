// Declarative list of every generated / captured media slot. Prompts live here so they are reviewable.
// Change `pick` after reviewing media-src/contact-sheet.html, then run `npm run media:optimize`.
import type { Slot, ImageSlot, VideoSlot, GeneratedSlot } from './types';

// One visual language for every still: near-black, cold graphite/chrome/glass, a single crimson signal.
const STYLE =
  'Cinematic abstract still photograph. Near-black background, cold graphite and chrome tones, dark glass, ' +
  'soft volumetric haze, fine film grain, shallow depth of field, 50mm lens. Exactly one thin crimson red ' +
  'light element is the only color. No text, no letters, no logos, no people, no hands, no screens, no user ' +
  'interface, no charts. Photoreal, high-end product-photography lighting, restrained and quiet.';

const img = (s: Omit<ImageSlot, 'kind'>): ImageSlot => ({ kind: 'image', ...s });

const HERO: VideoSlot = {
  kind: 'video',
  id: 'hero',
  alt: '',
  aspect: '16:9',
  resolution: '1080p',
  duration: 8,
  web: { mobile720p: true, poster: true },
  prompt:
    'Slow, continuous forward dolly through a dark void where large panes of dark glass and thin graphite ' +
    'threads hang suspended at different depths. A single thin crimson light signal travels slowly along one ' +
    'thread, pulses gently, and branches into two. Cold chrome reflections, soft volumetric haze, fine film ' +
    'grain, near-black background. Very slow, steady camera, no cuts, no shake, seamless motion that could ' +
    'loop. No text, no logos, no people, no screens. Cinematic, quiet, precise.',
};

export const SLOTS: Slot[] = [
  HERO,

  img({
    id: 'problem',
    pick: 2,
    alt: 'Scattered red points dissolving into static, with one coherent red line cutting through',
    aspect: '4:3',
    resolution: '2K',
    web: { widths: [1400, 800] },
    prompt:
      STYLE +
      ' Subject: thousands of faint, dim red points scattered across black, dissolving into noise and ' +
      'static toward the edges, while one thin coherent crimson line cuts cleanly through the center from ' +
      'left to right. Macro dark glass surface, subtle chrome reflection at the bottom.',
  }),

  img({
    id: 'audience-founders',
    pick: 1,
    alt: '',
    aspect: '16:9',
    resolution: '1K',
    web: { widths: [900, 500] },
    prompt:
      STYLE +
      ' Subject: a single glowing crimson filament suspended in the center of a small dark glass ' +
      'chamber, chrome frame edges catching a faint highlight, deep black surroundings.',
  }),

  img({
    id: 'audience-agencies',
    pick: 1,
    alt: '',
    aspect: '16:9',
    resolution: '1K',
    web: { widths: [900, 500] },
    prompt:
      STYLE +
      ' Subject: three tall panes of dark glass standing in parallel in a dark studio, evenly spaced, ' +
      'each carrying one faint thin crimson trace line at a slightly different height, receding into haze.',
  }),

  img({
    id: 'audience-growth',
    pick: 2,
    alt: '',
    aspect: '16:9',
    resolution: '1K',
    web: { widths: [900, 500] },
    prompt:
      STYLE +
      ' Subject: a dense lattice of very thin graphite lines converging from all edges toward a single ' +
      'small crimson node just right of center, seen at a slight angle, shallow focus on the node.',
  }),

  img({
    id: 'about',
    pick: 2,
    alt: 'Dark fog clearing to reveal a chrome instrument with a single red indicator',
    aspect: '3:2',
    resolution: '2K',
    web: { widths: [1400, 800] },
    prompt:
      STYLE +
      ' Subject: dark fog slowly clearing to reveal a sharp, precise chrome measuring instrument on ' +
      'a matte black surface, one small crimson indicator lit on its face. Calm, clinical, exact.',
  }),

  img({
    id: 'features',
    alt: 'A wide bench of matte black instruments with thin red indicator lines',
    aspect: '21:9',
    resolution: '2K',
    web: { widths: [2000, 1000] },
    prompt:
      STYLE +
      ' Subject: a very wide low bench of matte black precision instruments lined up in a row, each ' +
      'with one thin crimson indicator line, seen from a low angle in a dark studio, haze in the background.',
  }),

  // Real product screenshots, captured by hand from the running app into media-src/screens/.
  { kind: 'screenshot', id: 'shot-angleminer', alt: 'AngleMiner X results showing generated marketing angles', source: 'media-src/screens/angleminer.png', web: { widths: [1280, 800] } },
  { kind: 'screenshot', id: 'shot-testlab', alt: 'TestLab Pro comparing two variants with predicted scores', source: 'media-src/screens/testlab.png', web: { widths: [1280, 800] } },
  { kind: 'screenshot', id: 'shot-doctor', alt: 'Conversion Doctor diagnosis listing blockers and prescriptions', source: 'media-src/screens/doctor.png', web: { widths: [1280, 800] } },
];

export const generatedSlots = (): GeneratedSlot[] => SLOTS.filter((s): s is GeneratedSlot => s.kind !== 'screenshot');

/** Static kie.ai rules, checked before any credit is spent. Returns a list of problems (empty = ok). */
export function validateSlot(slot: Slot): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9-]+$/.test(slot.id)) errs.push(`id "${slot.id}" must be kebab-case`);
  if (slot.kind === 'image') {
    if (slot.prompt.length < 1 || slot.prompt.length > 20000) errs.push('prompt must be 1-20000 chars');
    if (slot.aspect === '1:1' && slot.resolution === '4K') errs.push('1:1 cannot be 4K');
    if (['5:4', '4:5', '3:1', '1:3', '9:21'].includes(slot.aspect) && slot.resolution !== '1K') errs.push(`${slot.aspect} only supports 1K`);
    if (slot.background && slot.resolution !== '1K') errs.push('background only supported at 1K');
    if (!slot.web.widths.length) errs.push('web.widths must not be empty');
  } else if (slot.kind === 'video') {
    if (slot.prompt.length < 3 || slot.prompt.length > 30000) errs.push('prompt must be 3-30000 chars');
    if (!Number.isInteger(slot.duration) || slot.duration < 4 || slot.duration > 30) errs.push('duration must be an integer 4-30');
  }
  if (slot.kind !== 'screenshot') {
    const c = slot.candidates ?? 2;
    if (!Number.isInteger(c) || c < 1 || c > 6) errs.push('candidates must be 1-6');
  }
  if (slot.pick !== undefined && (!Number.isInteger(slot.pick) || slot.pick < 1)) errs.push('pick must be a positive integer');
  return errs;
}

export const MODEL_BY_KIND = { image: 'gpt-image-2-text-to-image', video: 'bytedance/seedance-2-5' } as const;

export function buildInput(slot: GeneratedSlot): Record<string, unknown> {
  if (slot.kind === 'image') {
    return {
      prompt: slot.prompt,
      aspect_ratio: slot.aspect,
      resolution: slot.resolution,
      ...(slot.background ? { background: slot.background } : {}),
    };
  }
  return {
    prompt: slot.prompt,
    aspect_ratio: slot.aspect,
    resolution: slot.resolution,
    duration: slot.duration,
    generate_audio: false,
    output_format: 'mp4',
  };
}
