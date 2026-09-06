// Shared types for the dev-time media pipeline (scripts/media/*). Never imported by app code.

export type ImageAspect =
  | 'auto' | '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16'
  | '2:1' | '1:2' | '3:1' | '1:3' | '21:9' | '9:21';
export type ImageResolution = '1K' | '2K' | '4K';
export type VideoAspect = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | 'adaptive';
export type VideoResolution = '480p' | '720p' | '1080p';

interface SlotBase {
  /** Stable id; becomes the file stem in media-src/ and assets/media/. */
  id: string;
  /** Alt text shipped with the asset (empty string for purely decorative imagery). */
  alt: string;
  /** 1-based candidate the optimize step ships. Default 1. */
  pick?: number;
}

export interface ImageSlot extends SlotBase {
  kind: 'image';
  prompt: string;
  aspect: ImageAspect;
  resolution: ImageResolution;
  background?: 'transparent' | 'opaque' | 'auto';
  /** How many candidates to generate. Default 2. */
  candidates?: number;
  /** Output widths (px) for the responsive <picture>. Largest first. */
  web: { widths: number[] };
}

export interface VideoSlot extends SlotBase {
  kind: 'video';
  prompt: string;
  aspect: VideoAspect;
  resolution: VideoResolution;
  /** Seconds, integer 4-30. */
  duration: number;
  candidates?: number;
  web: { mobile720p: boolean; poster: boolean };
}

/** A hand-captured file (e.g. a real app screenshot) that only goes through optimize, never generate. */
export interface ScreenshotSlot extends SlotBase {
  kind: 'screenshot';
  /** Path relative to the repo root, e.g. media-src/screens/angleminer.png */
  source: string;
  web: { widths: number[] };
}

export type Slot = ImageSlot | VideoSlot | ScreenshotSlot;
export type GeneratedSlot = ImageSlot | VideoSlot;

export interface GeneratedEntry {
  slot: string;
  n: number;
  kind: 'image' | 'video';
  model: string;
  taskId: string;
  status: 'submitted' | 'success' | 'fail';
  prompt: string;
  input: Record<string, unknown>;
  url?: string;
  localPath?: string;
  creditsConsumed?: number;
  costTime?: number;
  failCode?: string;
  failMsg?: string;
  submittedAt: string;
  completedAt?: string;
}

export interface MediaManifest {
  version: 1;
  entries: GeneratedEntry[];
}
