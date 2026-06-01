import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';

// Shared chrome for all public marketing pages (dark theme).
const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#0B0B0B] text-gray-300 font-sans selection:bg-[#FF0000] selection:text-white min-h-screen flex flex-col">
    <PublicNav />
    <main className="flex-grow">{children}</main>
    <PublicFooter />
  </div>
);

export default PublicLayout;
