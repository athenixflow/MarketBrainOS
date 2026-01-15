
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { NavigationItem } from './types';
import Dashboard from './pages/Dashboard';
import AngleMinerX from './pages/AngleMinerX';
import ConversionDoctor from './pages/ConversionDoctor';
import Workflow from './pages/Workflow';
import TestLabPro from './pages/TestLabPro';
import Documentation from './pages/Documentation';
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/Auth';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Honeypot } from './components/UI';
import { SecurityEngine } from './services/securityEngine';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { profile } = useAuth();
  
  const isAdminPath = location.pathname.startsWith('/admin');
  const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'ops_admin';

  const navItems: { label: NavigationItem; path: string }[] = [
    { label: 'Dashboard', path: '/' },
    { label: 'AngleMiner X', path: '/angle-miner' },
    { label: 'TestLab Pro', path: '/test-lab' },
    { label: 'Conversion Doctor', path: '/conversion-doctor' },
    { label: 'Workflow', path: '/workflow' },
  ];

  if (isAdminPath) {
    return (
      <aside className="w-72 bg-[#0B0B0B] flex flex-col h-full fixed left-0 top-16 border-r border-gray-900/30 z-10">
        <nav className="flex-grow py-16 px-8">
          <div className="px-6 pb-8 mb-8 border-b border-gray-900/50">
             <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em]">Operational Area</p>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl bg-[#121212] text-white shadow-lg shadow-black/20 mb-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Control Center
          </Link>
          <Link
            to="/"
            className="flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl text-gray-500 hover:text-white transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
            Exit Admin
          </Link>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-[#0B0B0B] flex flex-col h-full fixed left-0 top-16 border-r border-gray-900/30 z-10">
      <nav className="flex-grow py-16 px-8">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-5 px-6 py-5 text-[13px] font-bold tracking-widest uppercase rounded-2xl transition-all duration-500 mb-3 group ${
                isActive 
                  ? 'bg-[#121212] text-white shadow-lg shadow-black/20' 
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#FF0000]' : 'bg-transparent group-hover:bg-gray-800'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-12 border-t border-gray-900/30">
        {isAdminRole && (
          <Link 
            to="/admin" 
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
  );
};

const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    const check = async () => setIsEmergency(await SecurityEngine.isSystemLocked());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <header className="h-16 bg-[#0B0B0B] flex items-center px-12 fixed top-0 left-0 right-0 border-b border-gray-900/30 z-20 backdrop-blur-2xl bg-opacity-95">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-6">
          <div className="w-9 h-9 bg-[#FF0000] rounded-[10px] flex items-center justify-center font-bold text-white text-xs shadow-2xl shadow-[#FF0000]/20 transform -rotate-6 transition-transform hover:rotate-0">M</div>
          <h1 className="text-sm font-bold tracking-[0.2em] text-white uppercase">
            {isAdminPath ? 'MarketBrainOS Admin' : 'MarketBrainOS'}
          </h1>
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-12">
        <div className="flex gap-10 text-[11px] font-bold tracking-[0.1em] text-gray-500 uppercase">
          {!isAdminPath && profile?.tier === 'free' && (
            <span onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')} className="text-[#FF0000] animate-pulse cursor-pointer">Upgrade to Pro</span>
          )}
          <Link to="/documentation" className="hover:text-white cursor-pointer transition-colors">Documentation</Link>
          {user ? (
            <span onClick={signOut} className="hover:text-white cursor-pointer transition-colors">Sign Out</span>
          ) : (
            <Link to="/auth" className="hover:text-white cursor-pointer transition-colors">Sign In</Link>
          )}
        </div>
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.3)] ${isEmergency ? 'bg-red-500' : 'bg-green-500/80'}`} />
      </div>
    </header>
  );
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      {/* Route root: If user logged in, Dashboard. If not, LandingPage. */}
      <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
      
      {/* Protected Routes */}
      <Route path="/angle-miner" element={user ? <AngleMinerX /> : <Navigate to="/auth" />} />
      <Route path="/test-lab" element={user ? <TestLabPro /> : <Navigate to="/auth" />} />
      <Route path="/conversion-doctor" element={user ? <ConversionDoctor /> : <Navigate to="/auth" />} />
      <Route path="/workflow" element={user ? <Workflow /> : <Navigate to="/auth" />} />
      <Route path="/admin" element={user ? <AdminDashboard /> : <Navigate to="/auth" />} />
      
      {/* Public Routes */}
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
    </Routes>
  );
};

const AppContainer: React.FC = () => {
  const [isEmergency, setIsEmergency] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const check = async () => setIsEmergency(await SecurityEngine.isSystemLocked());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Use layout logic: If user is logged in, show sidebar. If not, show full width layout (no sidebar margin).
  const showSidebar = !!user;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white selection:bg-[#FF0000] selection:text-white antialiased">
      {isEmergency && !location.pathname.startsWith('/admin') && (
        <div className="fixed top-16 left-72 right-0 bg-red-600/90 backdrop-blur-md text-white py-1.5 px-12 z-40 flex items-center justify-center gap-4 animate-pulse">
          <span className="text-[9px] font-black uppercase tracking-[0.4em]">Strategic Lockdown Protocol Active — Intelligence Engine Offline</span>
        </div>
      )}
      
      {/* Only show Fixed Header if logged in, otherwise LandingPage has its own header */}
      {showSidebar && <Header />}
      {showSidebar && <Sidebar />}
      
      <main className={`${showSidebar ? 'ml-72 pt-16' : ''} min-h-screen flex flex-col`}>
        {showSidebar ? (
          <div className="p-20 max-w-5xl w-full mx-auto flex-grow animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <AppRoutes />
          </div>
        ) : (
          <AppRoutes />
        )}
        <Honeypot />
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContainer />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
