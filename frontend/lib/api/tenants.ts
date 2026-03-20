import { apiFetchJson } from '@/lib/api';
import { Tenant, CreateTenantPayload, UpdateTenantPayload } from '@/types/tenant';

export function getTenants(): Promise<Tenant[]> {
  return apiFetchJson<Tenant[]>('/tenants');
}

export function getTenant(id: string): Promise<Tenant> {
  return apiFetchJson<Tenant>(`/tenants/${id}`);
}

export function createTenant(payload: CreateTenantPayload): Promise<Tenant> {
  return apiFetchJson<Tenant>('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTenant(id: string, payload: UpdateTenantPayload): Promise<Tenant> {
  return apiFetchJson<Tenant>(`/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteTenant(id: string): Promise<void> {
  return apiFetchJson<void>(`/tenants/${id}`, { method: 'DELETE' });
}

export function reprovisionTenant(
  id: string,
  payload: { ownerAuthUserId: string; ownerEmail: string },
): Promise<Tenant> {
  return apiFetchJson<Tenant>(`/tenants/${id}/reprovision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
