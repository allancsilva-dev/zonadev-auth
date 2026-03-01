import { apiRequest } from './client';
import { User, CreateUserPayload } from '@/types/user';

export function getUsers(tenantId?: string): Promise<User[]> {
  const query = tenantId ? `?tenantId=${tenantId}` : '';
  return apiRequest<User[]>(`/users${query}`);
}

export function getUser(id: string): Promise<User> {
  return apiRequest<User>(`/users/${id}`);
}

export function createUser(payload: CreateUserPayload): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(id: string): Promise<void> {
  return apiRequest<void>(`/users/${id}`, { method: 'DELETE' });
}
