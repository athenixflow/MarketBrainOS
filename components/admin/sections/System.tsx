// System sections — Notifications (derived platform alerts, real) and Support / Content (no backend
// yet → Coming soon). Announcement broadcast depends on the email/notification fan-out seam (§67).

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, ComingSoon, ComingSoonCard, Pill } from '../primitives';

// ---- Notifications: real, derived alerts + announcement stub ----
export const AdminNotifications: React.FC = () => {
  const a = useAdmin();

  const alerts = useMemo(() => {
    const out: { tone: any; title: string; detail: string }[] = [];
    if (a.isEmergencyActive) out.push({ tone: 'red', title: 'System Lockdown Active', detail: 'The platform kill switch is engaged.' });
    if (a.failureRate > 5) out.push({ tone: 'red', title: 'Elevated Failure Rate', detail: `${a.failureRate.toFixed(1)}% of recent operations failed (24h).` });
    if (a.adminSettings?.maintenance_mode) out.push({ tone: 'yellow', title: 'Maintenance Mode On', detail: 'Normal user access is blocked.' });
    if (a.adminSettings?.analyses_paused) out.push({ tone: 'yellow', title: 'Analyses Paused', detail: 'Neural engine processing is halted.' });
    const lowTokenPro = a.users.filter(u => u.tier === 'pro' && (u.tokens ?? 0) <= 10).length;
    if (lowTokenPro > 0) out.push({ tone: 'blue', title: 'Pro Users Low on Tokens', detail: `${lowTokenPro} Pro account(s) at/below 10 tokens.` });
    const critical = a.securityLogs.filter(l => l.severity === 'critical').length;
    if (critical > 0) out.push({ tone: 'red', title: 'Critical Security Events', detail: `${critical} critical event(s) in the security ledger.` });
    if (out.length === 0) out.push({ tone: 'green', title: 'All Clear', detail: 'No platform alerts at this time.' });
    return out;
  }, [a.isEmergencyActive, a.failureRate, a.adminSettings, a.users, a.securityLogs]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader title="Notifications" subtitle="Live platform alerts derived from system state. Broadcast announcements arrive with the email channel." />
      <Card title="Platform Alerts">
        <div className="space-y-3">
          {alerts.map((al, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3"><Pill tone={al.tone}>{al.tone === 'green' ? 'OK' : 'Alert'}</Pill><div><p className="text-sm font-bold text-[#0B0B0B]">{al.title}</p><p className="text-xs text-gray-400 font-medium">{al.detail}</p></div></div>
            </div>
          ))}
        </div>
      </Card>
      <ComingSoonCard title="Send Announcement" description="Broadcast platform-wide announcements to users in-app and by email (requires the notification email fan-out)." />
    </div>
  );
};

// ---- Support: stub ----
export const AdminSupport: React.FC = () => (
  <div className="space-y-8">
    <AdminSectionHeader title="Support" subtitle="Support ticketing and user assistance." />
    <ComingSoonCard title="Support Ticket System" description="Inbox, assignment, status tracking, and replies for user support requests (PRD §48)." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ComingSoon title="Ticket Queue" description="Open, pending, and resolved tickets." />
      <ComingSoon title="Canned Responses" description="Reusable reply templates." />
    </div>
  </div>
);

// ---- Content: stub ----
export const AdminContent: React.FC = () => (
  <div className="space-y-8">
    <AdminSectionHeader title="Content" subtitle="Documentation, announcements, and marketing content management." />
    <ComingSoonCard title="Content Management" description="Edit documentation, FAQs, and announcements without a redeploy." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ComingSoon title="Documentation Editor" description="Manage help articles." />
      <ComingSoon title="Announcement Banners" description="Schedule in-app banners." />
    </div>
  </div>
);
