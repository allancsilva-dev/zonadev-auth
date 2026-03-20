import { apiFetchJson } from '@/lib/api';
import { AdminApp, CreateAdminAppPayload } from '@/types/app';

export function listApps(): Promise<{ data: AdminApp[] }> {
  return apiFetchJson<{ data: AdminApp[] }>('/admin/apps');
}

export function createApp(payload: CreateAdminAppPayload): Promise<{ data: AdminApp }> {
  return apiFetchJson<{ data: AdminApp }>('/admin/apps', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleApp(id: string, active: boolean): Promise<{ success: boolean }> {
  return apiFetchJson<{ success: boolean }>(`/admin/apps/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

export function reloadAppsCache(): Promise<{ success: boolean }> {
  return apiFetchJson<{ success: boolean }>('/admin/apps/reload', {
    method: 'POST',
  });
}
