import React from 'react';
import { PageHeader, Card, Stat, Skeleton } from '../components/UI';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';

const TokenStorePage: React.FC = () => {
  const { profile } = useAuth();
  const monthly = profile?.monthly_tokens ?? profile?.tokens ?? 0;
  const purchased = profile?.purchased_tokens ?? 0;
  const isFree = !profile || profile.tier === 'free';

  return (
    <div>
      <PageHeader
        title="Token Store"
        subtitle={isFree
          ? 'Token packs are available on Pro and higher. Purchased tokens never expire and are spent only after your plan allowance runs out.'
          : 'Buy token packs to top up your balance. Purchased tokens never expire and are spent only after your monthly allowance runs out.'}
      />
      {/* The balance tiles wait on the auth profile; the pack list below is built from static pricing
          config and renders immediately. */}
      <Card className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {profile ? (
            <>
              <Stat label="Current balance" value={(monthly + purchased).toLocaleString()} />
              <Stat label={isFree ? 'Free allowance' : 'Monthly allowance'} value={monthly.toLocaleString()} />
              <Stat label="Purchased (never expire)" value={purchased.toLocaleString()} />
            </>
          ) : (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
        </div>
      </Card>
      <TokenStore />
    </div>
  );
};

export default TokenStorePage;
