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
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const FAQ = lazy(() => import('./pages/FAQ'));
const ToolPage = lazy(() => import('./components/ToolPage'));
const History = lazy(() => import('./pages/History'));
const TeamWorkspace = lazy(() => import('./pages/TeamWorkspace'));
const AgencyHub = lazy(() => import('./pages/AgencyHub'));
const EnterpriseSuite = lazy(() => import('./pages/EnterpriseSuite'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScopeProvider, useScope } from './context/ScopeContext';
import { Honeypot, LoadingState } from './components/UI';
import { SecurityEngine } from './services/securityEngine';
import OnboardingOverlay from './components/OnboardingOverlay';
import NotificationCenter from './components/NotificationCenter';
import ScopeSwitcher from './components/ScopeSwitcher';
import { TOOL_CONFIG_LIST, NAV_SUITES } from './config/toolConfigs';

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

          <nav className="flex-grow py-8 px-6 lg:py-16 lg:px-8 overflow-y-auto">
            <div className="px-6 pb-8 mb-8 border-b border-gray-900/50">
               <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em]">Operational Area</p>
            </div>
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl bg-[#121212] text-white shadow-lg shadow-black/20 mb-3"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Control Center
            </Link>
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl text-gray-500 hover:text-white transition-all"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
              Exit Admin
            </Link>
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
          {/* Dashboard home */}
          {(() => {
            const isActive = location.pathname === '/';
            return (
              <Link
                to="/"
                onClick={onClose}
                className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-4 lg:mb-3 group ${
                  isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                Dashboard
              </Link>
            );
          })()}

          {/* Analysis history */}
          {(() => {
            const isActive = location.pathname === '/history';
            return (
              <Link
                to="/history"
                onClick={onClose}
                className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-4 lg:mb-3 group ${
                  isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                History
              </Link>
            );
          })()}

          {/* Team Workspace (Phase 6.1) — gateway for all users; upgrades on first create */}
          {(() => {
            const isActive = location.pathname === '/team';
            return (
              <Link
                to="/team"
                onClick={onClose}
                className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-4 lg:mb-3 group ${
                  isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                Team Workspace
              </Link>
            );
          })()}

          {/* Agency Hub (Phase 6.2) — shown to agency-tier users and agency members */}
          {(profile?.tier === 'team' || profile?.tier === 'agency' || profile?.tier === 'enterprise' || memberships.some(m => m.family === 'agency')) && (() => {
            const isActive = location.pathname === '/agency';
            return (
              <Link
                to="/agency"
                onClick={onClose}
                className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-4 lg:mb-3 group ${
                  isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                Agency Hub
              </Link>
            );
          })()}

          {/* Enterprise Suite (Phase 6.3) — shown to enterprise-tier users and enterprise members */}
          {(profile?.tier === 'enterprise' || profile?.tier === 'agency' || memberships.some(m => m.family === 'enterprise')) && (() => {
            const isActive = location.pathname === '/enterprise';
            return (
              <Link
                to="/enterprise"
                onClick={onClose}
                className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-4 lg:mb-3 group ${
                  isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                Enterprise Suite
              </Link>
            );
          })()}

          {/* Tool suites (V1 Tool Architecture grouping) */}
          {NAV_SUITES.map((group) => (
            <div key={group.suite} className="mt-8">
              <p className="px-6 mb-4 text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">{group.suite}</p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-5 px-6 py-4 text-[12px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-2 group ${
                      isActive ? 'bg-[#121212] text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
            <Link to="/" className="text-[#FF0000] animate-pulse cursor-pointer hidden sm:block">Upgrade to Pro</Link>
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

      {/* SECURE ADMIN ROUTE */}
      <Route path="/admin" element={
        <AdminGuard>
          <AdminDashboard />
        </AdminGuard>
      } />
      
      {/* Public Routes */}
      <Route path="/documentation" element={<Documentation />} />
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
  const PUBLIC_ROUTES = ['/features', '/pricing', '/about', '/faq'];
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

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