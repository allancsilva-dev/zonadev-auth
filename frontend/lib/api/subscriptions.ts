import { apiFetchJson } from '@/lib/api';
import { Subscription, CreateSubscriptionPayload } from '@/types/subscription';

export interface PaginatedSubscriptions {
  data: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  status?: string;
  tenantId?: string;
  sort?: string;
}

export function getSubscriptions(params?: SubscriptionListParams): Promise<PaginatedSubscriptions> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.tenantId) query.set('tenantId', params.tenantId);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();
  return apiFetchJson<PaginatedSubscriptions>(`/subscriptions${qs ? `?${qs}` : ''}`);
}

export function createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
  return apiFetchJson<Subscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelSubscription(id: string): Promise<Subscription> {
  return apiFetchJson<Subscription>(`/subscriptions/${id}/cancel`, { method: 'PUT' });
}

export function suspendSubscription(id: string): Promise<Subscription> {
  return apiFetchJson<Subscription>(`/subscriptions/${id}/suspend`, { method: 'PUT' });
}
