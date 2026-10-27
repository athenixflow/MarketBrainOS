/**
 * Pages that carry their own chrome (PublicLayout, or the docs hub's own nav) and render full-width
 * for every visitor, signed in or not. App.tsx hides the app header and sidebar on these; if a page
 * that uses PublicLayout is missing here, a signed-in user sees both navs stacked.
 * scripts/public-routes.test.ts checks every such route against this list.
 */
const MARKETING_EXACT = ['/features', '/pricing', '/about', '/faq', '/privacy', '/terms', '/press', '/status', '/tools/landing-page-score'];
const MARKETING_PREFIX = ['/compare', '/research'];
const underPrefix = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/* The marketing pages proper: what a signed-out visitor arrives on (AnalyticsBridge counts these). */
export const isMarketingRoute = (path: string): boolean =>
  MARKETING_EXACT.includes(path) || underPrefix(path, MARKETING_PREFIX);

/* Marketing pages plus the docs hub (its own full-bleed mini-app) and the email-action page. */
export const isPublicRoute = (path: string): boolean =>
  isMarketingRoute(path) || underPrefix(path, ['/documentation']) || path === '/auth/action';
