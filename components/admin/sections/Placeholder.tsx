// Generic placeholder for admin sections still being built out. Derives its label from the route.

import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, EmptyState } from '../../UI';
import { AdminSectionHeader } from '../primitives';
import { ADMIN_SECTIONS } from '../../../config/adminAccess';

const Placeholder: React.FC = () => {
  const loc = useLocation();
  const key = loc.pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const section = ADMIN_SECTIONS.find(s => s.key === key);
  return (
    <div>
      <AdminSectionHeader title={section?.label || 'Section'} subtitle="This control center section is being brought online." />
      <Card>
        <EmptyState message={`${section?.label || 'Section'} — coming online`} submessage="The data-backed view for this section is on the way." />
      </Card>
    </div>
  );
};

export default Placeholder;
