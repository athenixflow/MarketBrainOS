// Enterprise Suite — Structure (Departments + Brands) (Phase 6.3)
import React, { useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage } from '../UI';
import { Enterprise, EnterpriseDepartment, EnterpriseBrand } from '../../types';
import { callManageDepartment, callManageBrand } from '../../services/persistenceService';

const DEPT_TYPES = ['Marketing', 'Sales', 'Operations', 'Strategy', 'Product', 'Customer Success'];

const EnterpriseStructure: React.FC<{
  enterprise: Enterprise; departments: EnterpriseDepartment[]; brands: EnterpriseBrand[]; canManage: boolean; onReload: () => void;
}> = ({ enterprise, departments, brands, canManage, onReload }) => {
  const [deptName, setDeptName] = useState('');
  const [deptType, setDeptType] = useState(DEPT_TYPES[0]);
  const [brandName, setBrandName] = useState('');
  const [brandDesc, setBrandDesc] = useState('');
  const [error, setError] = useState('');

  const addDept = async () => {
    if (deptName.trim().length < 2) { setError('Department name required.'); return; }
    setError('');
    try { await callManageDepartment('create', { enterpriseId: enterprise.id, name: deptName.trim(), type: deptType }); setDeptName(''); onReload(); }
    catch (e: any) { setError(e.message); }
  };
  const delDept = async (id: string) => { try { await callManageDepartment('delete', { enterpriseId: enterprise.id, id }); onReload(); } catch (e: any) { setError(e.message); } };
  const addBrand = async () => {
    if (brandName.trim().length < 2) { setError('Brand name required.'); return; }
    setError('');
    try { await callManageBrand('create', { enterpriseId: enterprise.id, name: brandName.trim(), description: brandDesc.trim() }); setBrandName(''); setBrandDesc(''); onReload(); }
    catch (e: any) { setError(e.message); }
  };
  const delBrand = async (id: string) => { try { await callManageBrand('delete', { enterpriseId: enterprise.id, id }); onReload(); } catch (e: any) { setError(e.message); } };

  return (
    <div className="space-y-8">
      {error && <ErrorMessage message={error} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title={`Departments (${departments.length})`}>
          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Department name" className="flex-grow border border-gray-200 rounded-lg p-3 text-sm outline-none" />
              <select value={deptType} onChange={(e) => setDeptType(e.target.value)} className="border border-gray-200 rounded-lg p-3 text-sm outline-none">{DEPT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              <button onClick={addDept} className="px-4 text-[10px] font-bold text-white bg-[#0B0B0B] rounded-lg uppercase tracking-widest">Add</button>
            </div>
          )}
          <div className="space-y-2">
            {departments.length === 0 && <p className="text-sm text-gray-400 font-medium">No departments yet.</p>}
            {departments.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div><p className="text-sm font-bold text-[#0B0B0B]">{d.name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.type || 'General'}</p></div>
                {canManage && <button onClick={() => delDept(d.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Delete</button>}
              </div>
            ))}
          </div>
        </Card>

        <Card title={`Brands (${brands.length})`}>
          {canManage && (
            <div className="space-y-2 mb-4">
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand name" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none" />
              <div className="flex gap-2">
                <input value={brandDesc} onChange={(e) => setBrandDesc(e.target.value)} placeholder="Description (optional)" className="flex-grow border border-gray-200 rounded-lg p-3 text-sm outline-none" />
                <button onClick={addBrand} className="px-4 text-[10px] font-bold text-white bg-[#0B0B0B] rounded-lg uppercase tracking-widest">Add</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {brands.length === 0 && <p className="text-sm text-gray-400 font-medium">No brands yet.</p>}
            {brands.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{b.name}</p><p className="text-[10px] font-medium text-gray-400 truncate">{b.description || '—'}</p></div>
                {canManage && <button onClick={() => delBrand(b.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest shrink-0">Delete</button>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EnterpriseStructure;
