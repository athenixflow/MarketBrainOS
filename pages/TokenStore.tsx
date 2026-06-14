import React from 'react';
import { PageHeader } from '../components/UI';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
    <p className="text-xl font-black text-[#0B0B0B] mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
  </div>
);

const TokenStorePage: React.FC = () => {
  const { profile } = useAuth();
  const monthly = profile?.monthly_tokens ?? profile?.tokens ?? 0;
  const purchased = profile?.purchased_tokens ?? 0;

  return (
    <div>
      <PageHeader
        title="Token Store"
        subtitle="Buy token packs to top up your balance. Purchased tokens never expire and are spent only after your monthly allowance runs out."
      />
      <div className="mb-8 p-6 bg-white rounded-2xl border border-gray-100 flex flex-wrap gap-10">
        <Stat label="Current balance" value={monthly + purchased} />
        <Stat label="Monthly allowance" value={monthly} />
        <Stat label="Purchased (never expire)" value={purchased} />
      </div>
      <TokenStore />
    </div>
  );
};

export default TokenStorePage;
