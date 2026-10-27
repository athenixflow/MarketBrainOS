import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { safeNext } from './config/auth';
import { NavigationItem } from './types';
// Eager: first-paint surfaces (logged-out landing + auth).
import AuthPage from './pages/Auth';
import LandingPage from './pages/LandingPage';
// Lazy-loaded route targets (code-split — see vite.config manualChunks). §78
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AngleMinerX = lazy(() => import('./pages/AngleMinerX'));
const ConversionDoctor = lazy(() => import('./pages/ConversionDoctor'));
const Workflow = lazy(() => import('./pages/Workflow'));
const TestLabPro = lazy(() => import('./pages/TestLabPro'));
const Documentation = lazy(() => import('./pages/Documentation'));
const AdminPortal = lazy(() => import('./components/admin/AdminPortal'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const ToolPage = lazy(() => import('./components/ToolPage'));
const History = lazy(() => import('./pages/History'));
const TeamWorkspace = lazy(() => import('./pages/TeamWorkspace'));
const AgencyHub = lazy(() => import('./pages/AgencyHub'));
const EnterpriseSuite = lazy(() => import('./pages/EnterpriseSuite'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const TokenStorePage = lazy(() => import('./pages/TokenStore'));
const BillingCenter = lazy(() => import('./pages/BillingCenter'));
const Support = lazy(() => import('./pages/Support'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const NotFound = lazy(() => import('./pages/NotFound'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScopeProvider, useScope } from './context/ScopeContext';
import { Honeypot, LoadingState } from './components/UI';
import OnboardingOverlay from './components/OnboardingOverlay';
import ConsentBanner from './components/ConsentBanner';
import AnalyticsBridge from './components/AnalyticsBridge';
import AppHeader from './components/AppHeader';
import ScopeSwitcher from './components/ScopeSwitcher';
import { TOOL_CONFIG_LIST, NAV_SUITES } from './config/toolConfigs';
import { NAV_CORE, NAV_COLLABORATION, NAV_ACCOUNT, visibleLinks, NavLink } from './config/access';
import { visibleAdminSections, adminPath } from './config/adminAccess';
import { isPublicRoute } from './config/publicRoutes';
import { useOverlayLock, useMediaQuery } from './components/useOverlayLock';
import LandingPageScore from './pages/LandingPageScore';
import LandingPageStudy from './pages/LandingPageStudy';
import Status from './pages/Status';
import Press from './pages/Press';
import Compare from './pages/Compare';
import CompareHub from './pages/CompareHub';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { profile } = useAuth();
  const { memberships } = useScope();
  
  const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'ops_admin';
  // STRICT CHECK: Only show admin layout if user is actually an admin
  const isAdminPath = location.pathname.startsWith('/admin') && isAdminRole;

  // Centralized feature visibility (config/access.ts) — a user only sees what their plan or
  // membership grants. Same context powers the Dashboard quick-actions, so hidden = hidden everywhere.
  const accessCtx = { profile, memberships };

  // Below lg the sidebar is a drawer over the page: Escape closes it, the page behind stops
  // scrolling, and while it is closed (off-canvas) its links leave the tab order.
  const isDrawer = useMediaQuery('(max-width: 1023.98px)');
  useOverlayLock(isOpen && isDrawer, onClose);
  const drawerHidden = isDrawer && !isOpen ? ({ inert: '', 'aria-hidden': true } as Record<string, unknown>) : {};

  const renderNavLink = (link: NavLink, size: 'lg' | 'sm' = 'lg') => {
    // Non-exact links also highlight on their sub-paths (e.g. /team/... keeps Team Workspace lit).
    const isActive = link.exact
      ? location.pathname === link.path
      : location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
    const pad = size === 'lg' ? 'py-3.5 text-[12px]' : 'py-3 text-[11px]';
    return (
      <Link
        key={link.path}
        to={link.path}
        onClick={onClose}
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center gap-4 px-5 ${pad} font-bold tracking-widest uppercase rounded-2xl transition-all duration-300 mb-1 group ${
          isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
        {link.label}
      </Link>
    );
  };

  // Overlay for mobile
  const MobileOverlay = () => (
    <div 
      className={`fixed inset-0 bg-black/80 z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    />
  );

  const sidebarClasses = `
    w-72 bg-[#0B0B0B] flex flex-col border-r border-gray-900/30 z-50
    transition-transform duration-300 ease-in-out
    fixed left-0
    /* Mobile Styles */
    top-0 h-full
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    /* Desktop: offset by the 64px header, so the height must subtract it. lg:h-full resolved to
       100vh against the viewport and pushed the footer (Admin link + token panel) below the fold,
       where it could not be reached - overflow-y-auto is on the <nav>, not on this element. */
    lg:translate-x-0 lg:top-16 lg:h-[calc(100vh-4rem)] lg:z-10
  `;

  if (isAdminPath) {
    return (
      <>
        <MobileOverlay />
        <aside className={sidebarClasses} {...drawerHidden}>
          {/* Mobile Header inside Drawer */}
          <div className="flex items-center justify-between p-6 lg:hidden border-b border-gray-900/30">
             <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Menu</span>
             <button type="button" onClick={onClose} aria-label="Close navigation" className="text-white p-2">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
          </div>

          <nav className="flex-grow py-6 px-4 lg:py-8 lg:px-6 overflow-y-auto no-scrollbar">
            <div className="px-5 pb-6 mb-6 border-b border-gray-900/50">
               <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Control Center</p>
            </div>
            {visibleAdminSections(profile?.role).map((grp) => (
              <div key={grp.group} className="mb-6">
                <p className="px-5 mb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{grp.group}</p>
                {grp.items.map((item) => {
                  const path = adminPath(item.key);
                  const isActive = location.pathname === path || (item.key === '' && location.pathname === '/admin');
                  return (
                    <Link
                      key={item.key || 'overview'}
                      to={path}
                      onClick={onClose}
                      className={`flex items-center gap-4 px-6 py-3 text-[12px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-300 mb-1 group ${
                        isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-gray-900/50">
              <Link to="/" onClick={onClose} className="flex items-center gap-4 px-6 py-3 text-[12px] font-bold tracking-widest uppercase rounded-2xl text-gray-400 hover:text-white transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                Exit Admin
              </Link>
            </div>
          </nav>
        </aside>
      </>
    );
  }

  return (
    <>
      <MobileOverlay />
      <aside id="app-sidebar" className={sidebarClasses} {...drawerHidden}>
        {/* Mobile Header inside Drawer */}
        <div className="flex items-center justify-between p-6 lg:hidden border-b border-gray-900/30">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Navigation</span>
           <button type="button" onClick={onClose} aria-label="Close navigation" className="text-white p-2">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>
        {/* The header's ScopeSwitcher is hidden under 640px, and Team/client pages auto-enter their scope,
            so on a phone there was no way back to Personal. It lives in the drawer too. */}
        <div className="px-6 py-4 md:hidden border-b border-gray-900/30 flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scope</span>
          <ScopeSwitcher />
        </div>

        <nav className="flex-grow py-6 px-4 lg:py-8 lg:px-6 overflow-y-auto no-scrollbar">
          {/* Core — Dashboard, History, Reports (always visible to a signed-in user) */}
          {visibleLinks(NAV_CORE, accessCtx).map((link) => renderNavLink(link, 'lg'))}

          {/* Analysis Tools — data-driven suites (V1 Tool Architecture grouping) */}
          {NAV_SUITES.map((group) => (
            <div key={group.suite} className="mt-6">
              <p className="px-5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.suite}</p>
              {group.items.map((item) => renderNavLink({ label: item.label, path: item.path }, 'sm'))}
            </div>
          ))}

          {/* Collaboration — Team / Agency / Enterprise, gated by plan or membership */}
          {(() => {
            const links = visibleLinks(NAV_COLLABORATION, accessCtx);
            if (links.length === 0) return null;
            return (
              <div className="mt-6">
                <p className="px-5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{NAV_COLLABORATION.heading}</p>
                {links.map((link) => renderNavLink(link, 'sm'))}
              </div>
            );
          })()}

          {/* Account — Billing / Settings / Support */}
          <div className="mt-6">
            <p className="px-5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{NAV_ACCOUNT.heading}</p>
            {visibleLinks(NAV_ACCOUNT, accessCtx).map((link) => renderNavLink(link, 'sm'))}
          </div>
        </nav>
        <div className="p-4 lg:p-6 border-t border-gray-900/30">
          {isAdminRole && (
            <Link
              to="/admin"
              onClick={onClose}
              className="block mb-4 px-5 py-4 bg-red-950/20 rounded-2xl border border-red-900/30 hover:bg-red-950/40 transition-colors"
            >
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Admin Control</p>
              <p className="text-[9px] text-red-500/60 uppercase font-bold mt-1">{profile?.role.replace('_', ' ')}</p>
            </Link>
          )}
          {profile && (
            <Link to="/billing" onClick={onClose} className="block px-5 py-4 bg-[#121212] rounded-2xl border border-gray-900 hover:border-gray-700 transition-colors">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Token balance</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-white tabular-nums leading-none">{profile.tokens}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">tokens</span>
              </div>
              {profile.tokens === 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest">Balance exhausted</p>
                </div>
              )}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};

// --- SIGN-IN GUARD ---
// A signed-out visitor goes to /auth with the page they asked for in ?next= (a query string survives
// Google's redirect sign-in; router state would not), and comes back to it afterwards.
const SignInFirst: React.FC = () => {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/auth?next=${encodeURIComponent(pathname + search + hash)}`} replace />;
};
// Signed in while on /auth: go where ?next= says (a path on this site only), else the dashboard.
const AfterSignIn: React.FC = () => {
  const [params] = useSearchParams();
  return <Navigate to={safeNext(params.get('next')) ?? '/'} replace />;
};

// --- ADMIN GUARD ---
// Enforces role-based security at the routing level.
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingState message="Verifying Security Clearance..." />;
  
  // 1. Must be authenticated
  if (!user) return <SignInFirst />;

  // 2. Must be an admin
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'ops_admin';
  
  if (!isAdmin) {
    // Redirect unauthorized users back to safety
    return <Navigate to="/" replace />;
  }

  // 3. Access Granted
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  // Was `return null`: on a phone, a deep link showed the marketing shell, then a blank screen for
  // as long as Firebase took to restore the session. A visible state is not a fix for slowness,
  // but a blank page reads as broken.
  if (loading) return <LoadingState message="Loading your workspace" />;

  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
    <Routes>
      {/* Route root: If user logged in, Dashboard. If not, LandingPage. */}
      <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
      
      {/* Protected Routes */}
      <Route path="/history" element={user ? <History /> : <SignInFirst />} />
      <Route path="/reports" element={user ? <Reports /> : <SignInFirst />} />
      <Route path="/settings" element={user ? <Settings /> : <SignInFirst />} />
      <Route path="/store" element={user ? <TokenStorePage /> : <SignInFirst />} />
      <Route path="/billing" element={user ? <BillingCenter /> : <SignInFirst />} />
      <Route path="/support" element={user ? <Support /> : <SignInFirst />} />
      <Route path="/team" element={user ? <TeamWorkspace /> : <SignInFirst />} />
      <Route path="/agency" element={user ? <AgencyHub /> : <SignInFirst />} />
      <Route path="/enterprise" element={user ? <EnterpriseSuite /> : <SignInFirst />} />
      <Route path="/angle-miner" element={user ? <AngleMinerX /> : <SignInFirst />} />
      <Route path="/test-lab" element={user ? <TestLabPro /> : <SignInFirst />} />
      <Route path="/conversion-doctor" element={user ? <ConversionDoctor /> : <SignInFirst />} />
      <Route path="/workflow" element={user ? <Workflow /> : <SignInFirst />} />

      {/* PRD §14–22 analysis tools */}
      {TOOL_CONFIG_LIST.map((tool) => (
        <Route
          key={tool.slug}
          path={`/${tool.slug}`}
          element={user ? <ToolPage config={tool} /> : <SignInFirst />}
        />
      ))}

      {/* SECURE ADMIN ROUTE — dedicated multi-section portal (nested routes inside AdminPortal) */}
      <Route path="/admin/*" element={
        <AdminGuard>
          <AdminPortal />
        </AdminGuard>
      } />
      
      {/* Public Routes */}
      <Route path="/documentation/*" element={<Documentation />} />
      <Route path="/features" element={<Features />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/about" element={<About />} />
      <Route path="/faq" element={<FAQ />} />
      {/* GTM part 10 — the free scorer. A marketing route: prerendered, public, no auth. */}
      <Route path="/tools/landing-page-score" element={<LandingPageScore />} />
      <Route path="/research/landing-page-study-2026" element={<LandingPageStudy />} />
      <Route path="/status" element={<Status />} />
      <Route path="/press" element={<Press />} />
      {/* GTM part 10 §4.2 — `/compare/<slug>` only. A second `/vs/` pattern for the
          same intent would be self-inflicted duplicate content. */}
      {/* The hub the comparison breadcrumbs point at. Declared BEFORE the slug route
          so `/compare` resolves to the hub rather than a comparison named nothing. */}
      <Route path="/compare" element={<CompareHub />} />
      <Route path="/compare/:slug" element={<Compare />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/auth" element={user ? <AfterSignIn /> : <AuthPage />} />
      <Route path="/auth/action" element={<AuthAction />} />

      {/* Catch-all — branded 404 for any unmatched path (adapts to auth state) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const AppContainer: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Shares the single lockdown subscription with Header rather than polling separately.
  const { user, profile, isSystemLocked: isEmergency } = useAuth();

  // Back-compat: the app moved from HashRouter to clean URLs. Old links like
  // https://…/#/pricing still land here — redirect the hash path to the real route once on load.
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith('#/')) navigate(h.slice(1), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public pages carry their own chrome (PublicLayout, or the docs hub's nav) and render full-width
  // even for logged-in users, otherwise the app sidebar/header double up with the public nav.
  // The list lives in config/publicRoutes.ts; scripts/public-routes.test.ts keeps it complete.
  const showSidebar = !!user && !isPublicRoute(location.pathname);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white selection:bg-[#FF0000] selection:text-white antialiased">
      {isEmergency && !location.pathname.startsWith('/admin') && (
        <div role="status" className="fixed top-16 left-0 lg:left-72 right-0 bg-red-600/90 backdrop-blur-md text-white py-1.5 px-4 lg:px-12 z-40 flex items-center justify-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-center truncate">System lockdown active. Analyses are paused.</span>
        </div>
      )}
      
      {/* Only show Fixed Header if logged in, otherwise LandingPage has its own header */}
      {showSidebar && <AppHeader isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />}
      {showSidebar && <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />}
      
      {/* Content container: max-w-5xl + p-20 previously left only 576px of content at a 1024px laptop,
          which is why the two-column tool layout collapsed to ~108px of typing width and the admin
          tables scrolled horizontally on desktop. */}
      {/* The lockdown banner is fixed at top-16, so content must clear the header AND the banner -
          with only pt-16 it sat underneath the first ~26px of every page. */}
      <main className={`${showSidebar ? `lg:ml-72 ml-0 ${isEmergency && !location.pathname.startsWith('/admin') ? 'pt-[5.75rem]' : 'pt-16'}` : ''} min-h-screen flex flex-col`}>
        {showSidebar ? (
          <div className="px-6 lg:px-12 py-8 lg:py-12 max-w-7xl w-full mx-auto flex-grow animate-in fade-in slide-in-from-bottom-2 duration-500">
            <AppRoutes />
          </div>
        ) : (
          <AppRoutes />
        )}
        <Honeypot />
      </main>

      {/* First-login onboarding (§5) — shown until the user finishes or skips */}
      {user && profile && !profile.onboarded && <OnboardingOverlay />}

      {/* Analytics consent — last in tab order, on marketing and app routes alike; yields to the
          onboarding overlay so a new user is not asked two things at once. */}
      {!(user && profile && !profile.onboarded) && <ConsentBanner />}

      {/* Renders nothing: sets the params every event carries, and fires landing_view on
          marketing routes (GTM E01). Inside the providers it reads. */}
      <AnalyticsBridge />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ScopeProvider>
        <BrowserRouter>
          <AppContainer />
        </BrowserRouter>
      </ScopeProvider>
    </AuthProvider>
  );
};

export default App;