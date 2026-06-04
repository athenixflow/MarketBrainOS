// Feature Flags — global operational controls (maintenance mode, pause analyses) and per-tool module
// availability. Writes go through updateSystemSettings via the shared confirm flow (audited).

import React from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader } from '../primitives';

const MODULE_LABELS: Record<string, string> = {
  AngleMiner: 'Angle Miner', ConversionDoctor: 'Conversion Doctor', TestLabPro: 'TestLab Pro', Workflow: 'Workflow',
  StrategyLab: 'Strategy Lab', OfferAnalyzer: 'Offer Analyzer', AudienceIntel: 'Audience Intelligence',
  MarketIntel: 'Market Intelligence', Competitor: 'Competitor Analyzer', Messaging: 'Messaging Analyzer',
  ContentStrategy: 'Content Strategy', Campaign: 'Campaign Analyzer', Growth: 'Growth Analyzer', WorkflowAnalyzer: 'Workflow Analyzer',
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void; color?: string; disabled?: boolean }> =
  ({ label, checked, onChange, color = 'bg-[#FF0000]', disabled }) => (
    <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
      <span className="text-sm font-bold text-[#0B0B0B]">{label}</span>
      <button onClick={onChange} disabled={disabled} className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${checked ? color : 'bg-gray-300'} disabled:opacity-50`}>
        <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );

const FeatureFlags: React.FC = () => {
  const a = useAdmin();
  const settings = a.adminSettings;
  if (!settings) return <p className="text-gray-400 text-sm">Loading controls…</p>;

  const update = (name: string, value: string, changes: any) => a.confirm({
    type: 'UPDATE_SETTINGS', scope: 'admin:system_config', payload: { name, value, changes },
    warningTitle: `CHANGE SYSTEM SETTING: ${name}`, warningMessage: `Set ${name} to ${value}. Affects global platform behavior immediately.`, keyword: 'CONFIRM',
  });

  return (
    <div>
      <AdminSectionHeader title="Feature Flags" subtitle="Global operational controls and per-tool availability. Changes are audited and take effect immediately." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card title="Global Operational Controls">
          <div className="space-y-5">
            <Toggle label="Maintenance Mode" checked={settings.maintenance_mode} color="bg-yellow-500"
              onChange={() => update('Maintenance Mode', settings.maintenance_mode ? 'OFF' : 'ON', { maintenance_mode: !settings.maintenance_mode })} />
            <p className="text-xs text-gray-400 px-2">Blocks normal user access. Admins retain dashboard access.</p>
            <Toggle label="Pause All Analyses" checked={settings.analyses_paused} color="bg-red-500"
              onChange={() => update('Global Pause', settings.analyses_paused ? 'ACTIVE' : 'PAUSED', { analyses_paused: !settings.analyses_paused })} />
            <p className="text-xs text-gray-400 px-2">Immediately halts all neural-engine processing. Billing is suspended.</p>
          </div>
        </Card>
        <Card title="Module Availability">
          <div className="space-y-3">
            {Object.keys(settings.modules_enabled).map(module => (
              <Toggle key={module} label={MODULE_LABELS[module] || module} checked={settings.modules_enabled[module]} color="bg-green-500"
                onChange={() => update(`${module} Module`, settings.modules_enabled[module] ? 'DISABLED' : 'ENABLED', { modules_enabled: { ...settings.modules_enabled, [module]: !settings.modules_enabled[module] } })} />
            ))}
          </div>
        </Card>
      </div>
      <p className="text-right text-xs text-gray-500 font-mono mt-6">
        Last update: {settings.last_updated ? new Date(settings.last_updated).toLocaleString() : 'Never'} by {settings.updated_by || 'System'}
      </p>
    </div>
  );
};

export default FeatureFlags;
