import { Tenant } from './tenant';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  tenantId: string | null;
  tenant: Tenant | null;
  role: Role;
  active: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  tenantId?: string;
  role?: Role;
  active?: boolean;
}
