export interface Plan {
  id: string;
  name: string;
  price: number;
  maxUsers: number;
  features: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanPayload {
  name: string;
  price: number;
  maxUsers: number;
  features?: Record<string, unknown>;
}

export interface UpdatePlanPayload {
  name?: string;
  price?: number;
  maxUsers?: number;
  features?: Record<string, unknown>;
}
