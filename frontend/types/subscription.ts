import { Tenant } from './tenant';
import { Plan } from './plan';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';

export interface Subscription {
  id: string;
  tenantId: string;
  tenant: Tenant;
  planId: string;
  plan: Plan;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateSubscriptionPayload {
  tenantId: string;
  planId: string;
  expiresAt: string;
}
