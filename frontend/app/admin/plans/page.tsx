import { serverFetch } from '@/lib/api/server';
import { Plan } from '@/types/plan';
import PlansClient from './PlansClient';

export default async function PlansPage() {
  const plans = await serverFetch<Plan[]>('/plans');
  return <PlansClient initialData={plans} />;
}
