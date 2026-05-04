import { Subscriptions } from '@/components/Subscriptions';
import { TrialDialog } from '@/components/auth/TrialDialog';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';

export function SubscriptionView() {
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.has('trial');
  const [open, setOpen] = useState(isTrial);
  return (
    <>
      <TrialDialog open={open} onOpenChange={setOpen} />
      <Subscriptions />
    </>
  );
}
