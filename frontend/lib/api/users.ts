import { apiFetchJson } from '@/lib/api';
import { User, CreateUserPayload } from '@/types/user';

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  active?: boolean;
  sort?: string;
}

export function getUsers(params?: UserListParams): Promise<PaginatedUsers> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  if (params?.role) query.set('role', params.role);
  if (params?.active !== undefined) query.set('active', String(params.active));
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();
  return apiFetchJson<PaginatedUsers>(`/users${qs ? `?${qs}` : ''}`);
}

export function getUser(id: string): Promise<User> {
  return apiFetchJson<User>(`/users/${id}`);
}

export function createUser(payload: CreateUserPayload): Promise<User> {
  return apiFetchJson<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(id: string): Promise<void> {
  return apiFetchJson<void>(`/users/${id}/deactivate`, { method: 'PATCH' });
}
