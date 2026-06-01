// Agency Hub — Client Directory (Phase 6.2)
import React, { useMemo, useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage, EmptyState } from '../UI';
import { Agency, AgencyClient } from '../../types';
import { callManageClient } from '../../services/persistenceService';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700', growing: 'bg-blue-100 text-blue-700',
  at_risk: 'bg-yellow-100 text-yellow-700', inactive: 'bg-gray-100 text-gray-500',
};

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
      <div className="flex flex-col md:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="flex-grow bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
          <option value="all">All statuses</option>
          <option value="active">Active</option><option value="growing">Growing</option>
          <option value="at_risk">At Risk</option><option value="inactive">Inactive</option>
        </select>
        {canManage && <PrimaryButton onClick={() => setShowForm(s => !s)}>{showForm ? 'Close' : 'Add Client'}</PrimaryButton>}
      </div>

      {error && <ErrorMessage message={error} />}

      {showForm && canManage && (
        <Card title="Add a client">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Client name" placeholder="Acme Inc." value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="Industry" placeholder="SaaS, Retail…" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
            <Input label="Website" placeholder="acme.com" value={form.website} onChange={(e) => set('website', e.target.value)} />
            <Input label="Primary contact" placeholder="Jane Doe" value={form.primary_contact} onChange={(e) => set('primary_contact', e.target.value)} />
            <Input label="Email" placeholder="jane@acme.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Phone" placeholder="+1…" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="mt-4"><Input label="Notes" placeholder="Context about this client" value={form.description} onChange={(e) => set('description', e.target.value)} multiline /></div>
          <div className="mt-4"><PrimaryButton onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Create Client'}</PrimaryButton></div>
        </Card>
      )}

      {clients.length === 0 ? (
        <EmptyState message="No clients yet." submessage={canManage ? 'Add your first client to start isolating client intelligence.' : 'You have not been assigned to any clients yet.'} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <button key={c.id} onClick={() => onOpenClient(c)} className="text-left p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-base font-bold text-[#0B0B0B] tracking-tight truncate">{c.name}</h3>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-500'}`}>{c.status.replace('_', ' ')}</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.industry || 'No industry'}</p>
              <p className="text-xs text-gray-500 font-medium mt-2">{c.analysis_count || 0} analyses</p>
              {(c.tags && c.tags.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-3">{c.tags.slice(0, 3).map(t => <span key={t} className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>)}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDirectory;
