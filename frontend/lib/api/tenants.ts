import { apiRequest } from './client';
import { Tenant, CreateTenantPayload, UpdateTenantPayload } from '@/types/tenant';

export function getTenants(): Promise<Tenant[]> {
  return apiRequest<Tenant[]>('/tenants');
}

export function getTenant(id: string): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${id}`);
}

export function createTenant(payload: CreateTenantPayload): Promise<Tenant> {
  return apiRequest<Tenant>('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTenant(id: string, payload: UpdateTenantPayload): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteTenant(id: string): Promise<void> {
  return apiRequest<void>(`/tenants/${id}`, { method: 'DELETE' });
}
