export type PlanType = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: PlanType;
  active: boolean;
  provisionStatus?: 'pending' | 'active' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantPayload {
  name: string;
  subdomain: string;
  ownerAuthUserId: string;
  ownerEmail: string;
  plan?: PlanType;
  active?: boolean;
}

export interface UpdateTenantPayload {
  name?: string;
  subdomain?: string;
  plan?: PlanType;
  active?: boolean;
}
