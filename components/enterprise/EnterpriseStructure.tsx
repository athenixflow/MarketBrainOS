// Enterprise Suite — Structure (Departments + Brands) (Phase 6.3)
import React, { useState } from 'react';
import { Card, PrimaryButton, Input, Select, ErrorMessage, EmptyState } from '../UI';
import { Enterprise, EnterpriseDepartment, EnterpriseBrand } from '../../types';
import { callManageDepartment, callManageBrand } from '../../services/persistenceService';

const DEPT_TYPES = ['Marketing', 'Sales', 'Operations', 'Strategy', 'Product', 'Customer Success'];
const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest transition-colors shrink-0';

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
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end mb-6">
              <Input compact ariaLabel="Department name" placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
              <Select compact ariaLabel="Department type" value={deptType} onChange={setDeptType} options={DEPT_TYPES.map(t => ({ value: t, label: t }))} className="md:w-48" />
              <PrimaryButton size="sm" onClick={addDept}>Add</PrimaryButton>
            </div>
          )}
          {departments.length === 0 ? (
            <EmptyState message="No departments yet" submessage={canManage ? 'Add a department above to start structuring the organization.' : 'Departments will appear here once they are added.'} />
          ) : (
            <div className="space-y-2">
              {departments.map(d => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{d.name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.type || 'General'}</p></div>
                  {canManage && <button onClick={() => delDept(d.id)} className={rowAction}>Delete</button>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Brands (${brands.length})`}>
          {canManage && (
            <div className="mb-6">
              <Input compact ariaLabel="Brand name" placeholder="Brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <Input compact ariaLabel="Brand description" placeholder="Description (optional)" value={brandDesc} onChange={(e) => setBrandDesc(e.target.value)} />
                <PrimaryButton size="sm" onClick={addBrand}>Add</PrimaryButton>
              </div>
            </div>
          )}
          {brands.length === 0 ? (
            <EmptyState message="No brands yet" submessage={canManage ? 'Add a brand above to track performance by brand.' : 'Brands will appear here once they are added.'} />
          ) : (
            <div className="space-y-2">
              {brands.map(b => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{b.name}</p><p className="text-[10px] font-medium text-gray-400 truncate">{b.description || 'No description'}</p></div>
                  {canManage && <button onClick={() => delBrand(b.id)} className={rowAction}>Delete</button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default EnterpriseStructure;
