/**
 * The 100-page study's published numbers (GTM part 14 §1C), as the report page reads them.
 *
 * `landingPageStudy2026.json` is WRITTEN BY scripts/study/aggregate.ts and edited by hand in
 * exactly one place: `published`, which a person flips to true after reading the result. Until
 * then the page renders as "being prepared", is noindex, and stays out of the prerender and the
 * sitemap — the same rule the comparison pages follow, for the same reason: a number on a public
 * page is a claim, and nobody has stood behind this one yet.
 */
import raw from './landingPageStudy2026.json';

export interface Rate { num: number; den: number; pct: number | null }

export interface SegmentSummary {
  n: number;
  mean: number | null; median: number | null; p25: number | null; p75: number | null;
  min: number | null; max: number | null;
  under50: Rate; anyCritical: Rate; meanIssues: number | null;
  buckets: { from: number; to: number; count: number }[];
  categories: { id: string; label: string; pages: Rate; leading: Rate }[];
}

export interface StudySummary {
  study: string;
  published: boolean;
  generated_at: string | null;
  method?: {
    audit_model: string; classify_model: string;
    fetched_from: string | null; fetched_to: string | null;
    listed: number; audited: number;
    excluded: { total: number; unreadable: number; robots: number; model_error: number; thin: number };
    min_cell: number; thin_cutoff: number; median_with_thin: number | null;
  };
  all?: SegmentSummary; africa?: SegmentSummary; global?: SegmentSummary;
  gap?: { mean: number | null; median: number | null };
  groups?: { group: string; n: number; median: number | null; mean: number | null }[];
}

export const STUDY: StudySummary = raw as StudySummary;
export const STUDY_PATH = '/research/landing-page-study-2026';
export const STUDY_CSV = '/research/landing-page-study-2026.csv';

/** Published = a person said so AND there is a result to publish. Either alone is not enough. */
export const isStudyPublished = (s: StudySummary = STUDY): boolean =>
  s.published === true && !!s.all && s.all.n > 0 && !!s.method;
