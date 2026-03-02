// Query keys centralizadas — garante consistência nas invalidações do TanStack Query

export interface TenantListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  active?: boolean;
  sort?: string;
}

export interface SubListParams {
  tenantId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export const queryKeys = {
  stats: () => ['admin-stats'] as const,

  tenants: (p?: TenantListParams) => ['tenants', p] as const,
  tenant: (id: string) => ['tenants', id] as const,
  tenantUsers: (id: string, p?: UserListParams) => ['tenants', id, 'users', p] as const,

  users: (p?: UserListParams) => ['users', p] as const,
  user: (id: string) => ['users', id] as const,

  plans: () => ['plans'] as const,
  plan: (id: string) => ['plans', id] as const,

  subscriptions: (p?: SubListParams) => ['subscriptions', p] as const,
};
