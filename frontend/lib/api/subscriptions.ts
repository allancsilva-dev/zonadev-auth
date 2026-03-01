import { apiRequest } from './client';
import { Subscription, CreateSubscriptionPayload } from '@/types/subscription';

export function getSubscriptions(tenantId?: string): Promise<Subscription[]> {
  const query = tenantId ? `?tenantId=${tenantId}` : '';
  return apiRequest<Subscription[]>(`/subscriptions${query}`);
}

export function createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
  return apiRequest<Subscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/subscriptions/${id}/cancel`, { method: 'PUT' });
}

export function suspendSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/subscriptions/${id}/suspend`, { method: 'PUT' });
}
