// Admin Settings — system configuration entry points (real) plus appearance/permissions/admin
// notifications which are documented follow-ups.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, ComingSoon } from '../primitives';

const AdminSettings: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <AdminSectionHeader title="Settings" subtitle="Administrative configuration for the platform." />

      <Card title="System Configuration">
        <p className="text-sm text-gray-500 font-medium mb-6">Maintenance mode, analysis pause, and per-module availability are managed in Feature Flags. The emergency kill switch lives under Security.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/admin/flags')} className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-[#0B0B0B] text-white hover:bg-black">Feature Flags</button>
          <button onClick={() => navigate('/admin/security')} className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B]">Security</button>
        </div>
      </Card>

      <Card title="Your Admin Identity">
        <div className="flex items-center justify-between py-2 border-b border-gray-50"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</span><span className="text-sm font-bold text-[#0B0B0B]">{a.profile?.email}</span></div>
        <div className="flex items-center justify-between py-2 border-b border-gray-50"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</span><span className="text-sm font-bold text-[#0B0B0B]">{a.profile?.role.replace('_', ' ')}</span></div>
        <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clearance</span><span className="text-sm font-bold text-[#0B0B0B]">{a.profile?.is_verified_admin ? 'Level 2: Verified' : 'Level 1: Read-only'}</span></div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ComingSoon title="Appearance" description="Admin theme and layout preferences." />
        <ComingSoon title="Admin Notifications" description="Routing for revenue, security, and platform alerts." />
        <ComingSoon title="Granular Permissions" description="Finance / Support / Security / Content admin roles." />
        <ComingSoon title="System Configuration API" description="Advanced platform tuning." />
      </div>
    </div>
  );
};

export default AdminSettings;
