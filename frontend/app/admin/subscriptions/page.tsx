import { serverFetch } from '@/lib/api/server';
import { Subscription } from '@/types/subscription';
import { Tenant } from '@/types/tenant';
import { Plan } from '@/types/plan';
import SubscriptionsClient from './SubscriptionsClient';

export default async function SubscriptionsPage() {
  const [subscriptions, tenants, plans] = await Promise.all([
    serverFetch<Subscription[]>('/subscriptions'),
    serverFetch<Tenant[]>('/tenants'),
    serverFetch<Plan[]>('/plans'),
  ]);

  return <SubscriptionsClient initialData={subscriptions} tenants={tenants} plans={plans} />;
}
