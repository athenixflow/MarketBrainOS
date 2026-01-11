
import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, PrimaryButton, UpgradeCard } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  const modules = [
    {
      name: 'AngleMiner X',
      purpose: 'Evaluate psychological triggers that command attention.',
      path: '/angle-miner',
      accent: true
    },
    {
      name: 'TestLab Pro',
      purpose: 'Simulate performance before deployment.',
      path: '/test-lab',
      accent: false
    },
    {
      name: 'Conversion Doctor',
      purpose: 'Evaluate assets for clinical conversion efficiency.',
      path: '/conversion-doctor',
      accent: false
    }
  ];

  return (
    <div className="space-y-24">
      <PageHeader 
        title="High-Confidence Marketing Intelligence" 
        subtitle="Evaluate, optimize, and execute high-stakes marketing strategies with clinical precision." 
      />
      
      <div className="grid grid-cols-1 gap-12">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-4">Available Intelligence Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {modules.map((mod) => (
            <Card key={mod.name} accent={mod.accent} className="group hover:shadow-2xl hover:shadow-black/10 duration-500">
              <div className="flex flex-col h-full justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[#0B0B0B] tracking-tight mb-4 group-hover:text-[#FF0000] transition-colors duration-500">{mod.name}</h3>
                  <p className="text-gray-500 font-medium leading-relaxed mb-12">
                    {mod.purpose}
                  </p>
                </div>
                <Link to={mod.path}>
                  <PrimaryButton className="w-full !px-0 !py-3.5 !text-xs">Open Module</PrimaryButton>
                </Link>
              </div>
            </Card>
          ))}
          {profile?.tier === 'free' && (
            <UpgradeCard onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')} />
          )}
        </div>
      </div>

      <div className="pt-12">
        <Card className="!bg-[#0D0D0D] !border-gray-900 !text-white !p-16">
          <div className="max-w-xl">
            <p className="text-[#FF0000] text-xs font-bold uppercase tracking-[0.3em] mb-6">Strategic Status</p>
            <h3 className="text-3xl font-bold tracking-tight mb-6">Systems are Calibrated</h3>
            <p className="text-gray-400 font-medium leading-relaxed mb-10">
              The neural processing core is currently running at peak efficiency. All evaluations are powered by Decision-Grade AI for maximum strategic accuracy.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Neural Stability: 100%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#FF0000] shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Latency: 14ms</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
