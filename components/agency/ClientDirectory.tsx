// Agency Hub — Client Directory (Phase 6.2)
import React, { useMemo, useState } from 'react';
import { Card, PrimaryButton, Input, Select, ErrorMessage, EmptyState, Badge } from '../UI';
import { Agency, AgencyClient } from '../../types';
import { callManageClient } from '../../services/persistenceService';

const STATUS_TONE: Record<string, 'green' | 'blue' | 'yellow' | 'neutral'> = {
  active: 'green', growing: 'blue', at_risk: 'yellow', inactive: 'neutral',
};
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'growing', label: 'Growing' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'inactive', label: 'Inactive' },
];

const ClientDirectory: React.FC<{
  agency: Agency; clients: AgencyClient[]; canManage: boolean;
  onOpenClient: (c: AgencyClient) => void; onReload: () => void;
}> = ({ agency, clients, canManage, onOpenClient, onReload }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', website: '', email: '', primary_contact: '', phone: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const add = async () => {
    if (form.name.trim().length < 2) { setError('Client name is required.'); return; }
    setError(''); setBusy(true);
    try {
      await callManageClient('create', { agencyId: agency.id, ...form });
      setForm({ name: '', industry: '', website: '', email: '', primary_contact: '', phone: '', description: '' });
      setShowForm(false); onReload();
    } catch (e: any) { setError(e.message || 'Could not add client.'); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => clients.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.industry, c.email].join(' ').toLowerCase().includes(q);
  }), [clients, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Input tone="dark" compact type="search" ariaLabel="Search clients" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-grow" />
        <Select tone="dark" compact ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="sm:w-48" />
        {canManage && <PrimaryButton onClick={() => setShowForm(s => !s)}>{showForm ? 'Close' : 'Add Client'}</PrimaryButton>}
      </div>

      {error && <ErrorMessage message={error} />}

      {showForm && canManage && (
        <Card title="Add a client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Input label="Client name" placeholder="Acme Inc." value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="Industry" placeholder="SaaS, Retail…" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
            <Input label="Website" placeholder="acme.com" value={form.website} onChange={(e) => set('website', e.target.value)} />
            <Input label="Primary contact" placeholder="Jane Doe" value={form.primary_contact} onChange={(e) => set('primary_contact', e.target.value)} />
            <Input label="Email" placeholder="jane@acme.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Phone" placeholder="+1…" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <Input label="Notes" placeholder="Context about this client" value={form.description} onChange={(e) => set('description', e.target.value)} multiline />
          <PrimaryButton onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Create Client'}</PrimaryButton>
        </Card>
      )}

      {clients.length === 0 ? (
        <EmptyState card message="No clients yet" submessage={canManage ? 'Add your first client to start isolating client intelligence.' : 'You have not been assigned to any clients yet.'} />
      ) : filtered.length === 0 ? (
        <EmptyState card message="No clients match your filters" submessage="Try a different search term or clear the status filter." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <button key={c.id} onClick={() => onOpenClient(c)} className="paper text-left p-6 sm:p-8 bg-white text-[#0B0B0B] rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <h3 className="text-base font-bold text-[#0B0B0B] tracking-tight truncate min-w-0">{c.name}</h3>
                <Badge tone={STATUS_TONE[c.status] || 'neutral'}>{c.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.industry || 'No industry'}</p>
              <p className="text-xs text-gray-500 font-medium mt-2 tabular-nums">{c.analysis_count || 0} analyses</p>
              {(c.tags && c.tags.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-3">{c.tags.slice(0, 3).map(t => <Badge key={t} tone="neutral">{t}</Badge>)}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDirectory;
