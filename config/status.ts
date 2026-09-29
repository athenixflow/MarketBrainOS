/**
 * The service status, as a person last reported it (GTM part 14 §8.2, launch gate G7).
 *
 * WRITTEN BY HAND, AND SAYS SO. This is not a monitor: nothing here pings the API. A status page
 * that reads "Operational" because nobody changed a string is the same lie the footer used to tell
 * (it was hard-coded). So the page prints when this was last updated and by what means, and during
 * an incident the fix is: edit this file, push, and the site redeploys in about four minutes.
 */

export type ServiceState = 'operational' | 'degraded' | 'outage';

export interface Incident {
  /** ISO date-time the incident started. */
  started: string;
  /** ISO date-time it was resolved; null while ongoing. */
  resolved: string | null;
  title: string;
  /** What happened and what users should do, in plain words. */
  detail: string;
}

export const STATUS: { state: ServiceState; updated: string; message: string; incidents: Incident[] } = {
  state: 'operational',
  updated: '2026-09-29T15:00:00Z',
  message: 'All tools are running normally.',
  incidents: [],
};

export const STATE_LABEL: Record<ServiceState, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  outage: 'Outage',
};
