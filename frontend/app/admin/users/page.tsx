import { serverFetch } from '@/lib/api/server';
import { User } from '@/types/user';
import { Tenant } from '@/types/tenant';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const [users, tenants] = await Promise.all([
    serverFetch<User[]>('/users'),
    serverFetch<Tenant[]>('/tenants'),
  ]);

  return <UsersClient initialData={users} tenants={tenants} />;
}
