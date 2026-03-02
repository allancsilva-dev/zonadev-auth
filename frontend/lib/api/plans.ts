import { apiFetchJson } from '@/lib/api';
import { Plan, CreatePlanPayload, UpdatePlanPayload } from '@/types/plan';

export function getPlans(): Promise<Plan[]> {
  return apiFetchJson<Plan[]>('/plans');
}

export function createPlan(payload: CreatePlanPayload): Promise<Plan> {
  return apiFetchJson<Plan>('/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePlan(id: string, payload: UpdatePlanPayload): Promise<Plan> {
  return apiFetchJson<Plan>(`/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
