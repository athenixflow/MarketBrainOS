import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import {
  captureAttribution, cohortWeek, readAttribution, setAnalyticsContext, track,
} from '../services/analytics';

/**
 * WHAT EVERY EVENT CARRIES, AND THE ONE EVENT THAT HAS NO OTHER HOME (GTM E01).
 *
 * Two jobs, both of which have to happen in one place or not at all:
 *
 * 1. THE AMBIENT CONTEXT. Part 03 §7.1 puts `plan_tier`, `scope_type`, `signup_source`,
 *    `cohort_week` and `is_activated` on every event, because a funnel that cannot be cut
 *    by plan and channel answers "how many" and never "which of them". Setting those at
 *    each call site would mean every future event remembering to — and the first one that
 *    forgot would quietly produce a cohort of unattributable rows.
 *
 * 2. `landing_view`, which belongs to the router rather than to any page: the marketing
 *    pages are a SPA, so only the very first arrival is a document load. Without this, a
 *    visitor who reads the landing page, features and pricing registers as one view and
 *    the funnel's top is understated by a factor of however curious they were.
 *
 * IT RENDERS NOTHING. Mounted inside the providers it reads, above the routes it watches.
 */
const AnalyticsBridge: React.FC = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { scope } = useScope();

  /* First touch, once per visit — before any event can need it. */
  useEffect(() => { captureAttribution(); }, []);

  useEffect(() => {
    setAnalyticsContext({
      plan_tier: profile?.tier ?? (user ? 'unknown' : 'anonymous'),
      scope_type: scope.level,
      signup_source: readAttribution().signup_source,
      /*
       * The cohort of the ACCOUNT, not of today — a retention table keyed on "this week"
       * would put every returning user in the current cohort and show 100% retention
       * forever. Absent a created_at on the profile, this is set at signup by the server
       * and left alone here; anonymous visitors carry the current week, which is what a
       * landing-page cohort means.
       */
      cohort_week: cohortWeek(),
      is_activated: (profile?.analyses_count ?? 0) >= 2,
    });
  }, [user, profile, scope.level]);

  /*
   * MARKETING ROUTES ONLY. Firing this inside the signed-in app would count a person
   * moving between tools as an arrival and make the acquisition funnel's top meaningless.
   * The list mirrors App.tsx's PUBLIC_ROUTES; `/` is included because it is the landing
   * page for a signed-out visitor and the dashboard for everybody else.
   */
  useEffect(() => {
    const path = location.pathname;
    const isMarketing = !user && (path === '/' || [
      '/features', '/pricing', '/about', '/faq', '/privacy', '/terms', '/auth',
    ].includes(path));
    if (!isMarketing) return;
    track('landing_view', { page: path });
  }, [location.pathname, user]);

  return null;
};

export default AnalyticsBridge;
