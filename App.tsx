import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
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
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScopeProvider, useScope } from './context/ScopeContext';
import { Honeypot, LoadingState } from './components/UI';
import { SecurityEngine } from './services/securityEngine';
import OnboardingOverlay from './components/OnboardingOverlay';
import NotificationCenter from './components/NotificationCenter';
import ScopeSwitcher from './components/ScopeSwitcher';
import { TOOL_CONFIG_LIST, NAV_SUITES } from './config/toolConfigs';
import { NAV_CORE, NAV_COLLABORATION, NAV_ACCOUNT, visibleLinks, NavLink } from './config/access';
import { visibleAdminSections, adminPath } from './config/adminAccess';

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

  const renderNavLink = (link: NavLink, size: 'lg' | 'sm' = 'lg') => {
    const isActive = link.exact ? location.pathname === link.path : location.pathname === link.path;
    const pad = size === 'lg' ? 'py-5 text-[13px]' : 'py-4 text-[12px]';
    return (
      <Link
        key={link.path}
        to={link.path}
        onClick={onClose}
        className={`flex items-center gap-5 px-6 ${pad} font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-3 group ${
          isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
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
    /* Desktop Styles (Reset to original) */
    lg:translate-x-0 lg:top-16 lg:h-full lg:z-10
  `;

  if (isAdminPath) {
    return (
      <>
        <MobileOverlay />
        <aside className={sidebarClasses}>
          {/* Mobile Header inside Drawer */}
          <div className="flex items-center justify-between p-6 lg:hidden border-b border-gray-900/30">
             <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Admin Menu</span>
             <button onClick={onClose} className="text-white p-2">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
          </div>

          <nav className="flex-grow py-8 px-6 lg:py-12 lg:px-8 overflow-y-auto">
            <div className="px-6 pb-6 mb-6 border-b border-gray-900/50">
               <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em]">Control Center</p>
            </div>
            {visibleAdminSections(profile?.role).map((grp) => (
              <div key={grp.group} className="mb-6">
                <p className="px-6 mb-3 text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">{grp.group}</p>
                {grp.items.map((item) => {
                  const path = adminPath(item.key);
                  const isActive = location.pathname === path || (item.key === '' && location.pathname === '/admin');
                  return (
                    <Link
                      key={item.key || 'overview'}
                      to={path}
                      onClick={onClose}
                      className={`flex items-center gap-4 px-6 py-3 text-[12px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-300 mb-1 group ${
                        isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
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
              <Link to="/" onClick={onClose} className="flex items-center gap-4 px-6 py-3 text-[12px] font-bold tracking-widest uppercase rounded-2xl text-gray-500 hover:text-white transition-all">
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
      <aside className={sidebarClasses}>
        {/* Mobile Header inside Drawer */}
        <div className="flex items-center justify-between p-6 lg:hidden border-b border-gray-900/30">
           <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Navigation</span>
           <button onClick={onClose} className="text-white p-2">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>

        <nav className="flex-grow py-8 px-6 lg:py-16 lg:px-8 overflow-y-auto">
          {/* Core — Dashboard, History, Reports (always visible to a signed-in user) */}
          {visibleLinks(NAV_CORE, accessCtx).map((link) => renderNavLink(link, 'lg'))}

          {/* Analysis Tools — data-driven suites (V1 Tool Architecture grouping) */}
          {NAV_SUITES.map((group) => (
            <div key={group.suite} className="mt-8">
              <p className="px-6 mb-4 text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">{group.suite}</p>
              {group.items.map((item) => renderNavLink({ label: item.label, path: item.path }, 'sm'))}
            </div>
          ))}

          {/* Collaboration — Team / Agency / Enterprise, gated by plan or membership */}
          {(() => {
            const links = visibleLinks(NAV_COLLABORATION, accessCtx);
            if (links.length === 0) return null;
            return (
              <div className="mt-8">
                <p className="px-6 mb-4 text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">{NAV_COLLABORATION.heading}</p>
                {links.map((link) => renderNavLink(link, 'sm'))}
              </div>
            );
          })()}

          {/* Account — Billing / Settings / Support */}
          <div className="mt-8">
            <p className="px-6 mb-4 text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">{NAV_ACCOUNT.heading}</p>
            {visibleLinks(NAV_ACCOUNT, accessCtx).map((link) => renderNavLink(link, 'sm'))}
          </div>
        </nav>
        <div className="p-8 lg:p-12 border-t border-gray-900/30">
          {isAdminRole && (
            <Link 
              to="/admin" 
              onClick={onClose}
              className="block mb-8 p-6 bg-red-950/20 rounded-2xl border border-red-900/30 hover:bg-red-950/40 transition-colors"
            >
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Admin Control</p>
              <p className="text-[8px] text-red-500/60 uppercase font-bold mt-1">{profile?.role.replace('_', ' ')}</p>
            </Link>
          )}
          {profile && (
            <div className="mb-8 p-6 bg-[#121212] rounded-2xl border border-gray-900">
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-4 opacity-60">Usage remaining this month</p>
              <div className="flex items-end gap-3">
                <span className="text-2xl font-black text-white">{profile.tokens}</span>
                <span className="text-[10px] font-bold text-gray-700 uppercase mb-1.5">Credits</span>
              </div>
              {profile.tokens === 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <p className="text-[8px] font-bold text-[#FF0000] uppercase tracking-widest">Allowance Exhausted</p>
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.4em] opacity-30">Premium Intelligence Layer</p>
        </div>
      </aside>
    </>
  );
};

const Header: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  // Ensure title reflects Admin only if user is authorized
  const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'ops_admin';
  const isAdminPath = location.pathname.startsWith('/admin') && isAdminRole;
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    const check = async () => setIsEmergency(await SecurityEngine.isSystemLocked());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <header className="h-16 bg-[#0B0B0B] flex items-center px-6 lg:px-12 fixed top-0 left-0 right-0 border-b border-gray-900/30 z-20 backdrop-blur-2xl bg-opacity-95">
      <div className="flex items-center gap-6">
        {user && (
          <button onClick={onToggleSidebar} className="lg:hidden text-gray-400 hover:text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        <Link to="/" className="flex items-center gap-6">
          <div className="w-9 h-9 bg-[#FF0000] rounded-[10px] flex items-center justify-center font-bold text-white text-xs shadow-2xl shadow-[#FF0000]/20 transform -rotate-6 transition-transform hover:rotate-0">M</div>
          <h1 className="text-sm font-bold tracking-[0.2em] text-white uppercase hidden md:block">
            {isAdminPath ? 'MarketBrainOS Admin' : 'MarketBrainOS'}
          </h1>
          {/* Shorter title for mobile if needed, or hide text entirely on very small screens */}
          <h1 className="text-sm font-bold tracking-[0.2em] text-white uppercase md:hidden">
            MBOS
          </h1>
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-6 lg:gap-12">
        <div className="flex gap-6 lg:gap-10 text-[11px] font-bold tracking-[0.1em] text-gray-500 uppercase">
          {!isAdminPath && profile?.tier === 'free' && (
            <Link to="/pricing" className="text-[#FF0000] animate-pulse cursor-pointer hidden sm:block">Upgrade to Pro</Link>
          )}
          <Link to="/documentation" className="hover:text-white cursor-pointer transition-colors hidden sm:block">Docs</Link>
          <Link to="/documentation" className="hover:text-white cursor-pointer transition-colors sm:hidden">?</Link>
          
          {user ? (
            <span onClick={signOut} className="hover:text-white cursor-pointer transition-colors">Sign Out</span>
          ) : (
            <Link to="/auth" className="hover:text-white cursor-pointer transition-colors">Sign In</Link>
          )}
        </div>
        {user && !isAdminPath && <ScopeSwitcher />}
        {user && !isAdminPath && <NotificationCenter />}
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.3)] ${isEmergency ? 'bg-red-500' : 'bg-green-500/80'}`} />
      </div>
    </header>
  );
};

// --- ADMIN GUARD ---
// Enforces role-based security at the routing level.
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingState message="Verifying Security Clearance..." />;
  
  // 1. Must be authenticated
  if (!user) return <Navigate to="/auth" replace />;

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

  if (loading) return null;

  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
    <Routes>
      {/* Route root: If user logged in, Dashboard. If not, LandingPage. */}
      <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
      
      {/* Protected Routes */}
      <Route path="/history" element={user ? <History /> : <Navigate to="/auth" />} />
      <Route path="/reports" element={user ? <Reports /> : <Navigate to="/auth" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/auth" />} />
      <Route path="/store" element={user ? <TokenStorePage /> : <Navigate to="/auth" />} />
      <Route path="/billing" element={user ? <BillingCenter /> : <Navigate to="/auth" />} />
      <Route path="/support" element={user ? <Support /> : <Navigate to="/auth" />} />
      <Route path="/team" element={user ? <TeamWorkspace /> : <Navigate to="/auth" />} />
      <Route path="/agency" element={user ? <AgencyHub /> : <Navigate to="/auth" />} />
      <Route path="/enterprise" element={user ? <EnterpriseSuite /> : <Navigate to="/auth" />} />
      <Route path="/angle-miner" element={user ? <AngleMinerX /> : <Navigate to="/auth" />} />
      <Route path="/test-lab" element={user ? <TestLabPro /> : <Navigate to="/auth" />} />
      <Route path="/conversion-doctor" element={user ? <ConversionDoctor /> : <Navigate to="/auth" />} />
      <Route path="/workflow" element={user ? <Workflow /> : <Navigate to="/auth" />} />

      {/* PRD §14–22 analysis tools */}
      {TOOL_CONFIG_LIST.map((tool) => (
        <Route
          key={tool.slug}
          path={`/${tool.slug}`}
          element={user ? <ToolPage config={tool} /> : <Navigate to="/auth" />}
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
      <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
    </Routes>
    </Suspense>
  );
};

const AppContainer: React.FC = () => {
  const [isEmergency, setIsEmergency] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    const check = async () => setIsEmergency(await SecurityEngine.isSystemLocked());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Public marketing pages carry their own chrome (PublicLayout) and must render full-width,
  // even for logged-in users — otherwise the app sidebar/header double up with the public nav.
  // The docs hub (/documentation/*) is its own full-bleed mini-app with its own nav, so it is
  // treated the same way for every visitor (matched by prefix to cover its sub-pages).
  const PUBLIC_ROUTES = ['/features', '/pricing', '/about', '/faq'];
  const isDocsRoute = location.pathname.startsWith('/documentation');
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname) || isDocsRoute;

  // Use layout logic: If user is logged in (and not on a public marketing page), show sidebar.
  const showSidebar = !!user && !isPublicRoute;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white selection:bg-[#FF0000] selection:text-white antialiased">
      {isEmergency && !location.pathname.startsWith('/admin') && (
        <div className="fixed top-16 left-0 lg:left-72 right-0 bg-red-600/90 backdrop-blur-md text-white py-1.5 px-4 lg:px-12 z-40 flex items-center justify-center gap-4 animate-pulse">
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-center">Strategic Lockdown Protocol Active — Intelligence Engine Offline</span>
        </div>
      )}
      
      {/* Only show Fixed Header if logged in, otherwise LandingPage has its own header */}
      {showSidebar && <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />}
      {showSidebar && <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />}
      
      <main className={`${showSidebar ? 'lg:ml-72 ml-0 pt-16' : ''} min-h-screen flex flex-col`}>
        {showSidebar ? (
          <div className="p-6 lg:p-20 max-w-5xl w-full mx-auto flex-grow animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <AppRoutes />
          </div>
        ) : (
          <AppRoutes />
        )}
        <Honeypot />
      </main>

      {/* First-login onboarding (§5) — shown until the user finishes or skips */}
      {user && profile && !profile.onboarded && <OnboardingOverlay />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ScopeProvider>
        <HashRouter>
          <AppContainer />
        </HashRouter>
      </ScopeProvider>
    </AuthProvider>
  );
};

export default App;