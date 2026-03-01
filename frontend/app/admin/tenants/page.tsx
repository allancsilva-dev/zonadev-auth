// Server Component — busca dados e passa para o Client Component
import { serverFetch } from '@/lib/api/server';
import { Tenant } from '@/types/tenant';
import TenantsClient from './TenantsClient';

export default async function TenantsPage() {
  const tenants = await serverFetch<Tenant[]>('/tenants');
  return <TenantsClient initialData={tenants} />;
}
