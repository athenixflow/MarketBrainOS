import React from 'react';
import { Link } from 'react-router-dom';

const PublicFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-gray-900/50 py-16 px-6 md:px-12 bg-[#0B0B0B]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="max-w-xs">
          <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center font-bold text-white text-xs mb-6">M</div>
          <p className="text-gray-500 text-sm leading-relaxed">
            MarketBrain OS is the operating system for business decision-making — turning ideas, campaigns,
            and funnels into actionable strategic intelligence.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 sm:gap-16">
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Product</h4>
            <ul className="text-sm text-gray-500">
              <li><Link to="/features" className="block py-4 hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="block py-4 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/auth" className="block py-4 hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Resources</h4>
            <ul className="text-sm text-gray-500">
              <li><Link to="/documentation" className="block py-4 hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/faq" className="block py-4 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Company</h4>
            <ul className="text-sm text-gray-500">
              <li><Link to="/about" className="block py-4 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/privacy" className="block py-4 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="block py-4 hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-900/50 text-xs text-gray-700 flex flex-col sm:flex-row justify-between gap-3">
        <p>© {year} MarketBrain OS Intelligence.</p>
        <p>System Status: Operational</p>
      </div>
    </footer>
  );
};

export default PublicFooter;
